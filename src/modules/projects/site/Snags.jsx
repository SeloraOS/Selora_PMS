import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSite } from '../../../context/SiteContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { useProjects } from '../../../context/ProjectsContext';
import { SEVERITIES, SNAG_STATUSES, snagOverdue, dueDateFor } from '../../../lib/site';
import { todayStr } from '../../../lib/reportData';
import { FilesPanel } from '../../../components/shared/RecordPanels';
import { useRowCtx } from '../../../lib/useRowCtx';
import { SnagCard } from '../rowCards';

const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');
const SEV = { Low: ['var(--st-blue-bg)', 'var(--st-blue-fg)'], Medium: ['var(--st-amber-bg)', 'var(--st-amber-fg)'], High: ['var(--st-red-bg)', 'var(--st-red-fg)'], Critical: ['var(--st-red-bg)', 'var(--st-red-fg)'] };
const STATUS = { Open: ['var(--st-amber-bg)', 'var(--st-amber-fg)'], Fixed: ['var(--st-blue-bg)', 'var(--st-blue-fg)'], Verified: ['var(--st-green-bg)', 'var(--st-green-fg)'], Rejected: ['var(--surface-gray-2)', 'var(--text-light)'] };
const Pill = ({ map, value, ...rest }) => { const [bg, fg] = map[value] || ['var(--surface-gray-2)', 'var(--text-light)']; return <span {...rest} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: bg, color: fg, fontWeight: 600 }}>{value}</span>; };

export default function Snags() {
  const { snags, snagCategories, loaded, save, remove } = useSite();
  const { settings, profiles } = useSetup();
  const { projects } = useProjects();
  const { user, isStaff, isInternal, role } = useAuth();
  const today = todayStr();
  const ctx = useRowCtx();
  const pname = (r) => projects.find((p) => p.dbId === r.project_id)?.projectName || '—';
  const who = (id) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || '';
  const contractor = role === 'contractor';
  // contractors can only move their snags between Open and Fixed; clients can report but not edit afterwards
  const canEdit = isInternal || contractor;
  const assignable = profiles.filter((p) => ['admin', 'manager', 'member', 'contractor'].includes(p.role));

  return (
    <SetupListPage
      title="Snag"
      rows={snags}
      loading={!loaded}
      canEdit={canEdit}
      canCreate
      entity="snag"
      ctx={ctx}
      defaultSort={{ key: 'code', order: 'desc' }}
      card={(r) => <SnagCard snag={r} ctx={ctx} />}
      canMove={(r) => !contractor || r.assignee_id === user?.id}
      onMove={(r, patch) => (contractor && patch.status === undefined ? null : save('snags', contractor ? { status: patch.status } : patch, r.id))}
      canDelete={(r) => isStaff || (isInternal && r.reported_by === user?.id)}
      fieldDisabled={(f, row) => contractor && !!row && f.name !== 'status'}
      searchText={(r) => `${r.code} ${r.title} ${r.location || ''} ${pname(r)}`}
      filters={[
        { key: 'status', label: 'Status', options: SNAG_STATUSES, get: (r) => r.status },
        { key: 'severity', label: 'Severity', options: SEVERITIES, get: (r) => r.severity },
      ]}
      columns={[
        { key: 'code', label: 'ID', sortType: 'code' },
        { key: 'title', label: 'Snag' },
        { key: 'project', label: 'Project', render: pname, sortValue: pname },
        { key: 'location', label: 'Location' },
        { key: 'severity', label: 'Severity', sortType: 'rank', rank: SEVERITIES, render: (r) => <Pill map={SEV} value={r.severity} /> },
        { key: 'status', label: 'Status', sortType: 'rank', rank: SNAG_STATUSES, render: (r) => <Pill map={STATUS} value={r.status} /> },
        { key: 'due', label: 'Due', sortType: 'date', sortValue: (r) => r.due_date, render: (r) => <span style={{ color: snagOverdue(r, today) ? 'var(--st-red-fg)' : undefined, fontWeight: snagOverdue(r, today) ? 600 : 400 }}>{fmt(r.due_date)}</span> },
        { key: 'assignee', label: 'Assigned to', sortValue: (r) => who(r.assignee_id), render: (r) => who(r.assignee_id) || '—' },
        { key: 'category', label: 'Category', defaultVisible: false },
        { key: 'created_at', label: 'Created', sortType: 'date', defaultVisible: false, render: (r) => fmt(r.created_at?.slice(0, 10)) },
      ]}
      fields={[
        { name: 'project_id', label: 'Project', type: 'select', required: true, options: projects.map((p) => ({ value: p.dbId, label: p.projectName })) },
        { name: 'title', label: 'Snag', required: true },
        { name: 'location', label: 'Location (tower / floor / unit)' },
        { name: 'category', label: 'Category', type: 'select', options: snagCategories.map((c) => ({ value: c.name, label: c.name })) },
        { name: 'severity', label: 'Severity', type: 'select', default: 'Medium', options: SEVERITIES.map((s) => ({ value: s, label: s })) },
        { name: 'status', label: 'Status', type: 'select', default: 'Open', options: (contractor ? ['Open', 'Fixed'] : SNAG_STATUSES).map((s) => ({ value: s, label: s })) },
        ...(isInternal ? [
          { name: 'assignee_id', label: 'Assigned to', type: 'select', options: assignable.map((p) => ({ value: p.id, label: p.full_name || p.email })) },
          { name: 'due_date', label: 'Due date', type: 'date', default: dueDateFor(today, settings?.snag_default_due_days) },
          { name: 'visibility', label: 'Visible to', type: 'select', default: 'internal', options: [{ value: 'internal', label: 'Internal only' }, { value: 'shared', label: 'Clients & contractors on this project' }] },
        ] : []),
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      fromForm={(v) => ({
        project_id: v.project_id, title: v.title.trim(), location: v.location || null, category: v.category || null, severity: v.severity || 'Medium', status: v.status || 'Open',
        description: v.description || null,
        ...(isInternal ? { assignee_id: v.assignee_id || null, due_date: v.due_date || null, visibility: v.visibility || 'internal' } : {}),
      })}
      onSave={(values, row) => {
        // contractors may only send the status change (the database rejects anything else)
        const patch = contractor && row ? { status: values.status } : values;
        return save('snags', row ? patch : { ...patch, reported_by: user.id }, row?.id);
      }}
      onDelete={(row) => remove('snags', row.id)}
      renderRow={(row) => <FilesPanel projectId={row.project_id} recordType="snag" recordId={row.id} />}
    />
  );
}
