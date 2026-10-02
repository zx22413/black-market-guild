import { useCallback, useState } from 'react';
import type { AssetId, PlayerId, Rules } from '../../game';
import { assetIcon } from '../art';
import { Icon } from '../components/Icon';
import { ASSET_LABELS } from '../labels';
import type { SceneSeat } from '../scene/tableModel';
import { assetText } from '../rulesText';
import { jointBenefits } from './jointBenefits';
import './partner.css';

export interface AssetInspection {
  /** The building whose ability text is open on the card. */
  readonly open: AssetId | null;
  /** Buildings already opened once, as `guild:asset`; they stop showing the "tap me" dot. */
  readonly seen: ReadonlySet<string>;
  readonly inspect: (guild: PlayerId, asset: AssetId) => void;
  readonly close: () => void;
  readonly reset: () => void;
}

/** Which building's ability text is open; lives above the card so it survives switching islands. */
export function useAssetInspection(): AssetInspection {
  const [open, setOpen] = useState<AssetId | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const inspect = useCallback((guild: PlayerId, asset: AssetId) => {
    setOpen((current) => (current === asset ? null : asset));
    setSeen((current) => new Set([...current, `${guild}:${asset}`]));
  }, []);
  const close = useCallback(() => setOpen(null), []);
  const reset = useCallback(() => {
    setOpen(null);
    setSeen(new Set());
  }, []);
  return { open, seen, inspect, close, reset };
}

interface PartnerCardProps {
  readonly seat: SceneSeat;
  readonly rules: Rules;
  /** Which side of the joint venture the viewer is on. */
  readonly phase: 'apply' | 'pick';
  readonly viewerAssets: readonly AssetId[];
  readonly inspection: AssetInspection;
}

/** Public ledger of the picked island, hung on the island itself; never shows black money. */
export function PartnerCard({ seat, rules, phase, viewerAssets, inspection }: PartnerCardProps) {
  const benefits = jointBenefits({ phase, viewerAssets, partnerAssets: seat.assets, rules });
  const opened = seat.assets.filter((a) => inspection.seen.has(`${seat.id}:${a}`)).length;
  return (
    <div className="partner-card" style={{ borderColor: seat.color }}>
      <strong className="partner-name">
        <i style={{ background: seat.color }} aria-hidden />
        {seat.name}
        <span className="partner-money">
          資金 <b>{seat.cash}</b>・資產 <b>{seat.assetValue}</b> G
        </span>
      </strong>
      {seat.assets.length > 0 ? (
        <>
          <div className="partner-assets">
            {seat.assets.map((asset) => (
              <button
                key={asset}
                type="button"
                className={`asset-chip ${inspection.seen.has(`${seat.id}:${asset}`) ? '' : 'unseen'} ${inspection.open === asset ? 'open' : ''}`}
                aria-pressed={inspection.open === asset}
                onClick={() => inspection.inspect(seat.id, asset)}
              >
                <Icon name={assetIcon(asset)} size={18} />
                {ASSET_LABELS[asset]}
              </button>
            ))}
          </div>
          <p className="partner-detail">
            {inspection.open && seat.assets.includes(inspection.open) ? assetText(inspection.open, rules) : `點建築看能力（${opened}/${seat.assets.length}）`}
          </p>
        </>
      ) : (
        <p className="partner-detail">尚未擁有任何資產</p>
      )}
      <div className="partner-benefits">
        <div className="partner-stats">
          <span>
            你出資<b>{benefits.yourShare}</b>
          </span>
          <span>
            對方出資<b>{benefits.partnerShare}</b>
          </span>
          <span title="不含市場事件與走私">
            抵達各分<b>{benefits.payoutEach}</b>
          </span>
        </div>
        <ul>
          {benefits.lines.map((line) => (
            <li key={line.text} className={line.tone}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
