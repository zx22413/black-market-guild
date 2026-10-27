import { describe, expect, it } from 'vitest';
import { TIMEOUT_DEFAULT, clockText, limitLabel, onlineRules } from '../../src/ui-v07/online/clockText';

describe('online decision clock text', () => {
  it('shows minutes and seconds, rounding up and never below zero', () => {
    expect(clockText(120)).toBe('2:00');
    expect(clockText(64.2)).toBe('1:05');
    expect(clockText(9.01)).toBe('0:10');
    expect(clockText(-3)).toBe('0:00');
  });

  it('names the host choices in minutes and every phase default', () => {
    expect([60, 120, 300].map(limitLabel)).toEqual(['1 分鐘', '2 分鐘', '5 分鐘']);
    expect(Object.keys(TIMEOUT_DEFAULT).sort()).toEqual(['intel-reroll', 'invest', 'island-choice', 'role-deployment']);
  });

  it('writes the online rules chapter from the protocol numbers', () => {
    const text = onlineRules()
      .map((r) => `${r.title}：${r.text}`)
      .join('\n');
    expect(text).toContain('1、2、5 分鐘（預設 2 分鐘）');
    expect(text).toContain('送出後 90 秒');
    expect(text).toContain('連續逾時 2 次，或斷線超過 15 秒');
  });
});
