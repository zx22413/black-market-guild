import { soundEngine } from '../../audio/soundEngine';
import { cue } from './director';
import { TrailerCard } from './TrailerCard';
import { TrailerGame } from './TrailerGame';
import { TrailerOpening } from './TrailerOpening';
import { TrailerStrike } from './TrailerStrike';
import './trailer.css';

// Dev-only: the trailer's pages (docs/promo/launch-kit.md §5), each filmed frame by frame by
// scripts/trailer/capture.ts: /v07.html?dev=trailer&part=open is the storm opening, &part=game
// the scripted match, &part=strike&angle=… the bolt striking the rival's ship with no labels, &part=end the clear sky under the end card; &part=card&card=… the overlays
// (TrailerCard, saved by scripts/trailer/still.ts).

// Every one-shot and every event bed the table asks for is noted, so the edit lays the real
// sounds at the real moments (scripts/trailer/edit.ts).
const playSfx = soundEngine.playSfx.bind(soundEngine);
soundEngine.playSfx = (id, rate = 1) => {
  cue(id, rate);
  playSfx(id, rate);
};
const setEventBed = soundEngine.setEventBed.bind(soundEngine);
soundEngine.setEventBed = (bed) => {
  cue(`bed:${bed ?? 'none'}`);
  setEventBed(bed);
};

export function TrailerPreview() {
  const part = new URLSearchParams(location.search).get('part') ?? 'game';
  switch (part) {
    case 'open':
      return <TrailerOpening />;
    case 'strike':
      return <TrailerStrike />;
    case 'end':
      return <TrailerOpening ending />;
    case 'card':
      document.documentElement.classList.add('trailer-card-page');
      return <TrailerCard />;
    default:
      return <TrailerGame />;
  }
}
