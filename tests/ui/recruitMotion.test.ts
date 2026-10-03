import { describe, expect, it } from 'vitest';
import {
  ENVELOPE_RIP_MS,
  ENVELOPE_SHAKE_MS,
  HANDSHAKE_POP_MS,
  SCROLL_TEAR_SHAKE_MS,
  SCROLL_UNROLL_END_MS,
  SCROLL_UNROLL_START_MS,
  bob,
  easeOutBack,
  envelopeMotion,
  handshakeMotion,
  medalDrop,
  scrollHold,
  scrollIntro,
  scrollTear,
  scrollWithdraw,
} from '../../src/ui/scene/recruitMotion';

describe('recruitment prop motion', () => {
  it('springs past 1 and settles', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
    expect(Math.max(...Array.from({ length: 20 }, (_, i) => easeOutBack(i / 19)))).toBeGreaterThan(1);
  });

  it('pops the scroll up rolled, unrolls it, then shows the medal', () => {
    const start = scrollIntro(0);
    expect(start.scale).toBeCloseTo(0, 5);
    expect(start.unroll).toBe(0);
    const middle = scrollIntro((SCROLL_UNROLL_START_MS + SCROLL_UNROLL_END_MS) / 2);
    expect(middle.unroll).toBeGreaterThan(0.2);
    expect(middle.unroll).toBeLessThan(0.8);
    expect(middle.medal).toBe(0);
    const done = scrollIntro(2000);
    expect([done.scale, done.unroll, done.medal, done.opacity]).toEqual([1, 1, 1, 1]);
  });

  it('keeps a held scroll open until it rolls up and fades at the very end', () => {
    expect(scrollHold(100, 1000).opacity).toBe(1);
    expect(scrollHold(100, 1000).unroll).toBe(1);
    expect(scrollHold(1000, 1000).opacity).toBe(0);
    expect(scrollHold(1000, 1000).unroll).toBeLessThan(0.3);
  });

  it('rolls a withdrawn scroll up first, then lets it drift up and fade', () => {
    const rolled = scrollWithdraw(600, 1500);
    expect(rolled.unroll).toBeCloseTo(0, 5);
    expect(rolled.opacity).toBeCloseTo(1, 5);
    const gone = scrollWithdraw(1500, 1500);
    expect(gone.opacity).toBeCloseTo(0, 5);
    expect(gone.lift).toBeGreaterThan(0);
  });

  it('shakes a failed scroll before tearing it, then fades the halves out', () => {
    const shaking = Array.from({ length: 10 }, (_, i) => scrollTear(30 + i * 37, 1200).shake);
    expect(Math.max(...shaking.map(Math.abs))).toBeGreaterThan(0.02);
    expect(scrollTear(SCROLL_TEAR_SHAKE_MS - 10, 1200).apart).toBe(0);
    expect(scrollTear(1200, 1200).apart).toBeCloseTo(1, 5);
    expect(scrollTear(1200, 1200).opacity).toBeCloseTo(0, 5);
    expect(scrollTear(1200, 1200).shake).toBe(0);
  });

  it('drops the medal off a torn scroll', () => {
    expect(medalDrop(SCROLL_TEAR_SHAKE_MS, 1200).drop).toBe(0);
    expect(medalDrop(1200, 1200).drop).toBeGreaterThan(1);
    expect(medalDrop(1200, 1200).opacity).toBeCloseTo(0, 5);
  });

  it('pops the envelope in, holds still, shakes, then rips', () => {
    expect(envelopeMotion(0, 1900).scale).toBeCloseTo(0, 5);
    const still = envelopeMotion(ENVELOPE_SHAKE_MS - 20, 1900);
    expect([still.shake, still.apart]).toEqual([0, 0]);
    expect(envelopeMotion(ENVELOPE_RIP_MS - 1, 1900).apart).toBe(0);
    expect(envelopeMotion(1900, 1900).apart).toBeCloseTo(1, 5);
  });

  it('springs the handshake up with a spreading ring and shrinks it away at the end', () => {
    expect(handshakeMotion(0, 2100).scale).toBeCloseTo(0, 5);
    const peak = Math.max(...Array.from({ length: 30 }, (_, i) => handshakeMotion((i / 29) * HANDSHAKE_POP_MS, 2100).scale));
    expect(peak).toBeGreaterThan(1.05);
    expect(handshakeMotion(1200, 2100).ring).toBeCloseTo(1, 1);
    expect(handshakeMotion(1200, 2100).ringOpacity).toBeLessThan(0.1);
    expect(handshakeMotion(2100, 2100).opacity).toBeCloseTo(0, 5);
  });

  it('floats gently', () => {
    const samples = Array.from({ length: 50 }, (_, i) => bob(i / 10));
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.18);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-0.18);
  });
});
