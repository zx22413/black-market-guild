import type { PrivateEvent } from '../../game';
import { Icon } from './Icon';

interface PrivateNotesProps {
  readonly events: readonly PrivateEvent[];
  readonly describeShip: (shipId: string) => string;
}

function describe(event: PrivateEvent, ship: string): string {
  switch (event.type) {
    case 'intel-report':
      return `情報：${ship} 的原始骰值為 ${event.rawRoll}。`;
    case 'intel-reroll-result':
      return `情報：${ship} 重擲後為 ${event.rerolledRoll}。`;
    case 'black-money':
      return `走私成功：從 ${ship} 取得黑錢 ${event.amount} G（對局結束時才公開）。`;
  }
}

/** Secrets only the viewing seat knows this round; never shown to other seats. */
export function PrivateNotes({ events, describeShip }: PrivateNotesProps) {
  if (events.length === 0) {
    return null;
  }
  return (
    <section className="panel private-notes">
      <h2>
        <Icon name="role-intel" size={18} /> 只有你知道
      </h2>
      <ul>
        {events.map((e, i) => (
          <li key={i}>{describe(e, describeShip(e.shipId))}</li>
        ))}
      </ul>
    </section>
  );
}
