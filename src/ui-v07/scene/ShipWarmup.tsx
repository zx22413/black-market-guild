import { GOODS, SHIP_TYPE_IDS } from '../../v07/game';
import { CrateModel } from './CrateModel';
import { ShipModel } from './ships/ShipModel';

// What the table shows only once play reaches it, for EffectWarmup to compile while the table loads: one ship of each
// type (their hulls, sails and pennants) and a crate of each good, plain, under a tarp and freshly minted. Without
// this the first ship pick compiles them all at once, a frame of a second or more right as the camera dives to the
// dock, and the dive is over before it is seen.

const WARM_COLOR = '#fcf4e2';

export function ShipWarmup() {
  return (
    <>
      {SHIP_TYPE_IDS.map((type) => (
        <ShipModel key={type} type={type} color={WARM_COLOR} night={false} underway={false} />
      ))}
      {GOODS.map((good) => (
        <CrateModel key={good} good={good} />
      ))}
      <CrateModel good="wood" tarp />
      <CrateModel good="spice" minted />
    </>
  );
}
