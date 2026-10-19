import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useFinance } from '../../../context/FinanceContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../lib/reportData';
import { WO_STATUS_LABELS } from '../../../lib/finance';
import { FilesPanel } from '../../../components/shared/RecordPanels';
import { fmtDate, Pill, WO_COLOR } from './shared';

export default function WorkOrders() {
  const { workOrders, bills, vendors, costHeads, loaded, save, remove } = useFinance();
  const { projects } = useProjects();
  const { settings } = useSetup();
  const { user, isStaff, isInternal } = useAuth();
  const pname = (r) => projects.find((p) => p.dbId === r.project_id)?.projectName || '—';
  const vname = (r) => vendors.find((v) => v.id === r.vendor_id)?.name || '—';
  const billed = (r) => bills.filter((b) => b.work_order_id === r.id && b.status !== 'rejected').reduce((n, b) => n + Number(b.gross_amount), 0);
  const limit = Number(settings?.po_approval_limit) || 0;

  return (
    <SetupListPage
      title="Work Order"
      rows={workOrders}
      loading={!loaded}
      canEdit={isInternal}
      canDelete={(r) => isStaff || (r.created_by === user?.id && r.status === 'draft')}
      searchText={(r) => `${r.code} ${r.title} ${pname(r)} ${vname(r)}`}
      filters={[{ key: 'status', label: 'Status', options: Object.keys(WO_STATUS_LABELS), get: (r) => r.status }]}
      columns={[
        { key: 'code', label: 'ID' },
        { key: 'title', label: 'Work order' },
        { key: 'project', label: 'Project', render: pname },
        { key: 'vendor', label: 'Vendor', render: vname },
        { key: 'amount', label: 'Value', render: (r) => formatINR(Number(r.amount)) },
        { key: 'billed', label: 'Billed', render: (r) => formatINR(billed(r)) },
        { key: 'status', label: 'Status', render: (r) => <Pill color={WO_COLOR[r.status]}>{WO_STATUS_LABELS[r.status]}</Pill> },
        { key: 'end', label: 'Ends', render: (r) => fmtDate(r.end_date) },
      ]}
      fields={[
        { name: 'project_id', label: 'Project', type: 'select', required: true, options: projects.map((p) => ({ value: p.dbId, label: p.projectName })) },
        { name: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendors.filter((v) => v.is_active).map((v) => ({ value: v.id, label: v.name })) },
        { name: 'cost_head_id', label: 'Cost head', type: 'select', required: true, options: costHeads.map((c) => ({ value: c.id, label: c.name })) },
        { name: 'title', label: 'Scope of work', required: true },
        { name: 'amount', label: `Value (₹) — approval by an admin or manager above ${formatINR(limit)}`, type: 'number', required: true },
        { name: 'retention_percent', label: `Retention % (blank = ${settings?.retention_percent ?? 5}% default)`, type: 'number' },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: Object.entries(WO_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
        { name: 'start_date', label: 'Start date', type: 'date' },
        { name: 'end_date', label: 'End date', type: 'date' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      fromForm={(v) => ({
        project_id: v.project_id, vendor_id: v.vendor_id, cost_head_id: v.cost_head_id, title: v.title.trim(), amount: Number(v.amount),
        retention_percent: v.retention_percent === '' || v.retention_percent == null ? null : Number(v.retention_percent),
        status: v.status || 'draft', start_date: v.start_date || null, end_date: v.end_date || null, notes: v.notes || null,
      })}
      onSave={(values, row) => {
        const { retention_percent: ret, ...rest } = values;
        if (row) return save('work_orders', ret == null ? rest : values, row.id);
        return save('work_orders', { ...values, created_by: user.id }, null);
      }}
      onDelete={(row) => remove('work_orders', row.id)}
      renderRow={(row) => <FilesPanel projectId={row.project_id} recordType="work_order" recordId={row.id} />}
    />
  );
}
