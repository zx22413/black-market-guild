import { useMemo, useState } from 'react';
import { GOODS, buildingCost, capacityFor, shipCostFor, type BuildingId, type GoodId, type Goods } from '../../v07/game';
import { BUILDING_LABELS, BUILDING_TEXT, GOOD_LABELS } from '../labels';
import { legalOf, type FormProps } from './forms';
import { GoodTag, GoodsList } from './parts';

const NONE: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };
const sameGoods = (a: Goods, b: Goods): boolean => GOODS.every((g) => a[g] === b[g]);
const total = (g: Goods): number => GOODS.reduce((n, k) => n + g[k], 0);

/**
 * §5 step 2, §8, §10: build at most one building, then load the ship. Every choice is limited to
 * the legal actions the match runner offered; nothing is validated here.
 */
export function InvestForm({ context, onSubmit }: FormProps) {
  const { view } = context;
  const rules = view.rules;
  const me = view.players.find((p) => p.id === view.playerId)!;
  const options = useMemo(() => legalOf(context, 'invest'), [context]);
  const builds = useMemo(() => [...new Set(options.map((a) => a.build))], [options]);
  const [build, setBuild] = useState<BuildingId | null>(null);
  const [load, setLoad] = useState<Goods>(NONE);

  const loads = useMemo(() => options.filter((a) => a.build === build).map((a) => a.load), [options, build]);
  const isLegal = (candidate: Goods) => loads.some((l) => sameGoods(l, candidate));
  const cost = build === null ? NONE : buildingCost(rules, build);
  const available = (good: GoodId) => view.myStock[good] - cost[good];
  const capacity = capacityFor(rules, build === null ? me.buildings : [...me.buildings, build], me.island);
  const shipCost = shipCostFor(rules, me.island);
  const loaded = total(load);
  const buildCash = build === null ? 0 : rules.buildings.costs[build].cash;
  const action = options.find((a) => a.build === build && sameGoods(a.load, load));

  const chooseBuild = (next: BuildingId | null) => {
    setBuild(next);
    // Keep the cargo when it is still legal with the new building, otherwise start empty.
    const stillLegal = options.some((a) => a.build === next && sameGoods(a.load, load));
    if (!stillLegal) setLoad(NONE);
  };

  const hint = (good: GoodId): string => {
    if (loaded >= capacity) return `已達可裝貨量 ${capacity}`;
    if (available(good) - load[good] <= 0) return '倉庫沒有了';
    return `現金不足以支付出航成本 ${shipCost} G`;
  };

  return (
    <div className="v7-form">
      <h3>1. 建造（最多一棟）</h3>
      <div className="v7-choice-grid">
        {builds.map((b) => (
          <button key={b ?? 'none'} className={`v7-choice${build === b ? ' on' : ''}`} onClick={() => chooseBuild(b)}>
            <strong>{b === null ? '不建造' : BUILDING_LABELS[b]}</strong>
            {b !== null && (
              <>
                <span className="v7-cost">
                  {rules.buildings.costs[b].cash} G
                  {GOODS.filter((g) => buildingCost(rules, b)[g] > 0).map((g) => `＋${buildingCost(rules, b)[g]} ${GOOD_LABELS[g]}`)}
                </span>
                <span className="v7-muted">{BUILDING_TEXT[b]}</span>
              </>
            )}
          </button>
        ))}
        {builds.length === 1 && <p className="v7-muted">目前沒有蓋得起（或可以再蓋）的建築。</p>}
      </div>

      <h3>
        2. 裝貨 <small>{loaded} / {capacity} 單位</small>
      </h3>
      <div className="v7-load">
        {GOODS.map((good) => {
          const next = { ...load, [good]: load[good] + 1 };
          const canAdd = available(good) - load[good] > 0 && isLegal(next);
          return (
            <div key={good} className="v7-load-row">
              <GoodTag good={good} />
              <span className="v7-muted">倉庫 {available(good)}</span>
              <div className="v7-stepper">
                <button aria-label={`少裝 ${GOOD_LABELS[good]}`} disabled={load[good] === 0} onClick={() => setLoad((l) => ({ ...l, [good]: Math.max(0, l[good] - 1) }))}>
                  −
                </button>
                <output>{load[good]}</output>
                <button aria-label={`多裝 ${GOOD_LABELS[good]}`} disabled={!canAdd} title={canAdd ? '' : hint(good)} onClick={() => setLoad((l) => (isLegal({ ...l, [good]: l[good] + 1 }) ? { ...l, [good]: l[good] + 1 } : l))}>
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="v7-summary">
        {loaded === 0 ? (
          <>不裝貨＝不出航（不付出航成本）。</>
        ) : (
          <>
            出航成本 {shipCost} G；裝 <GoodsList goods={load} />。
          </>
        )}
        {buildCash > 0 && <> 建築 {buildCash} G。</>} 現金 {me.cash} G → {me.cash - buildCash - (loaded > 0 ? shipCost : 0)} G
      </p>
      <p className="v7-muted">裝貨內容保密到航程結算；提交後才公開建造結果與誰出航。</p>
      <button className="v7-primary" disabled={!action} onClick={() => action && onSubmit(action)}>
        提交投資
      </button>
    </div>
  );
}
