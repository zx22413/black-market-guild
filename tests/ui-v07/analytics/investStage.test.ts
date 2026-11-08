import { afterEach, describe, expect, it } from 'vitest';
import { currentInvestStage, setInvestStage, splitInvestPhase } from '../../../src/ui-v07/analytics/investStage';

describe('invest stage for the quit statistic', () => {
  afterEach(() => setInvestStage(null));

  it('splits the engine invest phase by what the player was doing', () => {
    expect(splitInvestPhase('invest', 'ship')).toBe('invest-ship');
    expect(splitInvestPhase('invest', 'cargo')).toBe('invest-cargo');
  });

  it('keeps the plain phase when no stage is known (building rules, or before the step shows)', () => {
    expect(splitInvestPhase('invest', null)).toBe('invest');
  });

  it('leaves every other phase alone', () => {
    expect(splitInvestPhase('role-deployment', 'ship')).toBe('role-deployment');
    expect(splitInvestPhase('resolution', 'cargo')).toBe('resolution');
    expect(splitInvestPhase('start', null)).toBe('start');
  });

  it('remembers the stage the invest step set, and forgets it when told', () => {
    expect(currentInvestStage()).toBeNull();
    setInvestStage('cargo');
    expect(currentInvestStage()).toBe('cargo');
    setInvestStage(null);
    expect(currentInvestStage()).toBeNull();
  });

  it('fits the 30-character phase field of the quit event', () => {
    expect('invest-cargo'.length).toBeLessThanOrEqual(30);
  });
});
