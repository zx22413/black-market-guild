/** Fog banks drift within this half-extent around the table (wider than deep, like the table). */
export const FOG_AREA = { x: 120, z: 90 } as const;

export interface FogPuff {
  /** Offset from the bank's center on the sea plane. */
  readonly dx: number;
  readonly dz: number;
  /** Height of this layer of fog above the sea. */
  readonly height: number;
  /** Width of the puff. */
  readonly size: number;
  /** Phase of its slow thickening and thinning. */
  readonly phase: number;
  /** Which of the soft puff textures it uses. */
  readonly texture: number;
}

export interface FogBank {
  readonly x: number;
  readonly z: number;
  readonly puffs: readonly FogPuff[];
}

const BANKS = 9;
export const FOG_TEXTURES = 3;

/**
 * Fog banks spread over the table: clusters of wide, low puffs, a little longer along the wind
 * than across it, so they read as drifting sheets of mist.
 */
export function fogBanks(random: () => number): FogBank[] {
  return Array.from({ length: BANKS }, (): FogBank => {
    const puffs = 3 + Math.floor(random() * 4);
    return {
      x: (random() * 2 - 1) * FOG_AREA.x,
      z: (random() * 2 - 1) * FOG_AREA.z,
      puffs: Array.from({ length: puffs }, (): FogPuff => ({
        dx: (random() - 0.5) * 26,
        dz: (random() - 0.5) * 14,
        height: 0.4 + random() * 1.8,
        size: 14 + random() * 14,
        phase: random() * Math.PI * 2,
        texture: Math.floor(random() * FOG_TEXTURES),
      })),
    };
  });
}

/** Keeps a drifting coordinate within `[-half, half)`: whatever drifts off one side comes back in on the other. */
export function wrapAcross(value: number, half: number): number {
  const span = half * 2;
  return ((((value + half) % span) + span) % span) - half;
}
