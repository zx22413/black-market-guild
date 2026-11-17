import type { TideKind } from '../../v07/game';
import { useRules } from './rulesContext';
import { TideIcon } from './tideIcons';
import { TIDE_LABELS, TIDE_SHIELD, tideText, type TideStatus } from './tideModel';

// V0.8 prototype (an experiment, not rules): the dark tide under the voyage event's chip, in view for the whole match.
// Before 暗潮將至 it shows the two public candidates; once the tide is picked, that one (and whether it acts yet).
// Hover (or focus) a tide for its line and what stops it.

function Tide({ kind, state }: { readonly kind: TideKind; readonly state: 'candidate' | 'coming' | 'acting' }) {
  const rules = useRules();
  const line = tideText(rules, kind);
  return (
    <span className={`tide-pill tide-${kind} tide-${state}`} tabIndex={0} aria-label={`${TIDE_LABELS[kind]}：${line}。擋得住的：${TIDE_SHIELD[kind]}`}>
      <TideIcon kind={kind} />
      <b>{TIDE_LABELS[kind]}</b>
      <span className="tide-tip">
        <span>{line}</span>
        <span>擋得住的：{TIDE_SHIELD[kind]}</span>
      </span>
    </span>
  );
}

export function TideChip({ status, round }: { readonly status: TideStatus; readonly round: number }) {
  const acting = status.tide !== null && status.risingRound !== null && round > status.risingRound;
  return (
    <div className={`tide-chip ${status.tide ? (acting ? 'acting' : 'coming') : ''}`} data-focus="tide">
      <small>{status.tide === null ? '暗潮候選' : acting ? '暗潮' : '下回合起暗潮'}</small>
      {status.tide === null ? status.candidates.map((kind) => <Tide key={kind} kind={kind} state="candidate" />) : <Tide kind={status.tide} state={acting ? 'acting' : 'coming'} />}
    </div>
  );
}
