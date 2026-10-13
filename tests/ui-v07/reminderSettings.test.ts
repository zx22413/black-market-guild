import { afterEach, describe, expect, it, vi } from 'vitest';
import { isReminderSkipped, setReminderSkipped } from '../../src/ui-v07/table/reminderSettings';

describe('"不再提醒" setting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('remembers the choice in this browser', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    expect(isReminderSkipped('invest-unfinished')).toBe(false);
    setReminderSkipped('invest-unfinished', true);
    expect(isReminderSkipped('invest-unfinished')).toBe(true);
    setReminderSkipped('invest-unfinished', false);
    expect(isReminderSkipped('invest-unfinished')).toBe(false);
  });

  it('keeps reminding when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => setReminderSkipped('invest-unfinished', true)).not.toThrow();
    expect(isReminderSkipped('invest-unfinished')).toBe(false);
  });
});
