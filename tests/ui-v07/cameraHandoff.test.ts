import { beforeEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { blendPose, clearHandoff, HANDOFF_FRESH_MS, recordPose, takePose, type CameraPose } from '../../src/ui-v07/scene/cameraHandoff';

const table: CameraPose = { position: [0, 90, 60], aim: [0, 0, 0], fov: 38, offset: [0, 0] };
const ship: CameraPose = { position: [40, 4, 20], aim: [30, 1.6, 18], fov: 40, offset: [20, -30] };

describe('blendPose', () => {
  it('starts at the first pose and ends at the second', () => {
    expect(blendPose(table, ship, 0)).toEqual(table);
    expect(blendPose(table, ship, 1)).toEqual(ship);
  });

  it('keeps the camera high while diving, so it crosses the islands before it drops', () => {
    const mid = blendPose(table, ship, 0.5);
    const across = (mid.position[0] - table.position[0]) / (ship.position[0] - table.position[0]);
    const down = (table.position[1] - mid.position[1]) / (table.position[1] - ship.position[1]);
    expect(down).toBeLessThan(across);
  });

  it('lifts the camera off the water first when climbing back', () => {
    const mid = blendPose(ship, table, 0.5);
    const across = (mid.position[0] - ship.position[0]) / (table.position[0] - ship.position[0]);
    const up = (mid.position[1] - ship.position[1]) / (table.position[1] - ship.position[1]);
    expect(up).toBeGreaterThan(across);
  });

  it('clamps t outside 0..1', () => {
    expect(blendPose(table, ship, -1)).toEqual(table);
    expect(blendPose(table, ship, 2)).toEqual(ship);
  });
});

describe('takePose', () => {
  beforeEach(() => clearHandoff());

  it('hands over a fresh pose from the named rig on the same camera', () => {
    const camera = new PerspectiveCamera();
    recordPose('table', camera, table, 1000);
    expect(takePose('table', camera, 1000 + HANDOFF_FRESH_MS)).toEqual(table);
  });

  it('cuts when the pose is stale, from the other rig, or from another canvas', () => {
    const camera = new PerspectiveCamera();
    recordPose('table', camera, table, 1000);
    expect(takePose('table', camera, 1001 + HANDOFF_FRESH_MS)).toBeNull();
    expect(takePose('ship', camera, 1000)).toBeNull();
    expect(takePose('table', new PerspectiveCamera(), 1000)).toBeNull();
  });
});

describe('flight state', () => {
  it('is off when no flight has started', async () => {
    const { isFlying, subscribeFlight } = await import('../../src/ui-v07/scene/cameraHandoff');
    expect(isFlying()).toBe(false);
    const unsubscribe = subscribeFlight(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
