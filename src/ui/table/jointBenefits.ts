import type { AssetId, Rules } from '../../game';

export type BenefitTone = 'good' | 'note';

export interface BenefitLine {
  readonly tone: BenefitTone;
  readonly text: string;
}

export interface JointBenefits {
  /** What the viewer pays when the joint ship launches. */
  readonly yourShare: number;
  /** What the partner pays. */
  readonly partnerShare: number;
  /** Each owner's cut of the income if the ship arrives, before smuggling and market events. */
  readonly payoutEach: number;
  readonly lines: readonly BenefitLine[];
}

export interface JointBenefitsInput {
  /** `apply`: the viewer applies to a recruiter. `pick`: the viewer, a recruiter, picks an applicant. */
  readonly phase: 'apply' | 'pick';
  readonly viewerAssets: readonly AssetId[];
  readonly partnerAssets: readonly AssetId[];
  readonly rules: Rules;
}

/**
 * What teaming up with this guild means for the joint ship, from the public asset lists.
 * Mirrors docs/game-design.md §6 (cost split) and §8 (only the recruiter's assets add joint
 * bonuses; an owner's salvage and exchange never trigger on a ship they hold a share of).
 */
export function jointBenefits({ phase, viewerAssets, partnerAssets, rules }: JointBenefitsInput): JointBenefits {
  const recruiter = phase === 'apply' ? partnerAssets : viewerAssets;
  const applicant = phase === 'apply' ? viewerAssets : partnerAssets;
  const cut = rules.assets.shipyard.costReduction;
  const base = rules.jointShip.cost / 2;
  // Recruiter's own yard, or the applicant's discount from either yard — never stacked.
  const recruiterShare = base - (recruiter.includes('shipyard') ? cut : 0);
  const applicantShare = base - (recruiter.includes('shipyard') || applicant.includes('shipyard') ? cut : 0);
  const bonus = recruiter.includes('exchange') ? rules.assets.exchange.jointIncomeBonus : 0;
  const payoutEach = (rules.jointShip.income + bonus) / 2;

  const lines: BenefitLine[] = [];
  if (phase === 'apply') {
    if (partnerAssets.includes('shipyard')) {
      lines.push(
        viewerAssets.includes('shipyard')
          ? { tone: 'note', text: `造船廠不疊加，你的出資仍是 ${applicantShare} G` }
          : { tone: 'good', text: `對方造船廠：你的出資 −${cut} G` },
      );
    }
    if (partnerAssets.includes('exchange')) {
      lines.push({ tone: 'good', text: `對方貿易交易所：總收入 +${bonus} G（你多分 ${bonus / 2}）` });
    }
  } else if (viewerAssets.includes('shipyard') || viewerAssets.includes('exchange')) {
    lines.push({ tone: 'note', text: '加成只看發起人（你）的資產' });
  }
  if (partnerAssets.includes('salvage')) {
    lines.push({ tone: 'good', text: `對方有打撈公司：合資後他賺不到沉船 ${rules.assets.salvage.payout} G` });
  }
  if (partnerAssets.includes('exchange')) {
    lines.push({ tone: 'good', text: `對方有貿易交易所：合資後他賺不到抵達 ${rules.assets.exchange.payout} G` });
  }
  if (partnerAssets.includes('insurance')) {
    lines.push({ tone: 'note', text: `對方航運保險：沉沒補償 ${rules.assets.insurance.payout} G 只歸他` });
  }
  if (lines.length === 0) lines.push({ tone: 'note', text: '對方沒有強化這艘船的資產' });

  return {
    yourShare: phase === 'apply' ? applicantShare : recruiterShare,
    partnerShare: phase === 'apply' ? recruiterShare : applicantShare,
    payoutEach,
    lines,
  };
}
