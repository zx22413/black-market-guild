import { WaxSeal } from '../skin/ornaments';
import './sealSubmit.css';

// Submitting seals the decision: the bar's submit button is a red wax seal. Once pressed it stays on
// the bar while the others decide, turned and marked 已封, and the choices it sealed go quiet
// (Table3DScreen keeps them; sealSubmit.css). The tutorial still finds it as data-focus="submit".

export interface SealSubmitProps {
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  /** Already submitted: shown on the bar while waiting, no longer pressable. */
  readonly sealed?: boolean;
}

export function SealSubmit({ onClick, disabled = false, sealed = false }: SealSubmitProps) {
  return (
    <button
      type="button"
      className={`seal-submit ${sealed ? 'sealed' : ''}`}
      data-focus={sealed ? undefined : 'submit'}
      disabled={disabled || sealed}
      aria-label={sealed ? '已封（已提交）' : '提交'}
      onClick={sealed ? undefined : onClick}
    >
      <WaxSeal />
      <span>{sealed ? '已封' : '提交'}</span>
    </button>
  );
}
