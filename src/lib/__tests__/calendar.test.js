import { describe, it, expect } from 'vitest';
import { monthGrid, weekDays, rangeFor, taskSpan, shiftTask, buildEvents, groupByDay, addMonths, weekdayIndex, daysInMonth } from '../calendar';

describe('month grid', () => {
  it('starts on Monday and pads with neighbouring months', () => {
    const g = monthGrid(2026, 9); // Oct 2026: Thu 1st
    expect(g[0][0]).toEqual({ date: '2026-09-28', inMonth: false });
    expect(g[0][3]).toEqual({ date: '2026-10-01', inMonth: true });
    expect(g.length).toBe(5);
    expect(g.at(-1)[6].date).toBe('2026-11-01');
  });
  it('uses 6 rows when needed and 4 rows for a Monday-start 28-day February', () => {
    expect(monthGrid(2026, 7).length).toBe(6); // Aug 2026: Sat 1st, 31 days
    expect(monthGrid(2027, 1).length).toBe(4); // Feb 2027: Mon 1st, 28 days
    expect(monthGrid(2028, 1).flat().filter((c) => c.inMonth).length).toBe(29); // leap year
  });
  it('helpers', () => {
    expect(weekdayIndex('2026-10-19')).toBe(0); // Monday
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });
  it('week and range', () => {
    expect(weekDays('2026-10-21')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(rangeFor('week', '2026-10-21')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(rangeFor('agenda', '2026-10-21')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(rangeFor('month', '2026-10-21')).toEqual({ from: '2026-09-28', to: '2026-11-01' });
  });
});

describe('task spans', () => {
  it('handles missing and inverted dates', () => {
    expect(taskSpan({ expectedStartDate: '', expectedEndDate: '' })).toBeNull();
    expect(taskSpan({ expectedStartDate: '2026-10-02', expectedEndDate: '' })).toEqual({ start: '2026-10-02', end: '2026-10-02' });
    expect(taskSpan({ expectedStartDate: '', expectedEndDate: '2026-10-05' })).toEqual({ start: '2026-10-05', end: '2026-10-05' });
    expect(taskSpan({ expectedStartDate: '2026-10-09', expectedEndDate: '2026-10-05' })).toEqual({ start: '2026-10-09', end: '2026-10-09' });
  });
  it('shifting keeps the duration, also across months and years', () => {
    expect(shiftTask({ expectedStartDate: '2026-12-30', expectedEndDate: '2027-01-02' }, 3)).toEqual({ expectedStartDate: '2027-01-02', expectedEndDate: '2027-01-05' });
    expect(shiftTask({ expectedStartDate: '2026-10-10', expectedEndDate: '2026-10-12' }, -10)).toEqual({ expectedStartDate: '2026-09-30', expectedEndDate: '2026-10-02' });
    expect(shiftTask({ expectedStartDate: '', expectedEndDate: '2026-10-12' }, 1)).toEqual({ expectedEndDate: '2026-10-13' });
  });
});

const data = {
  tasks: [
    { id: 'T1', subject: 'Wide', project: 'A', status: 'Open', priority: 'High', expectedStartDate: '2026-10-08', expectedEndDate: '2026-10-12' },
    { id: 'T2', subject: 'Done', project: 'B', status: 'Completed', priority: 'Low', expectedStartDate: '2026-10-01', expectedEndDate: '2026-10-02' },
    { id: 'T3', subject: 'Outside', project: 'A', status: 'Open', priority: 'Low', expectedStartDate: '2026-12-01', expectedEndDate: '2026-12-02' },
  ],
  projects: [{ id: 'P1', projectName: 'A', status: 'Open', expectedStartDate: '2026-10-01', expectedEndDate: '2026-10-15', actualEndDate: '' }],
  entries: [
    { date: '2026-10-09', hours: 3, employee: 'Rohan', project: 'A' },
    { date: '2026-10-09', hours: 2.5, employee: 'Neha', project: 'A' },
    { date: '2026-10-09', hours: 1, employee: 'Neha', project: 'B' },
    { date: '', hours: 9, employee: 'X', project: 'A' },
  ],
  holidays: [{ holiday_date: '2026-10-02', description: 'Gandhi Jayanti' }, { holiday_date: '2026-11-08', description: 'Diwali' }],
  updates: [{ id: 'U1', update_date: '2026-10-10', type: 'Issue', description: 'Blocked', projects: { project_name: 'A' } }],
};
const base = { from: '2026-10-01', to: '2026-10-31', today: '2026-10-11' };

describe('buildEvents', () => {
  it('emits one chip per day of a task span, flags start/end and overdue', () => {
    const ev = buildEvents(data, { ...base, types: new Set(['task']) });
    const t1 = ev.filter((e) => e.id === 'T1');
    expect(t1.map((e) => e.date)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
    expect(t1[0].isStart).toBe(true); expect(t1.at(-1).isEnd).toBe(true);
    expect(t1.every((e) => e.overdue === false)).toBe(true);
    expect(ev.filter((e) => e.id === 'T2').every((e) => e.overdue === false)).toBe(true); // closed tasks are never overdue
    expect(ev.some((e) => e.id === 'T3')).toBe(false);
    const late = buildEvents(data, { ...base, today: '2026-10-20', types: new Set(['task']) }).filter((e) => e.id === 'T1');
    expect(late.every((e) => e.overdue)).toBe(true);
  });
  it('clips spans to the visible range', () => {
    const ev = buildEvents(data, { ...base, from: '2026-10-10', to: '2026-10-11', types: new Set(['task']) }).filter((e) => e.id === 'T1');
    expect(ev.map((e) => e.date)).toEqual(['2026-10-10', '2026-10-11']);
  });
  it('aggregates timesheet hours per day with a per-person breakdown', () => {
    const [e] = buildEvents(data, { ...base, types: new Set(['timesheet']) });
    expect(e).toMatchObject({ date: '2026-10-09', hours: 6.5, title: '6.5 h logged' });
    expect(e.sub).toBe('Rohan 3 h, Neha 3.5 h');
  });
  it('project filter applies to tasks, project dates, hours and updates', () => {
    const ev = buildEvents(data, { ...base, types: new Set(['task', 'project', 'timesheet', 'update']), project: 'B' });
    expect(ev.every((e) => e.id === 'T2' || e.type === 'timesheet')).toBe(true);
    expect(ev.find((e) => e.type === 'timesheet').hours).toBe(1);
    expect(ev.some((e) => e.type === 'update')).toBe(false);
  });
  it('project start/due and holidays and updates', () => {
    const ev = buildEvents(data, { ...base, types: new Set(['project', 'holiday', 'update']) });
    expect(ev.filter((e) => e.type === 'project').map((e) => e.kind)).toEqual(['start', 'end']);
    expect(ev.filter((e) => e.type === 'holiday').map((e) => e.title)).toEqual(['Gandhi Jayanti']); // Diwali is outside the range
    expect(ev.find((e) => e.type === 'update')).toMatchObject({ date: '2026-10-10', kind: 'Issue', sub: 'A' });
  });
  it('groups by day in a stable order (holiday, project, update, timesheet, task)', () => {
    const g = groupByDay(buildEvents(data, { ...base, types: new Set(['task', 'project', 'timesheet', 'holiday', 'update']) }));
    expect(g.get('2026-10-02').map((e) => e.type)).toEqual(['holiday', 'task']);
    expect(g.get('2026-10-09').map((e) => e.type)).toEqual(['timesheet', 'task']);
    // overdue and start/end days outrank the days in between
    const mixed = groupByDay([
      { type: 'task', date: 'd', title: 'a-mid', overdue: false, isStart: false, isEnd: false },
      { type: 'task', date: 'd', title: 'b-start', overdue: false, isStart: true, isEnd: false },
      { type: 'task', date: 'd', title: 'c-late', overdue: true, isStart: false, isEnd: false },
    ]);
    expect(mixed.get('d').map((e) => e.title)).toEqual(['c-late', 'b-start', 'a-mid']);
  });
});
