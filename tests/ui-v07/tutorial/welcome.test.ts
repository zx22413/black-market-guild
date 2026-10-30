import { beforeEach, describe, expect, it, vi } from 'vitest';

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  } as Storage;
}

describe('tutorial welcome prompt', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', fakeStorage());
  });

  it('asks a fresh browser once, then never again', async () => {
    const { shouldAskTutorial, markTutorialAsked } = await import('../../../src/ui-v07/tutorial/welcome');
    expect(shouldAskTutorial(false)).toBe(true);
    markTutorialAsked();
    expect(shouldAskTutorial(false)).toBe(false);
    vi.resetModules();
    const again = await import('../../../src/ui-v07/tutorial/welcome');
    expect(again.shouldAskTutorial(false)).toBe(false);
  });

  it('does not ask someone who already finished the basics', async () => {
    const { shouldAskTutorial } = await import('../../../src/ui-v07/tutorial/welcome');
    expect(shouldAskTutorial(true)).toBe(false);
  });

  it('asks once per page when storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const { shouldAskTutorial, markTutorialAsked } = await import('../../../src/ui-v07/tutorial/welcome');
    expect(shouldAskTutorial(false)).toBe(true);
    markTutorialAsked();
    expect(shouldAskTutorial(false)).toBe(false);
  });
});
