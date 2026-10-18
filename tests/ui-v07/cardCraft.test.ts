import { describe, expect, it } from 'vitest';
import { cardLean, pointerTilt, roughEdge } from '../../src/ui-v07/table3d/cardCraft';

const points = (path: string): [number, number][] =>
  path
    .replace(/^polygon\(|\)$/g, '')
    .split(',')
    .map((p) => p.trim().split(' ').map((v) => Number.parseFloat(v)) as [number, number]);

describe('roughEdge', () => {
  it('is the same polygon every time for the same card', () => {
    expect(roughEdge('lighthouse')).toBe(roughEdge('lighthouse'));
  });

  it('differs between cards', () => {
    expect(roughEdge('lighthouse')).not.toBe(roughEdge('fortress'));
  });

  it('stays within the card and only nibbles at its edge', () => {
    const all = points(roughEdge('mine', { depth: 1.2 }));
    expect(all.length).toBeGreaterThan(20);
    for (const [x, y] of all) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      // Every point lies in the band along one of the four sides.
      const nearSide = Math.min(x, 100 - x, y, 100 - y);
      expect(nearSide).toBeLessThanOrEqual(1.2);
    }
  });

  it('walks round the card clockwise from the top left', () => {
    const all = points(roughEdge('lumber'));
    const first = all[0]!;
    expect(first[0]).toBeLessThan(5);
    expect(first[1]).toBeLessThan(5);
    // The top side goes left to right.
    const top = all.filter(([, y]) => y < 2);
    for (let i = 1; i < top.length; i++) expect(top[i]![0]).toBeGreaterThanOrEqual(top[i - 1]![0]);
  });
});

describe('cardLean', () => {
  it('leans each card a fixed small amount', () => {
    for (const id of ['spice-isles', 'pirate-cove', 'lumber', 'mine', 'smuggler-port', 'free-port', 'fortress', 'lighthouse']) {
      const lean = cardLean(id);
      expect(Math.abs(lean)).toBeLessThanOrEqual(1.5);
      expect(cardLean(id)).toBe(lean);
    }
  });
});

describe('pointerTilt', () => {
  it('is flat with the pointer in the middle', () => {
    const t = pointerTilt(100, 150, 200, 300, 8);
    expect(t.rotateX).toBeCloseTo(0);
    expect(t.rotateY).toBeCloseTo(0);
    expect(t.glareX).toBeCloseTo(50);
    expect(t.glareY).toBeCloseTo(50);
  });

  it('presses the corner under the pointer away from the viewer', () => {
    const t = pointerTilt(200, 0, 200, 300, 8);
    // Top right: in CSS, positive rotateX tips the top away and positive rotateY turns the right side away.
    expect(t.rotateX).toBeCloseTo(8);
    expect(t.rotateY).toBeCloseTo(8);
    expect(t.glareX).toBeCloseTo(100);
    expect(t.glareY).toBeCloseTo(0);
  });

  it('clamps a pointer outside the card', () => {
    const t = pointerTilt(-50, 400, 200, 300, 8);
    expect(t.rotateX).toBeCloseTo(-8);
    expect(t.rotateY).toBeCloseTo(-8);
  });

  it('is flat for an empty card', () => {
    expect(pointerTilt(10, 10, 0, 0, 8)).toEqual({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  });
});
