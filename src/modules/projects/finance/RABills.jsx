import React, { useState } from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useFinance } from '../../../context/FinanceContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../lib/reportData';
import { BILL_STATUS_LABELS } from '../../../lib/finance';
import { FilesPanel } from '../../../components/shared/RecordPanels';
import { brandedDocument, printDocument, raBillHtml } from '../../../lib/exportRows';
import { control, fmtDate, Pill, BILL_COLOR } from './shared';
import { useRowCtx } from '../../../lib/useRowCtx';
import { BillCard } from '../rowCards';

const line = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' };

/** Breakdown of the bill and its payments; staff record payments here. */
function BillPanel({ bill }) {
  const { payments, save, remove, workOrders, vendors } = useFinance();
  const { isStaff } = useAuth();
  const { projects } = useProjects();
  const { settings } = useSetup();
  const printBill = () => {
    const doc = brandedDocument({ title: `RA bill ${bill.code}`, brand: { company: settings?.company, letterhead: settings?.letterhead, logo: settings?.company_logo },
      bodyHtml: raBillHtml({ bill, workOrder: workOrders.find((w) => w.id === bill.work_order_id), vendor: vendors.find((v) => v.id === bill.vendor_id), project: projects.find((p) => p.dbId === bill.project_id)?.projectName || '' }) });
    if (!printDocument(doc)) window.alert('The browser blocked the print window. Allow pop-ups for this site.');
  };
  const mine = payments.filter((p) => p.bill_id === bill.id);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Bank transfer');
  const [ref, setRef] = useState('');
  const net = Number(bill.net_amount); const paid = Number(bill.paid_amount);
  const add = async () => {
    if (!Number(amount)) return;
    if (await save('payments', { bill_id: bill.id, amount: Number(amount), mode, reference: ref || null }, null)) { setAmount(''); setRef(''); }
  };
  return (
    <div data-testid="bill-panel" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <div style={line}><span>Gross amount</span><span>{formatINR(Number(bill.gross_amount))}</span></div>
        <div style={line}><span>+ GST ({Number(bill.gst_percent)}%)</span><span>{formatINR(Number(bill.gst_amount))}</span></div>
        <div style={line}><span>− Retention ({Number(bill.retention_percent)}%)</span><span>{formatINR(Number(bill.retention_amount))}</span></div>
        <div style={line}><span>− TDS ({Number(bill.tds_percent)}%)</span><span>{formatINR(Number(bill.tds_amount))}</span></div>
        <div style={{ ...line, fontWeight: 700, borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '6px' }}><span>Net payable</span><span data-testid="bill-net">{formatINR(net)}</span></div>
        <div style={line}><span>Paid</span><span>{formatINR(paid)}</span></div>
        <div style={line}><span>Balance</span><span>{formatINR(net - paid)}</span></div>
      </div>
      <button type="button" onClick={printBill} style={{ ...control, alignSelf: 'flex-start', cursor: 'pointer' }}>Print bill / PDF</button>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>Payments ({mine.length})</div>
      {mine.map((p) => (
        <div key={p.id} data-testid="payment-row" style={{ ...line, alignItems: 'center' }}>
          <span>{fmtDate(p.payment_date)} · {p.mode}{p.reference ? ` · ${p.reference}` : ''}</span>
          <span>{formatINR(Number(p.amount))} {isStaff && <button type="button" aria-label="Delete payment" onClick={() => window.confirm('Delete this payment?') && remove('payments', p.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--st-red-fg)' }}>×</button>}</span>
        </div>
      ))}
      {isStaff && ['approved', 'paid'].includes(bill.status) && net - paid > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px' }}>
          <input aria-label="Payment amount" type="number" min="0" placeholder={`Amount (max ${net - paid})`} value={amount} onChange={(e) => setAmount(e.target.value)} style={control} />
          <select aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)} style={control}>{['Bank transfer', 'Cheque', 'Cash', 'UPI'].map((m) => <option key={m}>{m}</option>)}</select>
          <input aria-label="Payment reference" placeholder="Reference / UTR" value={ref} onChange={(e) => setRef(e.target.value)} style={control} />
          <button type="button" onClick={add} style={{ ...control, background: 'var(--gray-900)', color: '#ffffff', cursor: 'pointer' }}>Record</button>
        </div>
      )}
      <FilesPanel projectId={bill.project_id} recordType="ra_bill" recordId={bill.id} />
    </div>
  );
}

