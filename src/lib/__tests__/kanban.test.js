import { describe, it, expect } from 'vitest';
import { PIPELINES, pipelineById, NONE } from '../kanban';

const ctx = { projects: [{ projectName: 'A' }, { projectName: 'B' }], projectTypes: [{ name: 'Residential' }] };

describe('pipelines', () => {
  it('each page offers the agreed pipelines, status first', () => {
    expect(PIPELINES.project.map((p) => p.id)).toEqual(['status', 'priority', 'type', 'department']);
    expect(PIPELINES.task.map((p) => p.id)).toEqual(['status', 'priority', 'project']);
    expect(PIPELINES.timesheet.map((p) => p.id)).toEqual(['status', 'employee', 'project', 'customer']);
  });
  it('unknown ids fall back to the first pipeline', () => {
    expect(pipelineById('task', 'nope').id).toBe('status');
  });
  it('status columns match the database values', () => {
    expect(pipelineById('task', 'status').columns([], ctx).map((c) => c.id)).toEqual(['Open', 'Working', 'Pending', 'Overdue', 'Completed', 'Cancelled']);
  });
  it('relation pipelines list every option plus Unassigned, and dropping on Unassigned clears the field', () => {
    const p = pipelineById('task', 'project');
    expect(p.columns([], ctx).map((c) => c.id)).toEqual(['A', 'B', NONE]);
    expect(p.column({ project: '' })).toBe(NONE);
    expect(p.patch(NONE)).toEqual({ project: '' });
    expect(p.patch('B')).toEqual({ project: 'B' });
  });
  it('free-text pipelines build their columns from the values in use', () => {
    const p = pipelineById('timesheet', 'employee');
    const items = [{ employee: 'Zed' }, { employee: 'Amy' }, { employee: 'Amy' }, { employee: '' }];
    expect(p.columns(items, ctx).map((c) => c.id)).toEqual(['Amy', 'Zed', NONE]);
    expect(p.columns([{ employee: 'Amy' }], ctx).map((c) => c.id)).toEqual(['Amy']); // no Unassigned when everything is set
  });
});

import { PIPELINES as P2, NONE as NONE2 } from '../kanban';
describe('row-entity pipelines', () => {
  const ctx = { projects: [{ projectName: 'A' }, { projectName: 'B' }], projectName: (id) => ({ p1: 'A' }[id]), today: '2026-06-01', warnDays: 30, vendors: [{ name: 'V1' }], vendorName: (id) => ({ v1: 'V1' }[id]) };
  it('groups snags by status, severity and project (read-only)', () => {
    const snag = { status: 'Fixed', severity: 'High', project_id: 'p1', category: '' };
    const [status, severity, category, project] = P2.snag;
    expect(status.column(snag, ctx)).toBe('Fixed');
    expect(status.patch('Verified')).toEqual({ status: 'Verified' });
    expect(severity.column(snag, ctx)).toBe('High');
    expect(category.column(snag, ctx)).toBe(NONE2);
    expect(project.readOnly).toBe(true);
    expect(project.column(snag, ctx)).toBe('A');
    expect(project.column({ project_id: 'zz' }, ctx)).toBe(NONE2);
    expect(project.columns([], ctx).map((c) => c.id)).toEqual(['A', 'B', NONE2]);
  });
  it('derives approval validity and cannot be dragged', () => {
    const validity = P2.approval[1];
    expect(validity.readOnly).toBe(true);
    expect(validity.column({ status: 'Approved', expiry_on: '2026-06-10' }, ctx)).toBe('expiring');
    expect(validity.column({ status: 'Approved', expiry_on: '2026-05-10' }, ctx)).toBe('expired');
    expect(validity.column({ status: 'Applied' }, ctx)).toBe('pending');
  });
  it('covers finance and site entities', () => {
    for (const k of ['workOrder', 'raBill', 'materialRequest', 'dailyReport', 'projectUpdate', 'budget']) expect(P2[k].length).toBeGreaterThan(0);
    expect(P2.workOrder[0].columns().map((c) => c.id)).toEqual(['draft', 'pending_approval', 'approved', 'closed', 'cancelled']);
    expect(P2.raBill[1].column({ vendor_id: 'v1' }, ctx)).toBe('V1');
    expect(P2.budget[0].column({ health: { key: 'warn' } }, ctx)).toBe('warn');
  });
});
