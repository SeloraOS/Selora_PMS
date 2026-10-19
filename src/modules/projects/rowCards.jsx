/** Kanban cards for the database-row pages (snags, approvals, work orders, bills, ...). */
import React from 'react';
import { Pill } from '../../components/shared/KanbanBoard';
import { fmtDate } from '../../lib/kanban';
import { formatINR } from '../../lib/reportData';
import { approvalState, snagOverdue } from '../../lib/site';

const mono = { fontSize: '11px', color: 'var(--text-muted, #6b7280)' };
const title = { fontSize: '13px', fontWeight: 600, color: 'var(--text-color, #1a1a1a)', margin: '4px 0', wordBreak: 'break-word' };
const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px' };
const SEV = { Low: '#6b7280', Medium: '#3b82f6', High: '#f59e0b', Critical: '#ef4444' };
const RED = '#ef4444';

const Head = ({ code, pill, color }) => (
  <div style={row}><span style={mono}>{code}</span>{pill && <Pill color={color}>{pill}</Pill>}</div>
);

export function SnagCard({ snag, ctx }) {
  const late = snagOverdue(snag, ctx.today);
  return (
    <>
      <Head code={snag.code} pill={snag.severity} color={SEV[snag.severity]} />
      <div style={title}>{snag.title}</div>
      <div style={mono}>{[ctx.projectName(snag.project_id), snag.location].filter(Boolean).join(' · ')}</div>
      {snag.due_date && <div style={{ ...mono, marginTop: '6px', color: late ? RED : mono.color, fontWeight: late ? 600 : 400 }}>{late ? 'Overdue · ' : 'Due '}{fmtDate(snag.due_date)}</div>}
    </>
  );
}

const VALID = { valid: '#22c55e', expiring: '#f59e0b', expired: RED, pending: '#3b82f6', rejected: '#9ca3af' };
export function ApprovalCard({ approval, ctx }) {
  const st = approvalState(approval, ctx.today, ctx.warnDays);
  const text = { valid: 'Valid', expiring: `Expires in ${st.days} d`, expired: `Expired ${Math.abs(st.days)} d ago`, pending: approval.status, rejected: 'Rejected' }[st.key];
  return (
    <>
      <Head code={approval.authority || 'Approval'} pill={text} color={VALID[st.key]} />
      <div style={title}>{approval.name}</div>
      <div style={mono}>{ctx.projectName(approval.project_id)}</div>
      {approval.expiry_on && <div style={{ ...mono, marginTop: '6px' }}>Expiry {fmtDate(approval.expiry_on)}</div>}
    </>
  );
}

export function WorkOrderCard({ order, ctx, billed }) {
  const pct = Number(order.amount) > 0 ? Math.min(100, Math.round((billed / Number(order.amount)) * 100)) : 0;
  return (
    <>
      <Head code={order.code} pill={formatINR(Number(order.amount))} color="#3b82f6" />
      <div style={title}>{order.title}</div>
      <div style={mono}>{[ctx.vendorName(order.vendor_id), ctx.projectName(order.project_id)].filter(Boolean).join(' · ')}</div>
      <div style={{ marginTop: '8px', height: '4px', background: 'var(--border-color, #e5e7eb)', borderRadius: '2px' }}><div style={{ width: `${pct}%`, height: '100%', background: '#22c55e', borderRadius: '2px' }} /></div>
      <div style={{ ...mono, marginTop: '4px' }}>{pct}% billed</div>
    </>
  );
}

export function BillCard({ bill, ctx }) {
  return (
    <>
      <Head code={bill.code} pill={formatINR(Number(bill.net_amount))} color="#3b82f6" />
      <div style={title}>{ctx.vendorName(bill.vendor_id)}</div>
      <div style={mono}>{ctx.projectName(bill.project_id)}</div>
      <div style={{ ...mono, marginTop: '6px' }}>Paid {formatINR(Number(bill.paid_amount))}{bill.due_date ? ` · due ${fmtDate(bill.due_date)}` : ''}</div>
    </>
  );
}

export function MaterialCard({ request, ctx }) {
  return (
    <>
      <Head code={request.code} pill={`${Number(request.quantity)} ${request.unit}`} color="#3b82f6" />
      <div style={title}>{request.item}</div>
      <div style={mono}>{ctx.projectName(request.project_id)}</div>
      {request.needed_by && <div style={{ ...mono, marginTop: '6px' }}>Needed by {fmtDate(request.needed_by)}</div>}
    </>
  );
}

export function ReportCard({ report, ctx, headCount }) {
  return (
    <>
      <Head code={report.code} pill={fmtDate(report.report_date)} color="#3b82f6" />
      <div style={title}>{ctx.projectName(report.project_id)}</div>
      <div style={mono}>{headCount} on site · {report.daily_report_work?.length || 0} work lines</div>
      {report.blockers && <div style={{ ...mono, marginTop: '6px', color: RED }}>Blocker: {report.blockers}</div>}
    </>
  );
}

const UPD = { Progress: '#3b82f6', Milestone: '#22c55e', Issue: RED, Other: '#9ca3af' };
export function UpdateCard({ update, ctx }) {
  return (
    <>
      <Head code={fmtDate(update.update_date)} pill={update.type} color={UPD[update.type]} />
      <div style={title}>{update.description}</div>
      <div style={mono}>{ctx.projectName(update.project_id)}</div>
    </>
  );
}

const HEALTH = { ok: '#22c55e', warn: '#f59e0b', over: RED, unbudgeted: '#9ca3af', none: '#6b7280' };
export function BudgetCard({ line, showProject }) {
  const budget = Number(line.budget) || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((Number(line.committed) / budget) * 100)) : 0;
  return (
    <>
      <Head code={showProject ? line.projectName : 'Budget'} pill={line.health.pct == null ? '—' : `${line.health.pct}%`} color={HEALTH[line.health.key]} />
      <div style={title}>{line.head.name}</div>
      <div style={mono}>{formatINR(Number(line.committed))} of {formatINR(budget)} committed</div>
      <div style={{ marginTop: '8px', height: '4px', background: 'var(--border-color, #e5e7eb)', borderRadius: '2px' }}><div style={{ width: `${pct}%`, height: '100%', background: HEALTH[line.health.key], borderRadius: '2px' }} /></div>
    </>
  );
}
