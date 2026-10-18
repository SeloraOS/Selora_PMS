import { describe, it, expect } from 'vitest';
import { computeAlerts } from '../alerts';

const TODAY = '2026-10-19';
const tasks = [
  { id: 'T1', status: 'Open', expectedEndDate: '2026-10-18' },      // overdue by 1
  { id: 'T2', status: 'Working', expectedEndDate: '2026-10-19' },   // due today -> soon, not overdue
  { id: 'T3', status: 'Open', expectedEndDate: '2026-10-21' },      // due in 2 -> soon
  { id: 'T4', status: 'Open', expectedEndDate: '2026-10-22' },      // 3 days -> neither
  { id: 'T5', status: 'Completed', expectedEndDate: '2026-10-01' }, // closed
  { id: 'T6', status: 'Cancelled', expectedEndDate: '2026-10-19' }, // closed
  { id: 'T7', status: 'Open', expectedEndDate: '' },                // no date
];

describe('computeAlerts', () => {
  it('splits overdue and due-soon, ignoring closed and undated tasks', () => {
    const a = computeAlerts(tasks, TODAY, true);
    expect(a.overdue.map((t) => t.id)).toEqual(['T1']);
    expect(a.dueSoon.map((t) => [t.id, t.dueInDays])).toEqual([['T2', 0], ['T3', 2]]);
    expect(a.count).toBe(1);
  });
  it('returns nothing when alerts are off', () => {
    expect(computeAlerts(tasks, TODAY, false)).toEqual({ enabled: false, overdue: [], dueSoon: [], count: 0 });
  });
});
