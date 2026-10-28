// The /stats dashboard's numbers (docs/online/public-launch-plan.md §4.4), read from the D1
// statistics. Only for whoever holds the Worker secret ADMIN_KEY.
import { LIVE_LOOKBACK_MS, liveReport, type OpenMatchRow } from '../src/analytics/live';
import type { WindowRule } from './limits';

interface StatsEnv {
  readonly ANALYTICS: D1Database;
  readonly ADMIN_KEY?: string;
}

/** Wrong keys one IP address may try. */
const ADMIN_RULE: WindowRule = { limit: 10, windowMs: 60 * 1000 };
const DAYS_SHOWN = 30;

function sameKey(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

type Row = Record<string, unknown>;

async function all(db: D1Database, sql: string, ...args: unknown[]): Promise<Row[]> {
  return (await db.prepare(sql).bind(...args).all<Row>()).results;
}

async function one(db: D1Database, sql: string, ...args: unknown[]): Promise<number> {
  const row = await db.prepare(sql).bind(...args).first<Row>();
  return Number(row?.n ?? 0);
}

const distinctClients = (db: D1Database, name: string) => one(db, 'SELECT COUNT(DISTINCT client) AS n FROM events WHERE name = ?', name);

/** Each player's latest online match in the lookback that has no end, with their latest event since. */
async function openOnlineMatches(db: D1Database, now: number): Promise<OpenMatchRow[]> {
  const rows = await all(
    db,
    `WITH starts AS (
       SELECT client, MAX(at) AS started FROM events
        WHERE name = 'match_start' AND json_extract(data, '$.mode') = 'online' AND at > ?
        GROUP BY client
     )
     SELECT s.client AS client, s.started AS started,
            (SELECT MAX(e.at) FROM events e WHERE e.client = s.client AND e.at >= s.started) AS last,
            (SELECT MAX(json_extract(e.data, '$.round')) FROM events e
               WHERE e.client = s.client AND e.name = 'round_end' AND e.at >= s.started) AS round
       FROM starts s
      WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.client = s.client AND e.at >= s.started
                          AND e.name IN ('match_end', 'match_quit', 'online_end'))`,
    now - LIVE_LOOKBACK_MS,
  );
  return rows.map((r) => ({ client: String(r.client), started: Number(r.started), last: Number(r.last ?? r.started), round: r.round === null ? null : Number(r.round) }));
}

async function collect(db: D1Database, since: string) {
  const [visitors, started, finished, again, invited, guestsFinished] = await Promise.all([
    distinctClients(db, 'visit'),
    distinctClients(db, 'match_start'),
    distinctClients(db, 'match_end'),
    one(db, "SELECT COUNT(*) AS n FROM (SELECT client FROM events WHERE name = 'match_start' GROUP BY client HAVING COUNT(*) >= 2)"),
    distinctClients(db, 'invite_copy'),
    one(
      db,
      `SELECT COUNT(DISTINCT client) AS n FROM events WHERE name = 'online_end' AND client IN
         (SELECT client FROM events WHERE name = 'room_join' AND json_extract(data, '$.role') = 'guest')`,
    ),
  ]);
  const [daily, quits, tutorials, chapters, likes, comments, errors, ready, modes, sources] = await Promise.all([
    all(
      db,
      `SELECT day, json_extract(data, '$.device') AS device, COUNT(DISTINCT client) AS n FROM events
         WHERE name = 'visit' AND day >= ? GROUP BY day, device ORDER BY day`,
      since,
    ),
    all(db, `SELECT json_extract(data, '$.round') AS round, COUNT(*) AS n FROM events WHERE name = 'match_quit' GROUP BY round ORDER BY round`),
    all(
      db,
      `SELECT json_extract(data, '$.lesson') AS lesson,
              SUM(name = 'tutorial_start') AS started, SUM(name = 'tutorial_done') AS done
         FROM events WHERE name IN ('tutorial_start', 'tutorial_done') GROUP BY lesson ORDER BY started DESC`,
    ),
    all(db, `SELECT json_extract(data, '$.chapter') AS chapter, COUNT(*) AS n FROM events WHERE name = 'rules_open' GROUP BY chapter ORDER BY n DESC`),
    all(db, `SELECT json_extract(data, '$.like') AS like, COUNT(*) AS n FROM events WHERE name = 'feedback' GROUP BY like`),
    all(
      db,
      `SELECT day, json_extract(data, '$.like') AS like, json_extract(data, '$.text') AS text FROM events
         WHERE name = 'feedback' AND json_extract(data, '$.text') != '' ORDER BY at DESC LIMIT 30`,
    ),
    all(
      db,
      `SELECT json_extract(data, '$.message') AS message, json_extract(data, '$.screen') AS screen, COUNT(*) AS n FROM events
         WHERE name = 'client_error' AND day >= ? GROUP BY message, screen ORDER BY n DESC LIMIT 15`,
      since,
    ),
    all(db, `SELECT json_extract(data, '$.mode') AS mode, COUNT(*) AS n, AVG(json_extract(data, '$.ms')) AS avg FROM events WHERE name = 'table_ready' GROUP BY mode`),
    all(
      db,
      `SELECT json_extract(data, '$.mode') AS mode, SUM(name = 'match_start') AS started, SUM(name = 'match_end') AS finished
         FROM events WHERE name IN ('match_start', 'match_end') GROUP BY mode`,
    ),
    // Where visitors came from: the `?src=` tag of a shared link, or the referring domain.
    all(
      db,
      `SELECT json_extract(data, '$.from') AS source, COUNT(DISTINCT client) AS n FROM events
         WHERE name = 'visit' GROUP BY source ORDER BY n DESC LIMIT 15`,
    ),
  ]);
  const now = Date.now();
  return {
    live: liveReport(await openOnlineMatches(db, now), now),
    funnel: { visitors, started, finished, again, invited, guestsFinished },
    daily,
    quits,
    tutorials,
    chapters,
    likes,
    comments,
    errors,
    ready,
    modes,
    sources,
  };
}

export async function serveStats(
  request: Request,
  env: StatsEnv,
  allowed: (key: string, rule: WindowRule) => Promise<boolean>,
  ip: string,
): Promise<Response> {
  if (!env.ADMIN_KEY) return json({ error: '伺服器尚未設定 ADMIN_KEY' }, 503);
  const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!sameKey(given, env.ADMIN_KEY)) {
    if (!(await allowed(`admin:${ip}`, ADMIN_RULE))) return json({ error: '嘗試太多次，請稍後再試' }, 429);
    return json({ error: '管理密碼錯誤' }, 403);
  }
  const since = new Date(Date.now() + 8 * 3600_000 - DAYS_SHOWN * 86_400_000).toISOString().slice(0, 10);
  try {
    return json({ since, ...(await collect(env.ANALYTICS, since)) });
  } catch (error) {
    console.error('stats query failed', error);
    return json({ error: '讀取統計失敗' }, 500);
  }
}
