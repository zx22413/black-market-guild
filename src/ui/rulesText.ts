import type { AssetId, MarketEventId, RoleId, Rules, VoyageEventId } from '../game';

// Short player-facing summaries of docs/game-design.md; numbers always come from Rules.

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export function assetText(asset: AssetId, r: Rules): string {
  const a = r.assets;
  switch (asset) {
    case 'shipyard':
      return `本人每次航運成本 −${a.shipyard.costReduction} G。發起合資時，應徵者出資也 −${a.shipyard.costReduction} G。`;
    case 'insurance':
      return `投資的船沉沒時獲得 ${a.insurance.payout} G（每回合 ${a.insurance.maxPayoutsPerRound} 次）；本人護衛效果 +${a.insurance.guardRollBonus}。`;
    case 'salvage':
      return `他人的船沉沒時每艘獲得 ${a.salvage.payout} G（每回合最多 ${a.salvage.maxPayoutsPerRound} 次）。`;
    case 'exchange':
      return `他人的船抵達時每艘獲得 ${a.exchange.payout} G（每回合最多 ${a.exchange.maxPayoutsPerRound} 次）；發起的合資船抵達時總收入 +${a.exchange.jointIncomeBonus} G。`;
  }
}

export function roleText(role: RoleId, r: Rules): string {
  const roles = r.roles;
  switch (role) {
    case 'intel':
      return '查看目標船的原始骰值，並決定是否重擲（必須接受新結果）。';
    case 'guard':
      return `目標船骰值 ${signed(roles.guard.rollModifier)}；船抵達時查獲他人的走私。`;
    case 'pirate':
      return `目標船骰值 ${signed(roles.pirate.modifier)}；船沉沒時與其他海盜均分 ${roles.pirate.loot} G 戰利品。`;
    case 'smuggler':
      return `匿名。船抵達且未被查獲時，取走 ${roles.smuggler.goodsValue} G 存為黑錢；被護衛查獲則罰款 ${roles.smuggler.caughtFine} G。`;
  }
}

export function marketEventText(event: MarketEventId, r: Rules): string {
  const m = r.marketEvents;
  switch (event) {
    case 'royal-joint-order':
      return `合資船成功時，總收入 +${m.royalJointOrderBonus} G。`;
    case 'private-trade-charter':
      return `獨資船成功時，額外 +${m.privateTradeCharterBonus} G。`;
    case 'black-market-bounty':
      return `海盜擊沉船時，戰利品 +${m.blackMarketBountyBonus} G。`;
    case 'sea-danger-warning':
      return `所有船航行骰值 ${signed(m.seaDangerWarningModifier)}。`;
    case 'luxury-boom':
      return `所有抵達的船，總收入 +${m.luxuryBoomBonus} G。`;
    case 'salvage-boom':
      return `打撈公司每次收益提高為 ${m.salvageBoomPayout} G。`;
  }
}

export function voyageEventText(event: VoyageEventId, r: Rules): string {
  const v = r.voyageEvents;
  switch (event) {
    case 'tailwind':
      return `所有船 ${signed(v.tailwindModifier)}。`;
    case 'storm':
      return `所有船 ${signed(v.stormModifier)}。`;
    case 'sea-fog':
      return `被海盜鎖定的船 ${signed(v.seaFogModifier)}。`;
    case 'moonless-night':
      return `被護衛鎖定的船 ${signed(v.moonlessNightModifier)}。`;
    case 'high-waves':
      return `獨資船 ${signed(v.highWavesModifier)}。`;
    case 'black-market-rush':
      return `走私貨價值提高為 ${v.blackMarketRushGoodsValue} G。`;
    case 'calm-seas':
      return '無效果。';
  }
}
