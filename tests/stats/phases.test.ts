import { describe, expect, it } from 'vitest';
import { quitPhaseLabel, quitPhaseOrder } from '../../src/stats/phases';

describe('quit phase labels for the dashboard', () => {
  it('names the two screens of the investment apart', () => {
    expect(quitPhaseLabel('invest-ship')).toBe('投資：選船');
    expect(quitPhaseLabel('invest-cargo')).toBe('投資：裝貨');
  });

  it('keeps the old combined records readable', () => {
    expect(quitPhaseLabel('invest')).toBe('投資（改版前，未分選船與裝貨）');
  });

  it('names the other decision phases and falls back to the raw text', () => {
    expect(quitPhaseLabel('island-choice')).toBe('選島');
    expect(quitPhaseLabel('role-deployment')).toBe('部署角色');
    expect(quitPhaseLabel('resolution')).toBe('結算演出');
    expect(quitPhaseLabel('start')).toBe('開局前');
    expect(quitPhaseLabel('mystery')).toBe('mystery');
    expect(quitPhaseLabel(null)).toBe('未知');
  });

  it('orders phases as a match goes: start, islands, ship, cargo, roles, resolution', () => {
    const phases = ['resolution', 'invest-cargo', 'start', 'role-deployment', 'invest', 'invest-ship', 'island-choice', 'other'];
    expect([...phases].sort((a, b) => quitPhaseOrder(a) - quitPhaseOrder(b))).toEqual(['start', 'island-choice', 'invest', 'invest-ship', 'invest-cargo', 'role-deployment', 'resolution', 'other']);
  });
});
