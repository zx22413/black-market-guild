import { ISLAND_LABELS, ISLAND_TEXT } from '../labels';
import { legalOf, type FormProps } from './forms';

/** §11.1: choose 1 of the 2 islands dealt to you; the others see your choice only when all have chosen. */
export function IslandForm({ context, onSubmit }: FormProps) {
  const options = legalOf(context, 'choose-island');
  return (
    <div className="v7-island-choices">
      {options.map((action) => (
        <button key={action.island} className="v7-island-card" onClick={() => onSubmit(action)}>
          <strong>{ISLAND_LABELS[action.island]}</strong>
          <span className="pro">＋ {ISLAND_TEXT[action.island].pro}</span>
          <span className="con">－ {ISLAND_TEXT[action.island].con}</span>
          <span className="v7-pick">選這座島</span>
        </button>
      ))}
    </div>
  );
}
