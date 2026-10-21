// The die's final value against where a ship arrives or sinks (the beginner tutorial's 航行骰 step):
// the raw roll, what moves it, and a strip of the faces split at the arrival line.

interface DieDiagramProps {
  readonly successMin: number;
  readonly dieMax: number;
}

export function DieDiagram({ successMin, dieMax }: DieDiagramProps) {
  const faces = Array.from({ length: dieMax }, (_, i) => i + 1);
  const sinking = faces.filter((f) => f < successMin);
  const arriving = faces.filter((f) => f >= successMin);
  return (
    <figure className="die-diagram" aria-label={`最終值 ${successMin} 到 ${dieMax} 抵達，1 到 ${successMin - 1} 沉沒`}>
      <div className="die-formula">
        <span>起始骰</span>
        <b>±</b>
        <span>事件</span>
        <b>±</b>
        <span>角色</span>
        <b>＝</b>
        <span className="die-final">最終值</span>
      </div>
      <div className="die-strip">
        <div className="die-group sink" style={{ flexGrow: sinking.length }}>
          <div className="die-faces">
            {sinking.map((f) => (
              <i key={f}>{f}</i>
            ))}
          </div>
          <small>沉沒</small>
        </div>
        <div className="die-group arrive" style={{ flexGrow: arriving.length }}>
          <div className="die-faces">
            {arriving.map((f) => (
              <i key={f}>{f}</i>
            ))}
          </div>
          <small>抵達</small>
        </div>
      </div>
    </figure>
  );
}
