import { useState, useSyncExternalStore } from 'react';
import { getPerfView, setSwitch, subscribePerf, type PerfView } from './perfStore';
import './perf.css';

const DPR_CHOICES: readonly (number | null)[] = [null, 2, 1.5, 1];

function Toggle({ label, on, onClick }: { readonly label: string; readonly on: boolean; readonly onClick: () => void }) {
  return (
    <button type="button" className={`perf-btn ${on ? 'on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function Readout({ view }: { readonly view: PerfView }) {
  const f = view.frames;
  const r = view.render;
  if (!f || !r) return <div>measuring…</div>;
  return (
    <div className="perf-read">
      <div>
        <b>{f.fps.toFixed(0)}</b> fps · avg {f.avgMs.toFixed(1)} · p95 {f.p95Ms.toFixed(1)} · worst {f.worstMs.toFixed(0)} ms
      </div>
      <div>hitches (&gt;25ms) {f.hitches}</div>
      <div>
        calls {r.calls} · tris {(r.triangles / 1000).toFixed(0)}k · geo {r.geometries} · tex {r.textures} · blank {r.blankFrames}
      </div>
      <div>
        canvas {r.width}×{r.height} @ {r.pixelRatio}x
      </div>
    </div>
  );
}

/** `?perf=1`: frame timing and the switches that isolate what slows a phone down. */
export function PerfPanel() {
  const view = useSyncExternalStore(subscribePerf, getPerfView);
  const [open, setOpen] = useState(true);
  return (
    <div className="perf-panel" role="region" aria-label="perf">
      <button type="button" className="perf-head" onClick={() => setOpen(!open)}>
        perf {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <Readout view={view} />
          <div className="perf-row">
            <Toggle label="sea frozen" on={view.seaFrozen} onClick={() => setSwitch({ seaFrozen: !view.seaFrozen })} />
            <Toggle label="no shadow" on={view.shadowsOff} onClick={() => setSwitch({ shadowsOff: !view.shadowsOff })} />
            <Toggle label="no blur" on={view.noBlur} onClick={() => setSwitch({ noBlur: !view.noBlur })} />
            <Toggle label="no css fx" on={view.noFx} onClick={() => setSwitch({ noFx: !view.noFx })} />
          </div>
          <div className="perf-row">
            <span>dpr</span>
            {DPR_CHOICES.map((c) => (
              <Toggle key={String(c)} label={c === null ? 'auto' : String(c)} on={view.dprCap === c} onClick={() => setSwitch({ dprCap: c })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
