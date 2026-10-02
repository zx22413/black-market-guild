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
          ? { tone: 'note', text: `對方的造船廠與你自己的不疊加，出資仍是 ${applicantShare} G` }
          : { tone: 'good', text: `對方的造船廠：你的出資 −${cut} G` },
      );
    }
    if (partnerAssets.includes('exchange')) {
      lines.push({ tone: 'good', text: `對方的貿易交易所：抵達時總收入 +${bonus} G，你多分 ${bonus / 2} G` });
    }
  } else if (viewerAssets.includes('shipyard') || viewerAssets.includes('exchange')) {
    lines.push({ tone: 'note', text: '合資加成只看發起人（你）的資產，對方的資產不提供加成' });
  }
  if (partnerAssets.includes('salvage')) {
    lines.push({ tone: 'good', text: `對方持有打撈公司：與他合資，這艘船沉沒時他賺不到 ${rules.assets.salvage.payout} G` });
  }
  if (partnerAssets.includes('exchange')) {
    lines.push({ tone: 'good', text: `對方持有貿易交易所：與他合資，這艘船抵達時他賺不到 ${rules.assets.exchange.payout} G` });
  }
  if (partnerAssets.includes('insurance')) {
    lines.push({ tone: 'note', text: `對方的航運保險：沉沒時的 ${rules.assets.insurance.payout} G 補償只歸他本人` });
  }
  if (lines.length === 0) lines.push({ tone: 'note', text: '對方沒有能強化這艘船的資產，只有基本收益' });

  return {
    yourShare: phase === 'apply' ? applicantShare : recruiterShare,
    partnerShare: phase === 'apply' ? recruiterShare : applicantShare,
    payoutEach,
    lines,
  };
}