export default function RABills() {
  const { bills, workOrders, vendors, loaded, save, remove } = useFinance();
  const { projects } = useProjects();
  const { settings } = useSetup();
  const { user, isStaff, isInternal, role } = useAuth();
  const contractor = role === 'contractor';
  const pname = (r) => projects.find((p) => p.dbId === r.project_id)?.projectName || '—';
  const vname = (r) => vendors.find((v) => v.id === r.vendor_id)?.name || '—';
  const wo = (id) => workOrders.find((w) => w.id === id);
  const billable = workOrders.filter((w) => w.status === 'approved');
  const limit = Number(settings?.po_approval_limit) || 0;
  const ctx = useRowCtx();

  const statusOptions = (contractor ? ['draft', 'submitted'] : Object.keys(BILL_STATUS_LABELS)).map((value) => ({ value, label: BILL_STATUS_LABELS[value] }));
  const locked = (row) => (contractor ? row.status !== 'draft' : ['approved', 'paid', 'rejected'].includes(row.status));

  return (
    <SetupListPage
      title="RA Bill"
      rows={bills}
      loading={!loaded}
      canEdit
      canCreate={isInternal || contractor}
      entity="raBill"
      ctx={ctx}
      defaultSort={{ key: 'code', order: 'desc' }}
      card={(r) => <BillCard bill={r} ctx={ctx} />}
      canMove={(r) => (contractor ? r.status === 'draft' : !['paid', 'rejected'].includes(r.status))}
      onMove={(r, patch) => save('ra_bills', patch, r.id)}
      canDelete={(r) => isStaff || (r.status === 'draft' && r.created_by === user?.id)}
      fieldDisabled={(f, row) => !!row && (
        f.name === 'work_order_id'
        || (f.name === 'status' ? (row.status === 'paid' || (contractor && row.status !== 'draft')) : locked(row))
      )}
      searchText={(r) => `${r.code} ${pname(r)} ${vname(r)} ${wo(r.work_order_id)?.code || ''}`}
      filters={[{ key: 'status', label: 'Status', options: Object.keys(BILL_STATUS_LABELS), get: (r) => r.status }]}
      columns={[
        { key: 'code', label: 'Bill', sortType: 'code' },
        { key: 'wo', label: 'Work order', sortValue: (r) => wo(r.work_order_id)?.code, render: (r) => wo(r.work_order_id)?.code || '—' },
        { key: 'project', label: 'Project', render: pname, sortValue: pname },
        { key: 'vendor', label: 'Vendor', render: vname, sortValue: vname },
        { key: 'gross_amount', label: 'Gross', sortType: 'number', align: 'right', render: (r) => formatINR(Number(r.gross_amount)) },
        { key: 'net_amount', label: 'Net', sortType: 'number', align: 'right', render: (r) => formatINR(Number(r.net_amount)) },
        { key: 'paid_amount', label: 'Paid', sortType: 'number', align: 'right', render: (r) => formatINR(Number(r.paid_amount)) },
        { key: 'due_date', label: 'Due', sortType: 'date', render: (r) => fmtDate(r.due_date) },
        { key: 'status', label: 'Status', sortType: 'rank', rank: Object.keys(BILL_STATUS_LABELS), render: (r) => <Pill color={BILL_COLOR[r.status]}>{BILL_STATUS_LABELS[r.status]}</Pill> },
      ]}
      fields={[
        { name: 'work_order_id', label: 'Work order', type: 'select', required: true, options: [...billable, ...workOrders.filter((w) => w.status !== 'approved' && bills.some((b) => b.work_order_id === w.id))].map((w) => ({ value: w.id, label: `${w.code} · ${w.title} (${formatINR(Number(w.amount))})` })) },
        { name: 'period_from', label: 'Period from', type: 'date' },
        { name: 'period_to', label: 'Period to', type: 'date' },
        { name: 'gross_amount', label: `Gross amount (₹) — approval by an admin or manager above ${formatINR(limit)}`, type: 'number', required: true },
        { name: 'status', label: 'Status', type: 'select', default: 'draft', options: statusOptions },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      fromForm={(v) => ({ work_order_id: v.work_order_id, period_from: v.period_from || null, period_to: v.period_to || null, gross_amount: Number(v.gross_amount), status: v.status || 'draft', notes: v.notes || null })}
      onSave={(values, row) => {
        if (!row) return save('ra_bills', { ...values, created_by: user.id }, null);
        const { work_order_id, ...rest } = values; // the order of an existing bill is fixed
        return save('ra_bills', locked(row) ? { status: rest.status, notes: rest.notes } : rest, row.id);
      }}
      onDelete={(row) => remove('ra_bills', row.id)}
      renderRow={(row) => <BillPanel bill={row} />}
    />
  );
}
