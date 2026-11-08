// How the dashboard names the phase a player left a match in (the `phase` of `match_quit`). Since V0.7.1
// the investment is two screens, so the app records `invest-ship` and `invest-cargo`; records from before
// carry the plain `invest`.

const PHASES: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'start', label: '開局前' },
  { id: 'island-choice', label: '選島' },
  { id: 'invest', label: '投資（改版前，未分選船與裝貨）' },
  { id: 'invest-ship', label: '投資：選船' },
  { id: 'invest-cargo', label: '投資：裝貨' },
  { id: 'role-deployment', label: '部署角色' },
  { id: 'resolution', label: '結算演出' },
];

export function quitPhaseLabel(phase: unknown): string {
  if (phase === null || phase === undefined || phase === '') return '未知';
  const text = String(phase);
  return PHASES.find((p) => p.id === text)?.label ?? text;
}

/** Match order, so the bars read like a match; unknown phases go last. */
export function quitPhaseOrder(phase: unknown): number {
  const index = PHASES.findIndex((p) => p.id === String(phase));
  return index === -1 ? PHASES.length : index;
}
