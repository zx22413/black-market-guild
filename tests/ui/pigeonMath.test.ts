import { describe, expect, it } from 'vitest';
import { FLIGHT_ARC, PIGEON_SCALE, flightPose, wingAngle } from '../../src/ui/scene/pigeonMath';
import type { Vec3 } from '../../src/ui/scene/layout';

const FROM: Vec3 = [0, 8, 40];
const TO: Vec3 = [-45, 8, 0];

describe('pigeon flight', () => {
  it('takes off small, reaches full size in flight and shrinks into the landing', () => {
    expect(flightPose(FROM, TO, 0).scale).toBe(0);
    expect(flightPose(FROM, TO, 0.5).scale).toBeCloseTo(PIGEON_SCALE, 5);
    expect(flightPose(FROM, TO, 1).scale).toBe(0);
  });

  it('starts over the sender, ends over the recruiter and rises in between', () => {
    expect(flightPose(FROM, TO, 0).position).toEqual(FROM);
    const end = flightPose(FROM, TO, 1).position;
    expect(end[0]).toBeCloseTo(TO[0], 5);
    expect(end[2]).toBeCloseTo(TO[2], 5);
    expect(flightPose(FROM, TO, 0.5).position[1]).toBeCloseTo(8 + FLIGHT_ARC, 5);
  });

  it('heads toward the recruiter the whole way', () => {
    const heading = flightPose(FROM, TO, 0.4).heading;
    // +z of the model points along (dx, dz) = (−45, −40): atan2(dx, dz).
    expect(heading).toBeCloseTo(Math.atan2(-45, -40), 5);
    expect(flightPose(FROM, TO, 0.8).heading).toBeCloseTo(heading, 5);
  });

  it('clamps progress outside the flight', () => {
    expect(flightPose(FROM, TO, -1).position).toEqual(FROM);
    expect(flightPose(FROM, TO, 3).scale).toBe(0);
  });

  it('flaps its wings both up and down, more gently near the landing', () => {
    const samples = Array.from({ length: 40 }, (_, i) => wingAngle(i / 40 / 3.2, 0.3));
    expect(Math.max(...samples)).toBeGreaterThan(0.5);
    expect(Math.min(...samples)).toBeLessThan(-0.3);
    const late = Array.from({ length: 40 }, (_, i) => wingAngle(i / 40 / 3.2, 1));
    expect(Math.max(...late) - Math.min(...late)).toBeLessThan(Math.max(...samples) - Math.min(...samples));
  });
});
