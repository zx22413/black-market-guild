import { beforeEach, describe, expect, it } from 'vitest';
import { DEV_LOG, LATEST_VERSION } from '../../src/ui-v07/devlog/entries';
import { hasUnseenDevLog, markDevLogSeen, resetDevLogSeenForTest } from '../../src/ui-v07/devlog/seen';

describe('dev log entries', () => {
  it('lists each version once, newest first', () => {
    const versions = DEV_LOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    const dates = DEV_LOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(LATEST_VERSION).toBe(versions[0]);
  });

  it('has a summary and at least one non-empty section in every entry', () => {
    for (const entry of DEV_LOG) {
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.sections.length).toBeGreaterThan(0);
      for (const section of entry.sections) {
        expect(section.items.length).toBeGreaterThan(0);
        section.items.forEach((item) => expect(item.trim()).not.toBe(''));
      }
    }
  });
});

describe('dev log seen mark', () => {
  beforeEach(() => resetDevLogSeenForTest());

  it('is unseen until opened, then stays seen for that version', () => {
    markDevLogSeen('V9.9.1');
    expect(hasUnseenDevLog('V9.9.1')).toBe(false);
    expect(hasUnseenDevLog('V9.9.2')).toBe(true);
  });

  it('shows nothing when there are no entries', () => {
    expect(hasUnseenDevLog('')).toBe(false);
  });
});
