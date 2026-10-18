import { describe, it, expect } from 'vitest';
import {
  daysBetween, projectProgress, delayedTasks, delayBuckets, entryRows, hoursBy,
  monthlyHours, projectCosts, dashboardStats, todayStr,
} from '../reportData';

const TODAY = '2026-10-19';
const tasks = [
  { id: 'T1', project: 'A', status: 'Completed', weight: 20, expectedEndDate: '2026-09-01' },
  { id: 'T2', project: 'A', status: 'Open', weight: 60, expectedEndDate: '2026-10-18' },
  { id: 'T3', project: 'A', status: 'Cancelled', weight: 20, expectedEndDate: '2026-08-01' },
  { id: 'T4', project: 'B', status: 'Working', weight: '', expectedEndDate: '2026-10-01' },
  { id: 'T5', project: 'B', status: 'Completed', weight: '', expectedEndDate: '' },
];
const timesheets = [
  {
    id: 'TS-1', employee: 'Rohan', project: 'A', status: 'Submitted',
    timeSheets: [
      { activityType: 'Visit', fromTime: '2026-10-12T09:00', hrs: 4, project: 'A', isBillable: true, billingRate: 1000, costingRate: 500 },
      { activityType: 'Visit', fromTime: '2026-09-30T09:00', hrs: 2, project: '', isBillable: false, billingRate: 1000, costingRate: 500 },
    ],
  },
];

describe('reportData', () => {
  it('todayStr is the local calendar date', () => {
    const d = new Date();
    expect(todayStr()).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  });

  it('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-10-18', TODAY)).toBe(1);
    expect(daysBetween('2026-09-30', TODAY)).toBe(19);
  });

  it('projectProgress is weighted when weights exist and ignores cancelled tasks', () => {
    expect(projectProgress('A', tasks)).toBe(25); // 20 / (20 + 60)
    expect(projectProgress('B', tasks)).toBe(50); // count based
    expect(projectProgress('Z', tasks)).toBe(0);
  });

  it('delayedTasks lists open overdue tasks, most delayed first', () => {
    const d = delayedTasks(tasks, TODAY);
    expect(d.map((t) => [t.id, t.delayDays])).toEqual([['T4', 18], ['T2', 1]]);
  });

  it('delayBuckets groups by delay length', () => {
    const b = delayBuckets([{ delayDays: 1 }, { delayDays: 3 }, { delayDays: 5 }, { delayDays: 9 }]);
    expect(b.map((x) => x.value)).toEqual([2, 1, 1]);
  });

  it('entryRows falls back to the sheet project and computes amounts', () => {
    const rows = entryRows(timesheets);
    expect(rows[1].project).toBe('A');
    expect(rows[0].billingAmount).toBe(4000);
    expect(rows[1].billingAmount).toBe(0); // not billable
    expect(rows[1].costingAmount).toBe(1000);
  });

  it('hoursBy aggregates hours and amounts', () => {
    const [r] = hoursBy(entryRows(timesheets), (e) => e.employee);
    expect(r).toMatchObject({ name: 'Rohan', hours: 6, billable: 4, billingAmount: 4000, costingAmount: 3000 });
  });

  it('monthlyHours zero-fills the last months', () => {
    const m = monthlyHours(entryRows(timesheets), TODAY, 3);
    expect(m.map((x) => x.value)).toEqual([0, 2, 4]);
    expect(m[2].date).toBe('Oct 2026');
  });

  it('projectCosts compares estimate with costing', () => {
    const [p] = projectCosts([{ id: 'P1', projectName: 'A', status: 'Open', estimatedCost: 10000 }], entryRows(timesheets));
    expect(p).toMatchObject({ estimated: 10000, hours: 6, costing: 3000, billing: 4000, variance: 7000 });
  });

  it('dashboardStats summarises the month', () => {
    const s = dashboardStats([{ status: 'Open' }, { status: 'Completed' }], tasks, timesheets, TODAY);
    expect(s).toMatchObject({ openProjects: 1, completedProjects: 1, openTasks: 2, delayedTasks: 2, hoursThisMonth: 4, billableThisMonth: 4000 });
  });
});
