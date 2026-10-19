import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useFinance } from '../../../context/FinanceContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useAuth } from '../../../context/AuthContext';
import { fmtDate, Pill } from './shared';

const STATUSES = ['requested', 'approved', 'ordered', 'delivered', 'rejected'];
const COLOR = { requested: 'amber', approved: 'blue', ordered: 'blue', delivered: 'green', rejected: 'red' };

export default function MaterialRequests() {
  const { materialRequests, loaded, save, remove } = useFinance();
  const { projects } = useProjects();
  const { user, isStaff } = useAuth();
  const pname = (r) => projects.find((p) => p.dbId === r.project_id)?.projectName || '—';
  return (
    <SetupListPage
      title="Material Request"
      rows={materialRequests}
      loading={!loaded}
      canEdit
      canDelete={(r) => isStaff || r.requested_by === user?.id}
      searchText={(r) => `${r.code} ${r.item} ${pname(r)}`}
      filters={[{ key: 'status', label: 'Status', options: STATUSES, get: (r) => r.status }]}
      columns={[
        { key: 'code', label: 'ID' },
        { key: 'item', label: 'Item' },
        { key: 'project', label: 'Project', render: pname },
        { key: 'qty', label: 'Quantity', render: (r) => `${Number(r.quantity)} ${r.unit}` },
        { key: 'needed_by', label: 'Needed by', render: (r) => fmtDate(r.needed_by) },
        { key: 'status', label: 'Status', render: (r) => <Pill color={COLOR[r.status]}>{r.status}</Pill> },
      ]}
      fields={[
        { name: 'project_id', label: 'Project', type: 'select', required: true, options: projects.map((p) => ({ value: p.dbId, label: p.projectName })) },
        { name: 'item', label: 'Item', required: true },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true, default: '1' },
        { name: 'unit', label: 'Unit', default: 'nos' },
        { name: 'needed_by', label: 'Needed by', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', default: 'requested', options: STATUSES.map((s) => ({ value: s, label: s })) },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      fromForm={(v) => ({ project_id: v.project_id, item: v.item.trim(), quantity: Number(v.quantity), unit: v.unit || 'nos', needed_by: v.needed_by || null, status: v.status || 'requested', notes: v.notes || null })}
      onSave={(values, row) => save('material_requests', row ? values : { ...values, requested_by: user.id }, row?.id)}
      onDelete={(row) => remove('material_requests', row.id)}
    />
  );
}
