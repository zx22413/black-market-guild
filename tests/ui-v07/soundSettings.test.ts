import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMuted, setMuted, subscribeMuted } from '../../src/ui-v07/audio/soundSettings';

describe('mute setting', () => {
  afterEach(() => {
    setMuted(false);
    vi.unstubAllGlobals();
  });

  it('remembers the choice in this browser and tells listeners', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const heard: boolean[] = [];
    const stop = subscribeMuted(() => heard.push(isMuted()));
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect([...store.values()]).toEqual(['1']);
    stop();
    setMuted(false);
    expect(heard).toEqual([true]);
  });

  it('still mutes for this page when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    setMuted(true);
    expect(isMuted()).toBe(true);
  });
});
