import { describe, it, expect } from 'vitest';
import { summarizeAudit } from '../audit';
import { can, isStaff, isExternal, isInternal, defaultProjectRole } from '../permissions';

describe('summarizeAudit', () => {
  it('describes inserts and deletes', () => {
    expect(summarizeAudit({ table_name: 'project_tasks', action: 'insert' })).toEqual({ title: 'Created task', details: [] });
    expect(summarizeAudit({ table_name: 'projects', action: 'delete' })).toEqual({ title: 'Deleted project', details: [] });
  });
  it('lists changed fields with old and new values and hides internals', () => {
    const s = summarizeAudit({ table_name: 'project_tasks', action: 'update', changes: {
      status: { old: 'Open', new: 'Working' }, expected_end_date: { old: null, new: '2026-11-01' }, updated_at: { old: 'a', new: 'b' }, project_id: { old: 'x', new: 'y' } } });
    expect(s.title).toBe('Updated task');
    expect(s.details).toEqual(['Status: Open → Working', 'Expected end: — → 2026-11-01']);
  });
  it('falls back to a readable label for unknown columns', () => {
    expect(summarizeAudit({ table_name: 'pm_settings', action: 'update', changes: { default_billing_rate: { old: 1, new: 1000 } } }).details).toEqual(['Default billing rate: 1 → 1000']);
  });
});

describe('permissions', () => {
  const p = (role, id = 'u1') => ({ role, id });
  it('classifies roles', () => {
    expect([isStaff(p('admin')), isStaff(p('manager')), isStaff(p('member'))]).toEqual([true, true, false]);
    expect([isInternal(p('member')), isInternal(p('client'))]).toEqual([true, false]);
    expect([isExternal(p('client')), isExternal(p('contractor')), isExternal(p('admin'))]).toEqual([true, true, false]);
  });
  it('only staff manage members, invite and edit setup; only admins manage users', () => {
    for (const a of ['manageMembers', 'invite', 'editSetup']) { expect(can(p('manager'), a)).toBe(true); expect(can(p('member'), a)).toBe(false); expect(can(p('client'), a)).toBe(false); }
    expect(can(p('manager'), 'manageUsers')).toBe(false); expect(can(p('admin'), 'manageUsers')).toBe(true);
  });
  it('externals cannot create, view internal data or delete', () => {
    for (const r of ['client', 'contractor']) { expect(can(p(r), 'createRecords')).toBe(false); expect(can(p(r), 'viewInternal')).toBe(false); expect(can(p(r), 'delete', { createdBy: 'u1' })).toBe(false); }
    expect(can(p('member'), 'delete', { createdBy: 'u1' })).toBe(true);
    expect(can(p('member'), 'delete', { createdBy: 'other' })).toBe(false);
    expect(can(p('manager'), 'delete', { createdBy: 'other' })).toBe(true);
  });
  it('default project role follows the account role', () => {
    expect(defaultProjectRole('client')).toBe('client'); expect(defaultProjectRole('contractor')).toBe('contractor'); expect(defaultProjectRole('member')).toBe('staff'); expect(defaultProjectRole('x')).toBe('viewer');
  });
});
