import type { MatchResult, PlayerId } from '../../game';
import { Pins } from '../components/Pins';

interface ResultScreenProps {
  readonly result: MatchResult;
  readonly nameOf: (id: PlayerId) => string;
  readonly onRestart: () => void;
}

export function ResultScreen({ result, nameOf, onRestart }: ResultScreenProps) {
  return (
    <section className="panel result">
      <Pins />
      <h2>最終結算</h2>
      <p>
        勝利者：<strong>{result.winners.map(nameOf).join('、')}</strong>
      </p>
      <table>
        <thead>
          <tr>
            <th>名次</th>
            <th>商會</th>
            <th>現金</th>
            <th>資產估值</th>
            <th>總財富</th>
          </tr>
        </thead>
        <tbody>
          {result.standings.map((s) => (
            <tr key={s.playerId} className={s.rank === 1 ? 'winner' : ''}>
              <td>{s.rank}</td>
              <td>{nameOf(s.playerId)}</td>
              <td>{s.cash} G</td>
              <td>{s.assetValue} G</td>
              <td>
                <strong>{s.wealth} G</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="primary" onClick={onRestart}>
        再來一局
      </button>
    </section>
  );
}
