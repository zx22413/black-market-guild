import { createContext, useContext } from 'react';
import { RULES_V07, type Rules } from '../../v07/game';

// The rules of the match on the table, for the components that word a rule (island lines, tide lines): the official
// rules unless the screen provides others (the V0.8 prototype at /v07.html?dev=round3d&v08, an experiment, not rules).
export const RulesContext = createContext<Rules>(RULES_V07);
export const useRules = (): Rules => useContext(RulesContext);
