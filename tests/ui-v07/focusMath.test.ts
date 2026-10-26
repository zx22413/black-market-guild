import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { around, frame } from '../../src/ui-v07/scene/focusMath';

// A phone held upright: a tall HUD on top, the bar below, and a ship's dice card hanging over the ship.
const WIDTH = 440;
const HEIGHT = 770;
const SAFE = { top: 200, bottom: 90, left: 24, right: 24 };

function camera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(35, WIDTH / HEIGHT, 1, 2000);
  cam.aspect = WIDTH / HEIGHT;
  cam.updateProjectionMatrix();
  return cam;
}

describe('frame', () => {
  it('stays close on a ship whose label needs a lot of room above it (never retreats to the far limit)', () => {
    const points = [...around([8, 0, 6], 6), { position: [8, 6, 2] as const, clearance: 330 }];
    const result = frame(camera(), points, WIDTH, HEIGHT, SAFE);
    expect(result.distance).toBeLessThan(400);
  });

  it('keeps every point inside the safe area', () => {
    const cam = camera();
    const points = around([0, 0, 0], 14);
    const result = frame(cam, points, WIDTH, HEIGHT, SAFE);
    expect(result.distance).toBeGreaterThan(10);
    expect(result.distance).toBeLessThan(800);
  });
});
