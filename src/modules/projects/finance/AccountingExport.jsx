import React, { useMemo, useState } from 'react';
import { useFinance } from '../../../context/FinanceContext';
import { useSetup } from '../../../context/SetupContext';
import { tallyXml, zohoBillsCsv, toCsv, download } from '../../../lib/exportRows';
import { fiscalYear } from '../../../lib/finance';
import { todayStr } from '../../../lib/reportData';
import { control } from './shared';

/** Vouchers for Tally and bills for Zoho Books, built in the browser from approved bills and payments. */
export default function AccountingExport() {
  const { bills, payments, vendors, workOrders, costHeads, loaded } = useFinance();
  const { settings } = useSetup();
  const fy = fiscalYear(todayStr(), settings?.fiscal_year_start_month ?? 4);
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);

  const data = useMemo(() => {
    const day = (b) => (b.approved_at || b.created_at).slice(0, 10);
    const list = bills.filter((b) => ['approved', 'paid'].includes(b.status) && day(b) >= from && day(b) <= to).map((b) => {
      const wo = workOrders.find((w) => w.id === b.work_order_id);
      return { ...b, vendorName: vendors.find((v) => v.id === b.vendor_id)?.name || '', workTitle: wo?.title || '', costHead: costHeads.find((c) => c.id === wo?.cost_head_id)?.name || '' };
    });
    const pays = payments.filter((p) => p.payment_date >= from && p.payment_date <= to).map((p) => {
      const b = bills.find((x) => x.id === p.bill_id);
      return { ...p, bill: b?.code || '', vendorName: vendors.find((v) => v.id === b?.vendor_id)?.name || '' };
    });
    return { list, pays };
  }, [bills, payments, vendors, workOrders, costHeads, from, to]);

  const company = settings?.company || 'Company';
  const btn = { ...control, cursor: 'pointer', background: 'var(--gray-900)', color: '#ffffff', fontWeight: 600 };
  return (
    <div data-testid="accounting-export" style={{ padding: '20px', color: 'var(--text-color)', fontFamily: 'var(--font-family)', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--surface-gray-1)', minHeight: '100%', maxWidth: '760px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Accounting export</h1>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Approved bills become purchase vouchers (with GST input, TDS and retention); payments become payment vouchers. Ledger names used: the vendor name, the cost head, "GST Input", "TDS Payable", "Retention Payable", "Bank Account" and "Cash". Create these ledgers in your accounting software first.</div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From <input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={control} /></label>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To <input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={control} /></label>
        <span data-testid="export-counts" style={{ fontSize: '13px' }}>{loaded ? `${data.list.length} bills, ${data.pays.length} payments` : 'Loading…'}</span>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button style={btn} disabled={!data.list.length && !data.pays.length} onClick={() => download('tally-vouchers.xml', tallyXml({ company, bills: data.list, payments: data.pays }), 'application/xml')}>Tally XML</button>
        <button style={btn} disabled={!data.list.length} onClick={() => download('zoho-bills.csv', zohoBillsCsv(data.list), 'text/csv;charset=utf-8')}>Zoho Books bills (CSV)</button>
        <button style={btn} disabled={!data.pays.length} onClick={() => download('payments.csv', toCsv([
          { label: 'Date', csv: (p) => p.payment_date }, { label: 'Vendor', csv: (p) => p.vendorName }, { label: 'Bill', csv: (p) => p.bill },
          { label: 'Mode', csv: (p) => p.mode }, { label: 'Reference', csv: (p) => p.reference || '' }, { label: 'Amount', csv: (p) => Number(p.amount).toFixed(2) },
        ], data.pays), 'text/csv;charset=utf-8')}>Payments (CSV)</button>
      </div>
    </div>
  );
}
