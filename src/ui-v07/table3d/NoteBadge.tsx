import { useState } from 'react';
import type { NoteChip } from '../table/investChoice';
import { GoodCount } from './GoodIcon';
import { AlertIcon, HouseIcon, IconDisc, WantedMark, artIconUrl } from './icons';
import { roleIconUrl } from './RoleBadges';

// A reminder beside the warehouse or the ship, as icons only: what it is about, then a mark.
// The sentence it restates opens on hover or tap (and is what screen readers read).

function Chip({ chip }: { readonly chip: NoteChip }) {
  switch (chip.kind) {
    case 'good':
      return chip.count === undefined ? <GoodCount good={chip.good} count={1} size="sm" /> : <GoodCount good={chip.good} count={chip.count} size="sm" />;
    case 'role':
      return <IconDisc src={roleIconUrl(chip.role)} badge />;
    case 'ship':
      return (
        <span className="note-chip">
          <IconDisc src={artIconUrl('ship-solo')} />
          {chip.text}
        </span>
      );
    case 'coin':
      return (
        <span className="note-chip">
          <IconDisc src={artIconUrl('coin')} />
          {chip.text}
        </span>
      );
    case 'house':
      return <HouseIcon />;
    case 'wanted':
      return <WantedMark />;
    case 'alert':
      return <AlertIcon />;
  }
}

export function NoteBadge({ chips, text, label }: { readonly chips: readonly NoteChip[]; readonly text: string; readonly label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="note-badge" onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={text} aria-expanded={open} onMouseEnter={() => setOpen(true)} onClick={() => setOpen((v) => !v)}>
        {chips.map((chip, i) => (
          <Chip key={i} chip={chip} />
        ))}
        <span className="note-label">{label}</span>
      </button>
      {open && (
        <span className="note-tip" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
