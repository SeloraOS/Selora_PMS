/** Column definitions for the Project, Task and Timesheet lists (shared by the table, sort menu and column picker). */
import React from 'react';
import { FileText, CheckSquare, Clock } from 'lucide-react';
import { formatINR } from '../../lib/reportData';

const dash = (v) => (v === undefined || v === null || v === '' ? '—' : v);
const date = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');
const PRIORITY_RANK = ['Low', 'Medium', 'High', 'Urgent'];

const TONES = {
  blue: ['var(--st-blue-bg)', 'var(--st-blue-fg)', '#3b82f6'],
  green: ['var(--st-green-bg)', 'var(--st-green-fg)', '#22c55e'],
  amber: ['var(--st-amber-bg)', 'var(--st-amber-fg)', '#f59e0b'],
  red: ['var(--st-red-bg)', 'var(--st-red-fg)', '#ef4444'],
};
function Badge({ status, tone }) {
  const [bg, fg, dot] = TONES[tone];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: bg, color: fg }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }} />
      {status}
    </div>
  );
}
function IdCell({ id, Icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={12} color="var(--text-muted, #6b7280)" />
      </div>
      {id}
    </div>
  );
}
const created = { key: 'createdOn', label: 'Created On', sortType: 'date', sortValue: (r) => r.createdAt, render: (r) => dash(r.createdOn) };
const text = (key, label, extra = {}) => ({ key, label, render: (r) => dash(r[key]), ...extra });
const money = (key, label) => ({ key, label, sortType: 'number', align: 'right', defaultVisible: false, render: (r) => (r[key] === '' || r[key] == null ? '—' : formatINR(r[key])) });
const dateCol = (key, label) => ({ key, label, sortType: 'date', defaultVisible: false, render: (r) => date(r[key]) });

export const PROJECT_COLUMNS = [
  { key: 'id', label: 'ID', required: true, sortType: 'code', primary: true, render: (r) => <IdCell id={r.id} Icon={FileText} /> },
  text('projectName', 'Project Name', { primary: true, required: true }),
  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} tone={r.status === 'Open' ? 'blue' : r.status === 'Completed' ? 'green' : 'red'} /> },
  text('projectType', 'Project Type'),
  { ...text('priority', 'Priority'), sortType: 'rank', rank: PRIORITY_RANK },
  created,
  text('customer', 'Customer', { defaultVisible: false }),
  text('company', 'Company', { defaultVisible: false }),
  text('department', 'Department', { defaultVisible: false }),
  money('estimatedCost', 'Estimated Cost'),
  dateCol('expectedStartDate', 'Expected Start'),
  dateCol('expectedEndDate', 'Expected End'),
];

export const TASK_COLUMNS = [
  { key: 'id', label: 'ID', required: true, sortType: 'code', primary: true, render: (r) => <IdCell id={r.id} Icon={CheckSquare} /> },
  text('subject', 'Subject', { primary: true, required: true }),
  text('project', 'Project'),
  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} tone={r.status === 'Open' ? 'blue' : r.status === 'Completed' ? 'green' : r.status === 'Working' ? 'amber' : 'red'} /> },
  { ...text('priority', 'Priority'), sortType: 'rank', rank: PRIORITY_RANK },
  created,
  dateCol('expectedStartDate', 'Expected Start'),
  dateCol('expectedEndDate', 'Expected End'),
  { key: 'weight', label: 'Weight', sortType: 'number', align: 'right', defaultVisible: false, render: (r) => dash(r.weight) },
  text('parentTask', 'Parent Task', { defaultVisible: false }),
  text('company', 'Company', { defaultVisible: false }),
  text('department', 'Department', { defaultVisible: false }),
];

export const TIMESHEET_COLUMNS = [
  { key: 'id', label: 'ID', required: true, sortType: 'code', primary: true, render: (r) => <IdCell id={r.id} Icon={Clock} /> },
  text('employee', 'Employee', { primary: true }),
  text('project', 'Project'),
  { key: 'totalWorkingHours', label: 'Working Hours', sortType: 'number', primary: true, render: (r) => (r.totalWorkingHours || 0).toFixed(3) },
  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} tone={r.status === 'Draft' ? 'amber' : 'green'} /> },
  created,
  text('customer', 'Customer', { defaultVisible: false }),
  text('company', 'Company', { defaultVisible: false }),
  { key: 'totalBillableHours', label: 'Billable Hours', sortType: 'number', align: 'right', defaultVisible: false, render: (r) => (r.totalBillableHours || 0).toFixed(3) },
  { key: 'totalBillableAmount', label: 'Billable Amount', sortType: 'number', align: 'right', defaultVisible: false, render: (r) => formatINR(r.totalBillableAmount) },
  { key: 'totalCostingAmount', label: 'Costing Amount', sortType: 'number', align: 'right', defaultVisible: false, render: (r) => formatINR(r.totalCostingAmount) },
  text('currency', 'Currency', { defaultVisible: false }),
];
