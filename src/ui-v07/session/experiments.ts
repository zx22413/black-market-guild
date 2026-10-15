import { RULES_V07, type Rules } from '../../v07/game';

/**
 * Experiment (see scripts/broker-compare.ts): the broker's bet also names a ship. When the bet is
 * right, that ship sells the bet's good 2 steps (50 G per unit) further in the bet's direction:
 * down, the owner's loss goes to the broker; up, the bank pays the owner. By default the ship is an
 * opponent's; with `ownUp` a bull bet aims at the broker's own ship instead. Local matches only.
 */
export const brokerTargetRules = (ownUp: boolean): Rules => ({
  ...RULES_V07,
  roles: { ...RULES_V07.roles, broker: { ...RULES_V07.roles.broker, targetSteps: 2, targetOwnUp: ownUp ? 1 : 0 } },
});
