import { useState } from 'react';
import { ISLAND_IDS, type IslandId } from '../../v07/game';
import { IslandCard, useDealt } from '../table3d/IslandCard';
import '../beats/beat.css';
import '../skin/layers.css';

/**
 * Dev-only: the island cards on their own (`/v07.html?dev=island-cards`, or `&island=lighthouse` for
 * one island): dealt face up, a back, a picked one with its full text, and the small reveal size.
 */
export function IslandCardsPreview() {
  const asked = new URLSearchParams(window.location.search).get('island');
  const islands: readonly IslandId[] = (ISLAND_IDS as readonly string[]).includes(asked ?? '') ? [asked as IslandId] : ISLAND_IDS;
  const up = useDealt(500);
  const [picked, setPicked] = useState<IslandId | null>(islands[0] ?? null);
  const first = islands[0]!;
  return (
    <div style={{ minHeight: '100vh', padding: 32, background: 'radial-gradient(circle at 50% 30%, #2f8f94, #123843)', display: 'grid', gap: 36, justifyItems: 'center' }}>
      <div className="isle-deal">
        {islands.map((island) => (
          <button key={island} type="button" className={`isle-slot ${picked === island ? 'on' : ''}`} onClick={() => setPicked(island)}>
            <IslandCard island={island} faceUp={up} selected={picked === island} showFull={picked === island} />
          </button>
        ))}
        <span className="isle-slot">
          <IslandCard island={first} faceUp={false} />
        </span>
      </div>
      <div className="isle-deal">
        {islands.slice(0, 4).map((island) => (
          <span key={island} className="isle-slot">
            <IslandCard island={island} faceUp={up} size="small" />
          </span>
        ))}
      </div>
    </div>
  );
}
