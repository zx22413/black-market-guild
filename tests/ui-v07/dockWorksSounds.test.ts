import { describe, expect, it } from 'vitest';
import { dockWorksSounds } from '../../src/ui-v07/audio/dockWorksSounds';
import { BAY_COUNT, WORKS_SCRIPT } from '../../src/ui-v07/scene/ships/dockWorksShow';

describe('sound of the dock works', () => {
  it('follows the whole show when a skill is opened', () => {
    const sounds = dockWorksSounds('build');
    expect(sounds.filter((s) => s.id === 'salute-splash')).toHaveLength(BAY_COUNT);
    const when = (id: string) => sounds.find((s) => s.id === id)?.at;
    expect(when('works-cloth')).toBe(WORKS_SCRIPT.build.cloth);
    expect(when('works-hammer')).toBe(WORKS_SCRIPT.build.smoke[0]);
    expect(when('works-unveil')).toBe(WORKS_SCRIPT.build.unveil);
    expect(sounds.map((s) => s.at)).toEqual([...sounds.map((s) => s.at)].sort((a, b) => a - b));
  });

  it('raises each next bay of piles a little higher', () => {
    const piles = dockWorksSounds('build').filter((s) => s.id === 'salute-splash').map((s) => s.rate);
    expect(piles).toEqual([...piles].sort((a, b) => a - b));
    expect(new Set(piles).size).toBe(BAY_COUNT);
  });

  it('ends the launch with the works going under', () => {
    const last = dockWorksSounds('launch').at(-1);
    expect(last).toMatchObject({ id: 'salute-splash', at: WORKS_SCRIPT.launch.strike });
  });

  it('is silent for works already standing, and only splashes as they are struck', () => {
    expect(dockWorksSounds('open')).toEqual([]);
    expect(dockWorksSounds('strike').map((s) => s.id)).toEqual(['salute-splash']);
  });
});
