import { describe, expect, it } from 'vitest';
import { RULES_V06 } from '../../src/game';
import { tipText } from '../../src/ui/components/InfoTip';

describe('info tips', () => {
  it('explains an asset with numbers taken from the rules', () => {
    const rules = { ...RULES_V06, assets: { ...RULES_V06.assets, shipyard: { ...RULES_V06.assets.shipyard, costReduction: 77 } } };
    expect(tipText({ kind: 'asset', asset: 'shipyard' }, rules)).toMatchObject({ title: '造船廠', note: null });
    expect(tipText({ kind: 'asset', asset: 'shipyard' }, rules)?.body).toContain('77');
  });

  it('names the role and its target, and marks secret or caught cards', () => {
    const role = { kind: 'role', role: 'smuggler', target: '→ 黑潮會的船', secret: true, caught: false } as const;
    expect(tipText(role, RULES_V06)).toMatchObject({ title: '走私商人 → 黑潮會的船', note: '只有你看得到' });
    expect(tipText({ ...role, secret: false, caught: true }, RULES_V06)?.note).toBe('已被護衛查獲');
    expect(tipText({ ...role, secret: false }, RULES_V06)?.note).toBeNull();
  });

  it('has no bubble for in-place expansions', () => {
    expect(tipText({ kind: 'inline' }, RULES_V06)).toBeNull();
  });
});
