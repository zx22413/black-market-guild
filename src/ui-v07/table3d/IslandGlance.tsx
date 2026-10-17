import type { IslandId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import { ISLAND_GLANCE, type GlanceIcon } from '../table/islandGlance';
import { IconDisc, artIconUrl } from './icons';
import { roleIconUrl } from './RoleBadges';

// An island's effects as small rows: a +/− disc, the thing it touches (a goods chip, a role or the
// ship) and a few words. The full sentence is what the caller shows on hover or tap.

function Thing({ icon }: { readonly icon: GlanceIcon }) {
  if (icon.kind === 'good') {
    return (
      <span className={`glance-good good-${icon.good}`} title={GOOD_LABELS[icon.good]}>
        {GOOD_LABELS[icon.good].slice(0, 1)}
      </span>
    );
  }
  return <IconDisc src={icon.kind === 'role' ? roleIconUrl(icon.role) : artIconUrl('ship-solo')} />;
}

export function IslandGlance({ island }: { readonly island: IslandId }) {
  return (
    <span className="glance">
      {ISLAND_GLANCE[island].map((item, i) => (
        <span key={i} className={`glance-row ${item.sign > 0 ? 'pro' : 'con'}`}>
          <i className="sign" aria-label={item.sign > 0 ? '好處' : '代價'}>
            {item.sign > 0 ? '＋' : '－'}
          </i>
          <Thing icon={item.icon} />
          {item.text}
        </span>
      ))}
    </span>
  );
}
