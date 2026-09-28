interface HandoffScreenProps {
  readonly playerName: string;
  readonly onReady: () => void;
}

/** Hot-seat cover: hides the previous player's secrets until the next player confirms. */
export function HandoffScreen({ playerName, onReady }: HandoffScreenProps) {
  return (
    <div className="handoff">
      <div className="handoff-card">
        <p>請將裝置交給</p>
        <h1>{playerName}</h1>
        <p className="muted">其他玩家請勿偷看。</p>
        <button className="primary" onClick={onReady}>
          我是 {playerName}，開始
        </button>
      </div>
    </div>
  );
}
