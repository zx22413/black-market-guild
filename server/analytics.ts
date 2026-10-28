// Writes the game's anonymous play statistics to D1 (docs/online/public-launch-plan.md §4).
// Only events and fields from src/analytics/events.ts get through; no IP address is stored.
import { checkBatch, taipeiDay } from '../src/analytics/events';
import { EVENTS_RULE, type WindowRule } from './limits';

interface AnalyticsEnv {
  readonly ANALYTICS: D1Database;
}

/** Largest request body read, well above 50 small events. */
const MAX_BODY_BYTES = 32 * 1024;

export async function recordEvents(
  request: Request,
  env: AnalyticsEnv,
  allowed: (key: string, rule: WindowRule) => Promise<boolean>,
  ip: string,
): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  if (!(await allowed(`events:${ip}`, EVENTS_RULE))) return new Response(null, { status: 429 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const now = Date.now();
  const batch = checkBatch(body, now);
  if (batch === null) return new Response(null, { status: 400 });
  if (batch.events.length === 0) return new Response(null, { status: 204 });
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;
  const insert = env.ANALYTICS.prepare(
    'INSERT INTO events (at, received, day, client, name, data, country) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  try {
    await env.ANALYTICS.batch(
      batch.events.map((e) => insert.bind(e.at, now, taipeiDay(e.at), batch.client, e.name, JSON.stringify(e.data), country)),
    );
  } catch (error) {
    console.error('analytics write failed', error);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
