import { describe, expect, it } from 'vitest';
import { showcaseOf } from '../../src/ui/table/eventReveal';

describe('showcaseOf', () => {
  it('shows market and voyage reveals', () => {
    expect(showcaseOf({ type: 'market-event-revealed', round: 2, event: 'luxury-boom' })).toEqual({ kind: 'market', round: 2, event: 'luxury-boom' });
    expect(showcaseOf({ type: 'voyage-event-revealed', round: 3, event: 'storm' })).toEqual({ kind: 'voyage', round: 3, event: 'storm' });
  });

  it('ignores every other event', () => {
    expect(showcaseOf({ type: 'round-started', round: 1 })).toBeNull();
    expect(showcaseOf(undefined)).toBeNull();
  });
});
