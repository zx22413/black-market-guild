import { describe, expect, it } from 'vitest';
import { BANDS, bandSpan, crestAt, DROP_LIFE, dropAt, sprayFor, WIPE, WIPE_MS } from '../../src/ui-v07/table3d/waveWipeMath';

const H = 800;
const W = 1200;

describe('bandSpan', () => {
  it('starts below the screen, covers it, and leaves above it', () => {
    const crest = BANDS[0]!.crest;
    expect(bandSpan(0, H, crest).lead).toBeGreaterThan(H);
    const held = bandSpan(WIPE.swell + WIPE.cover + WIPE.hold / 2, H, crest);
    expect(held.lead).toBeLessThan(0);
    expect(held.trail).toBeGreaterThan(H);
    const gone = bandSpan(WIPE.swell + WIPE.cover + WIPE.hold + WIPE.reveal, H, crest);
    expect(gone.trail).toBeLessThan(0);
  });

  it('covers the whole screen with some band for a while in the middle of the wipe', () => {
    const covered = (t: number) =>
      BANDS.some((b) => {
        const s = bandSpan(t - b.delay, H, b.crest);
        return t > b.delay && s.lead < -b.crest && s.trail > H + b.crest;
      });
    const lastCover = BANDS[BANDS.length - 1]!.delay + WIPE.swell + WIPE.cover;
    expect(covered(lastCover + 10)).toBe(true);
    expect(covered(WIPE_MS)).toBe(false);
  });
});

describe('crestAt', () => {
  it('stays between 0 and 1 and is not the same shape for each band', () => {
    const xs = Array.from({ length: 200 }, (_, i) => i * 6);
    for (const b of BANDS) for (const x of xs) expect(crestAt(x, 100, b.seed)).toBeGreaterThanOrEqual(0);
    for (const x of xs) expect(crestAt(x, 100, BANDS[0]!.seed)).toBeLessThanOrEqual(1);
    const a = xs.map((x) => crestAt(x, 100, BANDS[0]!.seed));
    const b = xs.map((x) => crestAt(x, 100, BANDS[1]!.seed));
    expect(a).not.toEqual(b);
  });

  it('changes over time (the edge morphs as it moves)', () => {
    expect(crestAt(300, 0, 1)).not.toBeCloseTo(crestAt(300, 200, 1), 3);
  });
});

describe('spray', () => {
  it('is the same every time and leaves during the crest band\'s cover', () => {
    const a = sprayFor(W, H, 20);
    expect(a).toEqual(sprayFor(W, H, 20));
    const crest = BANDS[BANDS.length - 1]!;
    for (const d of a) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(W);
      expect(d.at).toBeGreaterThanOrEqual(crest.delay + WIPE.swell);
      expect(d.vy).toBeLessThan(0);
    }
  });

  it('flies up from where it left, then falls and is gone after its life', () => {
    const d = sprayFor(W, H, 1)[0]!;
    expect(dropAt(d, d.at - 1, 400, H)).toBeNull();
    const early = dropAt(d, d.at + 40, 400, H)!;
    expect(early.y).toBeLessThan(400);
    expect(dropAt(d, d.at + DROP_LIFE + 1, 400, H)).toBeNull();
  });
});
