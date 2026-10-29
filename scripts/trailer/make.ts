import { SFX_GAIN, SOUND_FILES, type SfxId } from '../../src/ui-v07/audio/soundPlan';
import { args, childProcess, fs } from './node';
import { BEDS, CARDS, CARRY_ON, HITS, ORDER, SHOTS, SKIP_SOUNDS, TAKE_IDS, shotIn, takeOf, type CutTime, type Format, type Shot } from './plan';

// Makes the trailer from plan.ts: films the takes (capture.ts), saves the overlays (still.ts),
// then cuts, captions and scores it with ffmpeg. Needs the dev server (npm run dev):
//
//   node --experimental-websocket --import tsx scripts/trailer/make.ts --work <dir> --out trailer.mp4 [--format tall] [--skip-film] [--skip-cards]
//
// --format tall makes the portrait cut (1080×1920, phone layout) for IG stories and Threads.
//
// --skip-film / --skip-cards reuse what an earlier run left in <work> (to retime the edit only).

const FPS = 60;
const AUDIO = 'public/audio';
/** The one-shots' level when the game has none of its own for them (soundPlan's MIX.sfx is for a room, this is a mix). */
const SFX_LEVEL = 0.8;
/** Seconds a ducked bed takes to go down, and to come back up. */
const DUCK_RAMP = 0.6;

const opts = args();
const work = opts.get('work')?.[0];
const out = opts.get('out')?.[0];
if (!work || !out) throw new Error('--work and --out are required');
const format: Format = opts.get('format')?.[0] === 'tall' ? 'tall' : 'wide';
const run = (file: string, list: readonly string[]): void => void childProcess.execFileSync(file, list, { stdio: 'inherit' });
const tsx = (script: string, list: readonly string[]): void => run('node', ['--experimental-websocket', '--import', 'tsx', `scripts/trailer/${script}`, ...list]);

const shot = (name: string): Shot => {
  const s = SHOTS.find((x) => x.name === name);
  if (!s) throw new Error(`no shot ${name}`);
  return shotIn(s, format);
};

// 1. Film every take: its shots are its clips.
if (!opts.has('skip-film')) {
  for (const take of TAKE_IDS) {
    const dir = `${work}/takes/${take}`;
    fs.rmSync(dir, { recursive: true, force: true });
    const clips = SHOTS.filter((s) => s.take === take).map((s) => shotIn(s, format)).flatMap((s) => ['--clip', `${s.name}:${s.from}-${s.to}:${s.slow}`]);
    const { page, size, scale } = takeOf(take, format);
    tsx('capture.ts', ['--page', page, '--out', dir, '--fps', String(FPS), '--size', size, '--scale', String(scale), ...clips]);
  }
}

// 2. The overlays.
const cardFile = (i: number): string => `${work}/cards/card-${i}.png`;
if (!opts.has('skip-cards')) {
  fs.mkdirSync(`${work}/cards`, { recursive: true });
  CARDS.forEach((c, i) => {
    const query = `dev=trailer&part=card${format === 'tall' ? '&format=tall' : ''}&card=${c.card}${c.text ? `&text=${encodeURIComponent(c.text)}` : ''}${c.place ? `&place=${c.place}` : ''}`;
    const { size, scale } = takeOf('open', format);
    tsx('still.ts', ['--page', query, '--out', cardFile(i), '--size', size, '--scale', String(scale)]);
  });
}

// 3. Where each shot lands in the cut.
const framesOf = (s: Shot): number => fs.readdirSync(`${work}/takes/${s.take}/${s.name}`).filter((f) => f.endsWith('.jpg')).length;
const starts = new Map<string, number>();
let total = 0;
for (const name of ORDER) {
  starts.set(name, total);
  total += framesOf(shot(name)) / FPS;
}
const cutAt = ([name, seconds]: CutTime): number => (starts.get(name) ?? 0) + seconds;
const shotEnd = (name: string): number => cutAt([name, framesOf(shot(name)) / FPS]);
console.log(`cut: ${total.toFixed(2)} s`);

const inputs: string[] = [];
const graph: string[] = [];
let n = 0;
const input = (list: readonly string[]): number => {
  inputs.push(...list);
  return n++;
};

