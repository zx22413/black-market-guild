import type { Ref } from 'react';
import type { Deployment, PlayerId, VoyageModifier } from '../../game';
import { assetIcon, iconUrl, roleIcon } from '../art';
import { ASSET_LABELS, ROLE_LABELS } from '../labels';
import { CashFloats } from '../table/CashFloats';
import type { CashFloat } from '../table/useCashFloats';
import type { SceneSeat, SceneShip } from './tableModel';

type NameOf = (id: PlayerId) => string;

/** Name board over the target island, carrying this round's market notice. */
export function TargetSign({ ref, notice }: { readonly ref: Ref<HTMLDivElement>; readonly notice: string | null }) {
  return (
    <div ref={ref} className="island-sign">
      <strong>黑市港</strong>
      {notice && <span>公告：{notice}</span>}
    </div>
  );
}

interface SeatTagProps {
  readonly ref: Ref<HTMLDivElement>;
  readonly seat: SceneSeat;
  readonly nameOf: NameOf;
  /** Already locked this phase's choice. */
  readonly ready: boolean;
  readonly floats: readonly CashFloat[];
}

/** Opponent guild board: name, cash, assets and this round's public status. */
export function SeatTag({ ref, seat, nameOf, ready, floats }: SeatTagProps) {
  return (
    <div ref={ref} className="seat-tag" style={{ borderColor: seat.color }}>
      <CashFloats floats={floats} />
      <strong>
        {seat.name}
        {ready && <span className="tag-ready" title="已決定"> ✓</span>}
      </strong>
      <span className="seat-cash">
        {seat.cash} G<small className="seat-worth">資產 {seat.assetValue} G</small>
      </span>
      {seat.assets.length > 0 && (
        <span className="seat-assets">
          {seat.assets.map((a) => (
            <img key={a} src={iconUrl(assetIcon(a))} alt={ASSET_LABELS[a]} title={ASSET_LABELS[a]} />
          ))}
        </span>
      )}
      {seat.recruiting === 'open' && <span className="seat-status">招募合資中</span>}
      {seat.recruiting === 'withdrawn' && <span className="seat-status muted">已撤回招募</span>}
      {seat.appliedTo.length > 0 && <span className="seat-status">應徵 {seat.appliedTo.map(nameOf).join('、')}</span>}
      {seat.stayedInPort && <span className="seat-status muted">留港</span>}
    </div>
  );
}

interface ShipTagProps {
  readonly ref: Ref<HTMLButtonElement>;
  readonly ship: SceneShip;
  readonly nameOf: NameOf;
  readonly colorOf: (id: PlayerId) => string;
  /** The viewer's own hidden deployment on this ship, if any. */
  readonly secret: Deployment | null;
  /** What the viewer's intel merchant saw on this ship; private to the viewer. */
  readonly intel: IntelTrace | null;
  readonly selectable: boolean;
  readonly onSelect: () => void;
}

/** Floating tag over a ship: owners, revealed roles and what happened to it. */
export function ShipTag({ ref, ship, nameOf, colorOf, secret, intel, selectable, onSelect }: ShipTagProps) {
  const outcome = ship.state === 'arrived' ? '抵達' : ship.state === 'sunk' ? '沉沒' : null;
  return (
    <button
      ref={ref}
      type="button"
      className={`ship-tag ${ship.state} ${selectable ? 'selectable' : ''}`}
      disabled={!selectable}
      onClick={onSelect}
    >
      <span className="ship-owners">
        {ship.owners.map((id) => (
          <i key={id} style={{ background: colorOf(id) }} />
        ))}
        {ship.owners.map(nameOf).join('＋')}
        {outcome && <b className={`ship-outcome ${ship.state}`}>{outcome}</b>}
      </span>
      {intel && ship.modifier && <IntelRow intel={intel} />}
      {ship.modifier && <ResolutionRow modifier={ship.modifier} rerolled={ship.rerolled} delay={intel?.rerolled != null ? 1.1 : 0} />}
      {(ship.roles.length > 0 || secret || ship.rerolled || ship.smuggled > 0 || ship.caughtSmugglers.length > 0) && (
        <span className="ship-roles">
          {ship.roles.map((d) => (
            <span key={`${d.playerId}-${d.role}`} className="role-token" style={{ borderColor: colorOf(d.playerId) }} title={`${nameOf(d.playerId)}・${ROLE_LABELS[d.role]}`}>
              <img src={iconUrl(roleIcon(d.role))} alt={ROLE_LABELS[d.role]} />
            </span>
          ))}
          {secret && (
            <span className="role-token secret" title={`你的${ROLE_LABELS[secret.role]}（未公開）`}>
              <img src={iconUrl(roleIcon(secret.role))} alt={ROLE_LABELS[secret.role]} />
            </span>
          )}
          {ship.rerolled && <span className="ship-note">已重擲</span>}
          {ship.smuggled > 0 && <span className="ship-note">被走私 {ship.smuggled} G</span>}
          {ship.caughtSmugglers.length > 0 && <span className="ship-note">查獲 {ship.caughtSmugglers.map(nameOf).join('、')}</span>}
        </span>
      )}
    </button>
  );
}

/** The raw roll and reroll the viewer's intel merchant saw on a ship. */
export interface IntelTrace {
  readonly raw: number;
  readonly rerolled: number | null;
}

const STEPS = [
  ['guard', '護衛'],
  ['pirate', '海盜'],
  ['event', '事件'],
] as const;

const signed = (n: number): string => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/** Only for the intel merchant: the original roll struck out and replaced by the reroll. */
function IntelRow({ intel }: { readonly intel: IntelTrace }) {
  return (
    <span className="ship-intel" title="只有你知道">
      你的情報：<span className={intel.rerolled !== null ? 'die struck' : 'die'}>{intel.raw}</span>
      {intel.rerolled !== null && (
        <>
          <span className="arrow">→</span>
          <span className="die" style={{ animationDelay: '0.6s' }}>
            {intel.rerolled}
          </span>
        </>
      )}
    </span>
  );
}

/** Public resolution: starting roll, each modifier popping in turn, then the final value. */
function ResolutionRow({ modifier, rerolled, delay }: { readonly modifier: VoyageModifier; readonly rerolled: boolean; readonly delay: number }) {
  const steps = STEPS.filter(([key]) => modifier[key] !== 0);
  const at = (i: number) => ({ animationDelay: `${delay + i * 0.35}s` });
  return (
    <span className="ship-modifiers">
      <span className="modifier base" style={at(0)} title={rerolled ? '重擲後的骰值' : '起始骰值'}>
        {rerolled ? '重擲後' : '骰'} {modifier.base}
      </span>
      {steps.map(([key, label], i) => (
        <span key={key} className={`modifier ${modifier[key] > 0 ? 'up' : 'down'}`} style={at(i + 1)}>
          {label} {signed(modifier[key])}
        </span>
      ))}
      <span className="modifier final" style={at(steps.length + 1)}>
        = {modifier.final}
      </span>
    </span>
  );
}
