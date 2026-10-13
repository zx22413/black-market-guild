import type { ReactNode } from 'react';
import type { Action, PlayerId, ShipId } from '../../v07/game';
import type { FitPoint } from '../../ui/scene/CameraRig';
import type { BeatSeat } from '../scene/beatStage';
import type { TablePin, TableShip } from '../scene/TableCanvas';
import type { Board } from '../session/board';
import type { HumanRequest } from '../session/gameSession';
import type { BetControls } from './MarketStrip';

// One decision on the 3D table is a "step" (investment, role deployment, ...). A step hook takes
// the shared environment and returns what it adds to the one table that stays mounted: pins,
// 3D props, the bottom bar, an overlay, where the camera looks, and how ships can be clicked.

export interface StageEnv {
  readonly request: HumanRequest;
  readonly board: Board;
  readonly seats: readonly BeatSeat[];
  readonly angles: readonly number[];
  readonly laneOf: (id: PlayerId) => number;
  readonly viewer: PlayerId;
  readonly nameOf: (id: PlayerId) => string;
  readonly submit: (action: Action) => void;
}

export interface StageParts {
  readonly pins: readonly TablePin[];
  readonly scene: ReactNode;
  readonly bar: ReactNode;
  /** Cards standing above the bar (the role hand). */
  readonly dock?: ReactNode;
  readonly overlay?: ReactNode;
  /** What the camera frames; null for the whole table. */
  readonly camera: readonly FitPoint[] | null;
  /** Adjusts each launched ship (selectable, chosen). */
  readonly ship?: (ship: TableShip) => TableShip;
  readonly onSelectShip?: (id: ShipId) => void;
  /** Broker bet buttons on the market strip. */
  readonly bets?: BetControls;
}

/** "你的船" / "黑潮會的船". */
export function shipName(board: Board, id: ShipId, viewer: PlayerId, nameOf: (id: PlayerId) => string): string {
  const owner = board.ships.find((s) => s.id === id)?.owner;
  return owner === viewer ? '你的船' : `${owner ? nameOf(owner) : '?'}的船`;
}
