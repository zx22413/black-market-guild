import { useEffect, useState, type Ref } from 'react';
import type { Deployment, PlayerId } from '../../game';
import { assetIcon, iconUrl, roleIcon } from '../art';
import { ASSET_LABELS, ROLE_LABELS } from '../labels';
import { CashFloats } from '../table/CashFloats';
import type { CashFloat } from '../table/useCashFloats';
import { DIE_BEAT_MS, dieSteps, type DieStep, type IntelTrace } from './dieSteps';
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

/** Floating tag over a ship: owners, who targeted it, and its die once the voyage resolves. */
export function ShipTag({ ref, ship, nameOf, colorOf, secret, intel, selectable, onSelect }: ShipTagProps) {
  const tokens = ship.roles.length > 0 || secret || ship.rerolled || ship.smuggled > 0 || ship.caughtSmugglers.length > 0;
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
      </span>
      {ship.modifier && (
        <DieCounter
          key={ship.modifier.shipId}
          steps={dieSteps(ship.modifier, ship.rerolled, intel)}
          outcome={ship.state === 'arrived' || ship.state === 'sunk' ? ship.state : null}
        />
      )}
      {tokens && (
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
          {ship.rerolled && (
            <span className="role-token" title="被情報商人重擲過">
              <img src={iconUrl('reroll')} alt="已重擲" />
            </span>
          )}
          {ship.smuggled > 0 && <span className="ship-note" title="被走私的金額（走私者不公開）">走私 {ship.smuggled}</span>}
          {ship.caughtSmugglers.length > 0 && (
            <span className="ship-note" title={`查獲走私：${ship.caughtSmugglers.map(nameOf).join('、')}`}>
              查獲
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** Big die that counts through each modifier, then turns green (arrived) or red (sunk). */
function DieCounter({ steps, outcome }: { readonly steps: readonly DieStep[]; readonly outcome: 'arrived' | 'sunk' | null }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index >= steps.length - 1) return;
    const timer = setTimeout(() => setIndex(index + 1), DIE_BEAT_MS);
    return () => clearTimeout(timer);
  }, [index, steps.length]);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const settled = index >= steps.length - 1 && outcome !== null;
  return (
    <span className={`die-counter ${settled ? outcome : ''}`}>
      <span key={index} className="die-face">
        {step.value}
      </span>
      <span key={`label-${index}`} className="die-step">
        {settled ? (outcome === 'arrived' ? '抵達' : '沉沒') : step.label}
      </span>
    </span>
  );
}
