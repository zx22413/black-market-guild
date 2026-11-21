import { GOODS, type Rules } from '../../v07/game';
import { FACILITY_LABELS, SKILL_LABELS, facilityShield, facilityText, skillText } from '../table/v08Text';
import { ISLAND_LABELS, SHIP_TYPE_LABELS, islandText } from '../labels';
import type { BeatSeat } from '../scene/beatStage';
import type { Board } from '../session/board';
import { GoodChips } from './GoodIcon';
import { CloseIcon } from './icons';

// A closer look at another player's island (click it on the table): everything about the guild that is public (§4) —
// its island, the building it has raised, the ship skills it has opened, its warehouse and cash. The camera has
// already moved in; this card says what the close-up shows. Click the island again, the sea or Esc to go back.

export interface IslandPeekProps {
  readonly seat: BeatSeat;
  readonly board: Board;
  readonly rules: Rules;
  /** Cash shown (it ticks up as payments land). */
  readonly cash: number;
  readonly onClose: () => void;
}

export function IslandPeek({ seat, board, rules, cash, onClose }: IslandPeekProps) {
  const player = board.players[seat.id];
  const island = player?.island ?? seat.island ?? null;
  const facility = player?.facility ?? null;
  const skills = player?.skills ?? [];
  const goods = GOODS.filter((g) => (player?.stock[g] ?? 0) > 0).map((good) => ({ good, count: player?.stock[good] ?? 0 }));
  return (
    <aside className="island-peek" style={{ borderColor: seat.color }} aria-label={`${seat.name}的島`}>
      <header>
        <b>{seat.name}</b>
        <span className="peek-cash">{cash.toLocaleString()} G</span>
        <button type="button" onClick={onClose} aria-label="回到全景">
          <CloseIcon />
        </button>
      </header>
      {island && (
        <p>
          <b>{ISLAND_LABELS[island]}</b>
          <br />
          {islandText(rules, island).pro}。{islandText(rules, island).con}。
        </p>
      )}
      <p>
        <b>建築</b>
        <br />
        {facility ? `${FACILITY_LABELS[facility]}：${facilityText(rules, facility)}${facilityShield(rules, facility) ? `；${facilityShield(rules, facility)}` : ''}` : '還沒蓋'}
      </p>
      <p>
        <b>船的技能</b>
        <br />
        {skills.length === 0
          ? '還沒開啟'
          : skills.map((t) => (
              <span key={t} className="peek-line">
                {SHIP_TYPE_LABELS[t]}・{SKILL_LABELS[t]}：{skillText(rules, t)}
              </span>
            ))}
      </p>
      <p>
        <b>倉庫</b>
        <br />
        {goods.length > 0 ? <GoodChips goods={goods} /> : '空'}
      </p>
    </aside>
  );
}
