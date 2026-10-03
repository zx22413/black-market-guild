import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AssetId, RoleId, Rules } from '../../game';
import { ASSET_LABELS, ROLE_LABELS } from '../labels';
import { assetText, roleText } from '../rulesText';
import './infoTip.css';

/** What a tip explains; the text is filled in from the rules so numbers never drift. */
export type TipSubject =
  | { readonly kind: 'asset'; readonly asset: AssetId }
  | { readonly kind: 'role'; readonly role: RoleId; readonly target: string; readonly secret: boolean; readonly caught: boolean }
  /** The trigger expands in place (the event notes); only the open/close state is shared. */
  | { readonly kind: 'inline' };

interface OpenTip {
  readonly id: string;
  readonly anchor: DOMRect;
  readonly subject: TipSubject;
}

interface TipStore {
  readonly openId: string | null;
  readonly toggle: (id: string, element: HTMLElement, subject: TipSubject) => void;
  readonly close: () => void;
}

const TipContext = createContext<TipStore | null>(null);

/** Gap between the trigger and the bubble, and the bubble and the screen edge (px). */
const GAP = 8;

/** Title, explanation and an optional private note for a tip; null for in-place expansions. */
export function tipText(subject: TipSubject, rules: Rules): { title: string; body: string; note: string | null } | null {
  switch (subject.kind) {
    case 'asset':
      return { title: ASSET_LABELS[subject.asset], body: assetText(subject.asset, rules), note: null };
    case 'role':
      return {
        title: `${ROLE_LABELS[subject.role]} ${subject.target}`,
        body: roleText(subject.role, rules),
        note: subject.caught ? '已被護衛查獲' : subject.secret ? '只有你看得到' : null,
      };
    case 'inline':
      return null;
  }
}

function Bubble({ tip, rules }: { readonly tip: OpenTip; readonly rules: Rules }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const text = tipText(tip.subject, rules);
  // Below the trigger when it fits, otherwise above; always kept inside the screen.
  useLayoutEffect(() => {
    const bubble = ref.current?.getBoundingClientRect();
    if (!bubble) return;
    const { anchor } = tip;
    const below = anchor.bottom + GAP;
    const top = below + bubble.height <= window.innerHeight - GAP ? below : Math.max(GAP, anchor.top - GAP - bubble.height);
    const centered = anchor.left + anchor.width / 2 - bubble.width / 2;
    const left = Math.min(Math.max(GAP, centered), window.innerWidth - GAP - bubble.width);
    setPlace({ left, top });
  }, [tip]);
  if (!text) return null;
  return (
    <div
      ref={ref}
      className="info-tip"
      role="tooltip"
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <strong>{text.title}</strong>
      <p>{text.body}</p>
      {text.note && <em>{text.note}</em>}
    </div>
  );
}

/**
 * Tap-to-explain for icons that have no room for words (phone layouts) or only a hover title.
 * One tip is open at a time; tapping it again, anywhere else or pressing Escape closes it.
 */
export function TipProvider({ rules, children }: { readonly rules: Rules; readonly children: ReactNode }) {
  const [open, setOpen] = useState<OpenTip | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const toggle = useCallback((id: string, element: HTMLElement, subject: TipSubject) => {
    setOpen((current) => (current?.id === id ? null : { id, anchor: element.getBoundingClientRect(), subject }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      // The trigger itself toggles on click; the bubble may be tapped to read it.
      if (target?.closest(`[data-tip-id="${CSS.escape(open.id)}"], .info-tip`)) return;
      setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  const store = useMemo(() => ({ openId: open?.id ?? null, toggle, close }), [open, toggle, close]);
  return (
    <TipContext.Provider value={store}>
      {children}
      {open && <Bubble tip={open} rules={rules} />}
    </TipContext.Provider>
  );
}

/** Props to spread on a trigger element; inert (no tip) outside a TipProvider. */
export function useTip(id: string, subject: TipSubject) {
  const store = useContext(TipContext);
  const open = store?.openId === id;
  return {
    open,
    props: store
      ? {
          'data-tip-id': id,
          'aria-expanded': open,
          onClick: (event: { currentTarget: HTMLElement }) => store.toggle(id, event.currentTarget, subject),
        }
      : {},
  };
}

interface TipButtonProps {
  readonly id: string;
  readonly subject: TipSubject;
  readonly className?: string;
  readonly label: string;
  readonly children: ReactNode;
}

/** A small button around an icon (and optional words) that opens its explanation. */
export function TipButton({ id, subject, className = '', label, children }: TipButtonProps) {
  const { open, props } = useTip(id, subject);
  return (
    <button type="button" className={`tip-trigger ${open ? 'tip-open' : ''} ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
