import { notifyPerfFlags, perfFlags } from '../../ui/scene/perfFlags';
import type { FrameSummary } from './frameStats';

/** What the probe inside the canvas reports about the renderer. */
export interface RenderStats {
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  /** Frames that drew almost nothing, since the page opened (see `isBlankFrame`). */
  readonly blankFrames: number;
  readonly pixelRatio: number;
  readonly width: number;
  readonly height: number;
}

export interface PerfView {
  readonly frames: FrameSummary | null;
  readonly render: RenderStats | null;
  readonly seaFrozen: boolean;
  readonly shadowsOff: boolean;
  readonly dprCap: number | null;
  readonly noBlur: boolean;
  readonly noFx: boolean;
}

/** `?perf=1` turns the panel on; nothing of it is loaded otherwise. */
export const perfEnabled = (search: string): boolean => new URLSearchParams(search).get('perf') === '1';

let view: PerfView = { frames: null, render: null, seaFrozen: false, shadowsOff: false, dprCap: null, noBlur: false, noFx: false };
const listeners = new Set<() => void>();

const emit = (next: PerfView): void => {
  view = next;
  listeners.forEach((l) => l());
};

export const subscribePerf = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getPerfView = (): PerfView => view;

export function publishMeasure(frames: FrameSummary | null, render: RenderStats): void {
  emit({ ...view, frames, render });
}

/** Flips one switch: the canvas ones go through the shared flags, the CSS ones through root classes. */
export function setSwitch(change: Partial<Pick<PerfView, 'seaFrozen' | 'shadowsOff' | 'dprCap' | 'noBlur' | 'noFx'>>): void {
  const next = { ...view, ...change };
  perfFlags.seaFrozen = next.seaFrozen;
  perfFlags.shadowsOff = next.shadowsOff;
  perfFlags.dprCap = next.dprCap;
  const root = document.documentElement.classList;
  root.toggle('perf-no-blur', next.noBlur);
  root.toggle('perf-no-fx', next.noFx);
  emit(next);
  notifyPerfFlags();
}
