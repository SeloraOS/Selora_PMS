import { describe, it, expect } from 'vitest';
import { criticalPath, ganttSpan, baselineSlip, workingDays, ganttRange, barGeometry } from '../gantt';
import { approvalState, snagOverdue, missingReports, siteAlerts, totalManpower } from '../site';

const T = (id, s, e, deps = []) => ({ id, expectedStartDate: s, expectedEndDate: e, dependencies: deps.map((taskId) => ({ taskId })) });

describe('gantt', () => {
  it('spans fall back to the other date', () => {
    expect(ganttSpan(T('a', '2026-01-02', ''))).toEqual({ start: '2026-01-02', end: '2026-01-02' });
    expect(ganttSpan(T('a', '', ''))).toBeNull();
    expect(ganttSpan(T('a', '2026-01-05', '2026-01-02'))).toEqual({ start: '2026-01-05', end: '2026-01-05' });
  });
  it('finds the longest chain as the critical path', () => {
    const tasks = [T('a', '2026-01-01', '2026-01-03'), T('b', '2026-01-04', '2026-01-10', ['a']), T('c', '2026-01-04', '2026-01-05', ['a']), T('d', '2026-01-11', '2026-01-12', ['b', 'c'])];
    expect([...criticalPath(tasks)].sort()).toEqual(['a', 'b', 'd']);
  });
  it('has no critical path without links or with cycles', () => {
    expect(criticalPath([T('a', '2026-01-01', '2026-01-03')]).size).toBe(0);
    expect(criticalPath([T('a', '2026-01-01', '2026-01-03', ['b']), T('b', '2026-01-01', '2026-01-03', ['a'])]).size).toBe(0);
  });
  it('computes baseline slip, ranges and geometry', () => {
    expect(baselineSlip({ ...T('a', '2026-01-01', '2026-01-12'), baselineEnd: '2026-01-10' })).toBe(2);
    expect(baselineSlip(T('a', '2026-01-01', '2026-01-12'))).toBeNull();
    expect(ganttRange([T('a', '2026-01-10', '2026-01-12')], '2026-01-01')).toEqual({ from: '2026-01-08', to: '2026-01-17' });
    expect(barGeometry('2026-01-10', '2026-01-12', '2026-01-08')).toEqual({ offset: 2, length: 3 });
  });
  it('counts working days', () => {
    expect(workingDays('2026-01-05', '2026-01-11')).toBe(6); // Mon..Sun, Sunday off
    expect(workingDays('2026-01-05', '2026-01-11', undefined, new Set(['2026-01-06']))).toBe(5);
  });
});

describe('site helpers', () => {
  const today = '2026-06-01';
  it('classifies approvals', () => {
    expect(approvalState({ status: 'Approved', expiry_on: '2026-05-01' }, today).key).toBe('expired');
    expect(approvalState({ status: 'Approved', expiry_on: '2026-06-20' }, today, 30)).toEqual({ key: 'expiring', days: 19 });
    expect(approvalState({ status: 'Approved', expiry_on: '2027-06-20' }, today).key).toBe('valid');
    expect(approvalState({ status: 'Approved' }, today).key).toBe('valid');
    expect(approvalState({ status: 'Applied' }, today).key).toBe('pending');
    expect(approvalState({ status: 'Rejected' }, today).key).toBe('rejected');
  });
  it('flags overdue snags only while unresolved', () => {
    expect(snagOverdue({ status: 'Open', due_date: '2026-05-30' }, today)).toBe(true);
    expect(snagOverdue({ status: 'Verified', due_date: '2026-05-30' }, today)).toBe(false);
    expect(snagOverdue({ status: 'Open', due_date: null }, today)).toBe(false);
  });
  it('lists projects missing a report only after the cutoff', () => {
    const projects = [{ dbId: 'p1', status: 'Open', projectName: 'A' }, { dbId: 'p2', status: 'Open', projectName: 'B' }, { dbId: 'p3', status: 'Completed' }];
    const reports = [{ project_id: 'p1', report_date: today, status: 'submitted' }];
    expect(missingReports(projects, reports, today, '19:00', '18:00', true).map((p) => p.dbId)).toEqual(['p2']);
    expect(missingReports(projects, reports, today, '10:00', '18:00', true)).toEqual([]);
    expect(missingReports(projects, reports, today, '19:00', '18:00', false)).toEqual([]);
  });
  it('builds alert counts and sums manpower', () => {
    const r = siteAlerts({ approvals: [{ id: 'a', name: 'Fire NOC', project_id: 'p1', status: 'Approved', expiry_on: '2026-06-10' }], snags: [{ id: 's', code: 'SNAG-1', title: 'Crack', project_id: 'p1', status: 'Open', due_date: '2026-05-25', severity: 'High' }], reports: [], projects: [{ dbId: 'p1', projectName: 'A', status: 'Open' }] }, { today, nowHm: '10:00', settings: {} });
    expect(r.count).toBe(2);
    expect(r.snags[0].days).toBe(7);
    expect(totalManpower([{ head_count: 3 }, { head_count: '4' }])).toBe(7);
  });
});
