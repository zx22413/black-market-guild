import { describe, expect, it } from 'vitest';
import { RULES_V06 } from '../../src/game';
import { jointBenefits } from '../../src/ui/table/jointBenefits';

const rules = RULES_V06;

describe('jointBenefits', () => {
  it('has no bonus without assets', () => {
    const b = jointBenefits({ phase: 'apply', viewerAssets: [], partnerAssets: [], rules });
    expect([b.yourShare, b.partnerShare, b.payoutEach]).toEqual([100, 100, 350]);
    expect(b.lines).toHaveLength(1);
    expect(b.lines[0]!.tone).toBe('note');
  });

  it("applying to a recruiter's shipyard and exchange lowers your share and lifts the payout", () => {
    const b = jointBenefits({ phase: 'apply', viewerAssets: [], partnerAssets: ['shipyard', 'exchange'], rules });
    expect(b.yourShare).toBe(50);
    expect(b.partnerShare).toBe(50);
    expect(b.payoutEach).toBe(400);
    expect(b.lines.map((l) => l.text).join('\n')).toContain('出資 −50 G');
  });

  it('does not stack the shipyard discount when the applicant owns one too', () => {
    const b = jointBenefits({ phase: 'apply', viewerAssets: ['shipyard'], partnerAssets: ['shipyard'], rules });
    expect(b.yourShare).toBe(50);
    expect(b.lines[0]!.tone).toBe('note');
  });

  it("an applicant's assets give the recruiter no joint bonus when picking", () => {
    const b = jointBenefits({ phase: 'pick', viewerAssets: [], partnerAssets: ['shipyard', 'exchange'], rules });
    expect(b.yourShare).toBe(100);
    // Their own shipyard still cuts their own share, but adds nothing for the recruiter.
    expect(b.partnerShare).toBe(50);
    expect(b.payoutEach).toBe(350);
  });

  it('uses the picker\'s own shipyard and exchange when picking', () => {
    const b = jointBenefits({ phase: 'pick', viewerAssets: ['shipyard', 'exchange'], partnerAssets: [], rules });
    expect(b.yourShare).toBe(50);
    expect(b.partnerShare).toBe(50);
    expect(b.payoutEach).toBe(400);
  });

  it('points out which payouts a salvage or exchange partner cannot collect on a shared ship', () => {
    const text = jointBenefits({ phase: 'pick', viewerAssets: [], partnerAssets: ['salvage', 'insurance'], rules })
      .lines.map((l) => l.text)
      .join('\n');
    expect(text).toContain(`${rules.assets.salvage.payout} G`);
    expect(text).toContain('航運保險');
  });
});
