import type { MatchResult, PlayerId } from '../../v07/game';
import { Card } from './parts';

interface ResultPanelProps {
  readonly result: MatchResult;
  readonly nameOf: (id: PlayerId) => string;
  readonly onRestart: () => void;
}

/** §13: wealth = cash + half the cash cost of held buildings. */
export function ResultPanel({ result, nameOf, onRestart }: ResultPanelProps) {
  return (
    <Card title="最終結算" className="v7-result">
      <p>
        勝利者：<strong>{result.winners.map(nameOf).join('、')}</strong>
      </p>
      <table>
        <thead>
          <tr>
            <th>名次</th>
            <th>商會</th>
            <th>現金</th>
            <th>建築估值</th>
            <th>總財富</th>
          </tr>
        </thead>
        <tbody>
          {result.standings.map((s) => (
            <tr key={s.playerId} className={s.rank === 1 ? 'winner' : ''}>
              <td>{s.rank}</td>
              <td>{nameOf(s.playerId)}</td>
              <td>{s.cash} G</td>
              <td>{s.buildingValue} G</td>
              <td>
                <strong>{s.wealth} G</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="v7-primary" onClick={onRestart}>
        回到選單
      </button>
    </Card>
  );
}
