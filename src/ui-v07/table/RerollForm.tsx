import { legalOf, type FormProps } from './forms';

/** §9.4: the intel merchant sees the raw roll and may reroll; a reroll must be accepted. */
export function RerollForm({ context, nameOf, onSubmit }: FormProps) {
  const { view } = context;
  const options = legalOf(context, 'intel-reroll');
  const ownerOf = (shipId: string) => nameOf(view.ships.find((s) => s.id === shipId)?.owner ?? '');
  return (
    <div className="v7-form">
      <p className="v7-muted">你看到了原始骰值（1～3 沉沒、4～6 抵達，還要加上護衛、海盜、事件等修正）。若重擲，必須接受新結果；此時還不知道航海事件。</p>
      <ul className="v7-intel">
        {view.intel.map((k) => (
          <li key={k.shipId}>
            {ownerOf(k.shipId)}的船：原始骰值 <b className="v7-die">{k.rawRoll}</b>
          </li>
        ))}
      </ul>
      <div className="v7-choice-grid">
        {options.map((action) => (
          <button key={action.rerollShipId ?? 'none'} className="v7-choice" onClick={() => onSubmit(action)}>
            <strong>{action.rerollShipId === null ? '不重擲' : `重擲${ownerOf(action.rerollShipId)}的船`}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
