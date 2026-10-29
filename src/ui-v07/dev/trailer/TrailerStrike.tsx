import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { RULES_V07, type BuildingId, type IslandId, type MatchEvent, type PlayerId } from '../../../v07/game';
import { TRAILER, playTutorial } from '../../../v07/tutorial';
import { shipPose } from '../../../ui/scene/Ships';
import { buildShipBeat } from '../../beats/shipBeat';
import { useBeatPlayback } from '../../beats/useBeatPlayback';
import { buildBoard } from '../../session/board';
import { BeatScene } from '../../scene/BeatScene';
import { beatSeats } from '../../scene/beatStage';
import { useTableLayout } from '../../scene/TableCanvas';
import { markReady } from './director';
import { STRIKE_ANGLES, strikeShot, type StrikeAngle } from './strikeShots';

// The trailer's montage (/v07.html?dev=trailer&part=strike&angle=wide|low|close): the storm's bolt
// striking 凡德商行's ship in round 2 of the TRAILER script, the same beat the match plays, but with
// no labels at all and filmed from the trailer's own angles (strikeShots.ts). Each angle is its own
// take of the same moment; the edit cuts between them.

const VIEWER: PlayerId = 'p1';
const RIVAL: PlayerId = 'p2';
const ROUND = 2;
const SAFE = { top: 0, bottom: 0, left: 0, right: 0 } as const;

function useRivalBeat() {
  return useMemo(() => {
    const log = playTutorial(TRAILER);
    const events: readonly MatchEvent[] = log.events;
    const launched = events.find((e): e is Extract<MatchEvent, { type: 'ships-launched' }> => e.type === 'ships-launched' && e.round === ROUND)!;
    const ship = launched.ships.find((s) => s.owner === RIVAL)!;
    const beat = buildShipBeat(events, ship.id)!;
    const players = log.finalState.players.map((p, i) => ({ id: p.id, name: TRAILER.seats[i]?.name ?? p.id }));
    // The table as it stood when the round's ships set out.
    const firstResolved = events.findIndex((e) => e.type === 'ship-resolved' && e.round === ROUND);
    const board = buildBoard(players.map((p) => p.id), RULES_V07.startingCash, events.slice(0, firstResolved), RULES_V07);
    const buildings: Record<PlayerId, readonly BuildingId[]> = Object.fromEntries(players.map((p) => [p.id, board.players[p.id]?.buildings ?? []]));
    const islands: Record<PlayerId, IslandId | null> = Object.fromEntries(players.map((p) => [p.id, board.players[p.id]?.island ?? null]));
    return { beat, ships: launched.ships.map((s) => ({ id: s.id, owner: s.owner })), seats: beatSeats(players, VIEWER, buildings, islands) };
  }, []);
}

function StrikeCamera({ angle, ship, heading, start }: { readonly angle: StrikeAngle; readonly ship: Vector3; readonly heading: number; readonly start: number | null }) {
  const camera = useThree((st) => st.camera);
  useFrame(() => {
    const shot = strikeShot(angle, [ship.x, ship.y, ship.z], heading, start === null ? 0 : (performance.now() - start) / 1000);
    camera.position.set(...shot.position);
    camera.lookAt(...shot.target);
  });
  return null;
}

export function TrailerStrike() {
  const asked = new URLSearchParams(location.search).get('angle');
  const angle: StrikeAngle = STRIKE_ANGLES.find((a) => a === asked) ?? 'wide';
  const { beat, ships, seats } = useRivalBeat();
  const { angles, laneOf } = useTableLayout(seats);
  const pose = shipPose(angles[laneOf(RIVAL)]!, 'sailing');
  const [start, setStart] = useState<number | null>(null);
  const playback = useBeatPlayback(beat, 1, start !== null);
  return (
    <BeatScene
      seats={seats}
      ships={ships}
      beat={beat}
      view={playback.view}
      weather="storm"
      safe={SAFE}
      tag={null}
      bare
      camera={<StrikeCamera angle={angle} ship={pose.position} heading={pose.heading} start={start} />}
      onReady={() => {
        setStart(performance.now());
        markReady();
      }}
    />
  );
}