// 4. Picture: the shots end to end (the first out of a white flash), the cards over them.
const shotInputs = ORDER.map((name) => input(['-framerate', String(FPS), '-i', `${work}/takes/${shot(name).take}/${name}/frame-%05d.jpg`]));
graph.push(`[${shotInputs[0]}:v]fade=t=in:st=0:d=0.5:color=white[s0]`);
graph.push(`[s0]${shotInputs.slice(1).map((i) => `[${i}:v]`).join('')}concat=n=${shotInputs.length}:v=1:a=0,format=yuv420p[v0]`);
let video = 'v0';
CARDS.forEach((c, i) => {
  const start = cutAt([c.shot, c.at]);
  const end = c.card === 'end' ? total : c.until !== undefined ? cutAt([c.shot, c.until]) : shotEnd(CARRY_ON[c.shot] ?? c.shot);
  const length = end - start;
  // The end card's still runs a second past the cut, so it is still up on the very last frame.
  const k = input(['-loop', '1', '-t', (length + (c.card === 'end' ? 1 : 0)).toFixed(3), '-i', cardFile(i)]);
  const fadeOut = c.card === 'end' ? '' : `,fade=t=out:st=${(length - 0.2).toFixed(3)}:d=0.2:alpha=1`;
  graph.push(`[${k}:v]format=rgba,fade=t=in:st=0:d=${c.card === 'end' ? 0.6 : 0.2}:alpha=1${fadeOut},setpts=PTS-STARTPTS+${start.toFixed(3)}/TB[c${i}]`);
  const enable = c.card === 'end' ? `gte(t,${start.toFixed(3)})` : `between(t,${start.toFixed(3)},${end.toFixed(3)})`;
  graph.push(`[${video}][c${i}]overlay=eof_action=${c.card === 'end' ? 'repeat' : 'pass'}:enable='${enable}'[v${i + 1}]`);
  video = `v${i + 1}`;
});

// 5. Sound: the beds, the game's own one-shots where the takes played them, the extra hits.
interface Cue {
  readonly sound: string;
  readonly at: number;
}
const cuesOf = (take: Shot['take']): readonly Cue[] => (JSON.parse(fs.readFileSync(`${work}/takes/${take}/marks.json`, 'utf8')) as { cues: Cue[] }).cues;
const fileOf = (sound: string): string | null => {
  const entry = SOUND_FILES[sound as SfxId] as string | { licensed: string; fallback: string | null } | undefined;
  // The licensed cuts stay out of the trailer (their licence covers the game); their generated stand-ins go in.
  return entry === undefined ? null : typeof entry === 'string' ? entry : entry.fallback;
};
const tracks: string[] = [];
const delayed = (k: number, at: number, filters: string): void => {
  const ms = Math.max(0, Math.round(at * 1000));
  graph.push(`[${k}:a]${filters}adelay=${ms}|${ms}[a${tracks.length}]`);
  tracks.push(`[a${tracks.length}]`);
};
for (const bed of BEDS) {
  const from = cutAt(bed.from);
  const to = bed.to === 'end' ? total : cutAt(bed.to);
  const k = input(['-stream_loop', '-1', '-i', `${AUDIO}/${bed.file}`]);
  const length = to - from;
  // A duck is a level that eases down over DUCK_RAMP seconds and back up, in the bed's own time.
  const duck = bed.duck
    ? (() => {
        const a = (cutAt(bed.duck.from) - from).toFixed(3);
        const b = (cutAt(bed.duck.to) - from).toFixed(3);
        const down = `min(1,max(0,min((t-${a})/${DUCK_RAMP},(${b}-t)/${DUCK_RAMP})))`;
        return `volume=eval=frame:volume='1-${(1 - bed.duck.level).toFixed(3)}*${down}',`;
      })()
    : '';
  delayed(k, from, `atrim=0:${length.toFixed(3)},afade=t=in:d=${bed.fadeIn},afade=t=out:st=${(length - bed.fadeOut).toFixed(3)}:d=${bed.fadeOut},${duck}volume=${bed.gain},`);
}
for (const name of ORDER) {
  const s = shot(name);
  for (const c of cuesOf(s.take)) {
    if (c.at < s.from || c.at >= s.to || c.sound.startsWith('bed:') || SKIP_SOUNDS.has(c.sound)) continue;
    const file = fileOf(c.sound);
    if (!file) continue;
    const k = input(['-i', `${AUDIO}/${file}`]);
    delayed(k, cutAt([name, ((c.at - s.from) * s.slow) / 1000]), `volume=${SFX_GAIN[c.sound as SfxId] ?? SFX_LEVEL},`);
  }
}
for (const hit of HITS) delayed(input(['-i', `${AUDIO}/${hit.file}`]), cutAt(hit.at), `${hit.fadeIn ? `afade=t=in:d=${hit.fadeIn},` : ''}volume=${hit.gain},`);
graph.push(`${tracks.join('')}amix=inputs=${tracks.length}:normalize=0,alimiter=limit=0.9,atrim=0:${total.toFixed(3)}[a]`);

// 6. Encode.
fs.writeFileSync(`${work}/graph.txt`, graph.join(';\n'));
run('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  ...inputs,
  '-/filter_complex',
  `${work}/graph.txt`,
  '-map',
  `[${video}]`,
  '-map',
  '[a]',
  '-t',
  total.toFixed(3),
  '-r',
  String(FPS),
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
  out,
]);
console.log(`saved ${out} (${total.toFixed(1)} s)`);
