import React, { useState } from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSite } from '../../../context/SiteContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { useProjects } from '../../../context/ProjectsContext';
import { can } from '../../../lib/permissions';
import { approvalState, APPROVAL_STATUSES } from '../../../lib/site';
import { todayStr } from '../../../lib/reportData';

const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');
const COLORS = {
  expired: ['var(--st-red-bg)', 'var(--st-red-fg)'], expiring: ['var(--st-amber-bg)', 'var(--st-amber-fg)'],
  valid: ['var(--st-green-bg)', 'var(--st-green-fg)'], pending: ['var(--st-blue-bg)', 'var(--st-blue-fg)'], rejected: ['var(--st-red-bg)', 'var(--st-red-fg)'],
};

export function ApprovalBadge({ approval, today, warnDays }) {
  const st = approvalState(approval, today, warnDays);
  const [bg, fg] = COLORS[st.key];
  const text = { expired: `Expired ${Math.abs(st.days)} d ago`, expiring: st.days === 0 ? 'Expires today' : `Expires in ${st.days} d`, valid: 'Valid', pending: approval.status, rejected: 'Rejected' }[st.key];
  return <span data-testid="approval-badge" data-state={st.key} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: bg, color: fg, fontWeight: 600, whiteSpace: 'nowrap' }}>{text}</span>;
}

export default function Approvals() {
  const { approvals, loaded, save, remove, addStandardApprovals } = useSite();
  const { settings } = useSetup();
  const { projects } = useProjects();
  const { profile } = useAuth();
  const [stdProject, setStdProject] = useState('');
  const today = todayStr();
  const warn = settings?.approval_warning_days ?? 30;
  const pname = (r) => projects.find((p) => p.dbId === r.project_id)?.projectName || '—';
  const editable = can(profile, 'createRecords');

  const extra = editable && (
    <div style={{ display: 'flex', gap: '6px' }}>
      <select aria-label="Project for standard approvals" value={stdProject} onChange={(e) => setStdProject(e.target.value)} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '13px', background: 'var(--control-bg)', color: 'var(--text-color)' }}>
        <option value="">Project…</option>
        {projects.map((p) => <option key={p.dbId} value={p.dbId}>{p.projectName}</option>)}
      </select>
      <button disabled={!stdProject} onClick={async () => { const n = await addStandardApprovals(stdProject); if (n !== null) window.alert(n ? `Added ${n} standard approvals.` : 'All standard approvals are already on this project.'); }}
        style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', background: 'var(--control-bg)', color: 'var(--text-muted)', cursor: stdProject ? 'pointer' : 'default', opacity: stdProject ? 1 : 0.6 }}>
        Add standard set
      </button>
    </div>
  );

  return (
    <SetupListPage
      title="Approval"
      rows={approvals}
      loading={!loaded}
      canEdit={editable}
      canDelete={() => can(profile, 'editSetup')}
      extraActions={extra}
      searchText={(r) => `${r.name} ${r.authority || ''} ${r.reference_no || ''} ${pname(r)}`}
      filters={[{ key: 'status', label: 'Status', options: APPROVAL_STATUSES, get: (r) => r.status }]}
      columns={[
        { key: 'name', label: 'Approval' },
        { key: 'project', label: 'Project', render: pname },
        { key: 'authority', label: 'Authority' },
        { key: 'status', label: 'Status' },
        { key: 'expiry_on', label: 'Expiry', render: (r) => fmt(r.expiry_on) },
        { key: 'state', label: 'Validity', render: (r) => <ApprovalBadge approval={r} today={today} warnDays={warn} /> },
      ]}
      fields={[
        { name: 'project_id', label: 'Project', type: 'select', required: true, options: projects.map((p) => ({ value: p.dbId, label: p.projectName })) },
        { name: 'name', label: 'Approval', required: true },
        { name: 'authority', label: 'Authority' },
        { name: 'reference_no', label: 'Reference no.' },
        { name: 'status', label: 'Status', type: 'select', default: 'Not started', options: APPROVAL_STATUSES.map((s) => ({ value: s, label: s })) },
        { name: 'applied_on', label: 'Applied on', type: 'date' },
        { name: 'approved_on', label: 'Approved on', type: 'date' },
        { name: 'expiry_on', label: 'Expires on', type: 'date' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      fromForm={(v) => ({
        project_id: v.project_id, name: v.name.trim(), authority: v.authority || null, reference_no: v.reference_no || null, status: v.status || 'Not started',
        applied_on: v.applied_on || null, approved_on: v.approved_on || null, expiry_on: v.expiry_on || null, notes: v.notes || null,
      })}
      onSave={(values, row) => save('approvals', values, row?.id)}
      onDelete={(row) => remove('approvals', row.id)}
    />
  );
}
