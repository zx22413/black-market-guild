import type { CSSProperties } from 'react';
import { GOODS, type Rules } from '../../v07/game';
import { clauses } from '../table/clauses';
import { FACILITY_LABELS, SKILL_LABELS, facilityShield, facilityText, skillText } from '../table/v08Text';
import { ISLAND_LABELS, SHIP_TYPE_LABELS, islandText } from '../labels';
import type { BeatSeat } from '../scene/beatStage';
import type { Board } from '../session/board';
import { GoodChips } from './GoodIcon';
import { IslandIcon } from './IslandIcon';
import { CloseIcon, tokenIconUrl } from './icons';
import './islandPeek.css';

// A closer look at another player's island (click it on the table): everything about the guild that is public (§4) —
// its island, the building it has raised, the ship skills it has opened, its warehouse and cash. The camera has
// already moved in; this card says what the close-up shows. Click the island again, the sea or Esc to go back.
// Laid out as a card in the table's family (docs/ui/v07-style-layers.md): the guild's name plate on top, then one
// titled section per thing, each rule clause on its own line. The words come from the text sources (labels.ts,
// v08Text.ts); only the line breaks are made here.

export interface IslandPeekProps {
  readonly seat: BeatSeat;
  readonly board: Board;
  readonly rules: Rules;
  /** Cash shown (it ticks up as payments land). */
  readonly cash: number;
  readonly onClose: () => void;
}

const facilityIcon = (id: string): string => `${import.meta.env.BASE_URL}art/icons/facility-${id}.svg`;

function Lines({ text, sign }: { readonly text: string; readonly sign?: 'pro' | 'con' }) {
  return (
    <ul className={`peek-lines ${sign ?? ''}`}>
      {clauses(text).map((line) => (
        <li key={line}>
          {sign && (
            <i className="sign" aria-label={sign === 'pro' ? '好處' : '代價'}>
              {sign === 'pro' ? '＋' : '－'}
            </i>
          )}
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function IslandPeek({ seat, board, rules, cash, onClose }: IslandPeekProps) {
  const player = board.players[seat.id];
  const island = player?.island ?? seat.island ?? null;
  const facility = player?.facility ?? null;
  const skills = player?.skills ?? [];
  const goods = GOODS.filter((g) => (player?.stock[g] ?? 0) > 0).map((good) => ({ good, count: player?.stock[good] ?? 0 }));
  const lines = island ? islandText(rules, island) : null;
  const shield = facility ? facilityShield(rules, facility) : null;
  return (
    <aside className="island-peek" style={{ '--seat': seat.color } as CSSProperties} aria-label={`${seat.name}的島`}>
      <header className="peek-head">
        <b className="peek-owner">{seat.name}</b>
        <span className="peek-cash" title="現金">
          <img src={tokenIconUrl('coin')} alt="" />
          {cash.toLocaleString()} G
        </span>
        <button type="button" className="peek-close" onClick={onClose} aria-label="回到全景">
          <CloseIcon />
        </button>
      </header>
      <div className="peek-body">
        {island && lines && (
          <section className="peek-sec">
            <h3 className="peek-title">
              <IslandIcon island={island} />
              {ISLAND_LABELS[island]}
            </h3>
            <Lines text={lines.pro} sign="pro" />
            {/* 「沒有缺點」 is not a cost: said plainly, without the minus. */}
            {lines.con === '沒有缺點' ? <p className="peek-none">{lines.con}</p> : <Lines text={lines.con} sign="con" />}
          </section>
        )}
        <section className="peek-sec">
          <h4 className="peek-label">建築</h4>
          {facility ? (
            <>
              <p className="peek-item">
                <img className="peek-ic" src={facilityIcon(facility)} alt="" />
                <b>{FACILITY_LABELS[facility]}</b>
                {shield && <span className="tide-ward">{shield}</span>}
              </p>
              <Lines text={facilityText(rules, facility)} />
            </>
          ) : (
            <p className="peek-none">還沒蓋</p>
          )}
        </section>
        <section className="peek-sec">
          <h4 className="peek-label">船的技能</h4>
          {skills.length === 0 ? (
            <p className="peek-none">還沒開啟</p>
          ) : (
            skills.map((t) => (
              <div key={t} className="peek-skill">
                <p className="peek-item">
                  <b>{SKILL_LABELS[t]}</b>
                  <small>{SHIP_TYPE_LABELS[t]}</small>
                </p>
                <Lines text={skillText(rules, t)} />
              </div>
            ))
          )}
        </section>
        <section className="peek-sec">
          <h4 className="peek-label">倉庫</h4>
          {goods.length > 0 ? (
            <p className="peek-goods">
              <GoodChips goods={goods} />
            </p>
          ) : (
            <p className="peek-none">空</p>
          )}
        </section>
      </div>
    </aside>
  );
}
