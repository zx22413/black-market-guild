import { describe, expect, it } from 'vitest';
import { layoutFor } from '../../src/ui/table/useLayout';

describe('table layout', () => {
  it('uses the desktop layout on wide screens', () => {
    expect(layoutFor(1440, 900)).toBe('desktop');
    expect(layoutFor(1024, 768)).toBe('desktop');
  });

  it('uses the upright phone layout on narrow screens', () => {
    expect(layoutFor(375, 812)).toBe('portrait');
    expect(layoutFor(430, 932)).toBe('portrait');
  });

  it('uses the short layout for a phone on its side', () => {
    expect(layoutFor(812, 375)).toBe('landscape');
    expect(layoutFor(932, 430)).toBe('landscape');
  });
});
