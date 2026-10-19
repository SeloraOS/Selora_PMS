import { describe, it, expect } from 'vitest';
import { cellValue, toCsv, toXls, raBillHtml, demandLetterHtml, tallyXml, zohoBillsCsv, brandedDocument } from '../exportRows';

const cols = [{ key: 'name', label: 'Name' }, { key: 'dbl', label: 'Qty', render: (r) => r.n * 2 }, { key: 'x', label: 'X', render: () => ({}) }];
describe('exportRows', () => {
  it('reads plain values', () => {
    expect(cellValue(cols[0], { name: 'A' })).toBe('A');
    expect(cellValue(cols[1], { n: 3 })).toBe('6');
    expect(cellValue(cols[2], {})).toBe('');
    expect(cellValue({ label: 'c', csv: (r) => r.q }, { q: 7 })).toBe('7');
  });
  it('quotes CSV and blocks spreadsheet formulas', () => {
    const csv = toCsv([{ key: 'a', label: 'A' }], [{ a: 'say "hi", ok' }, { a: '=SUM(1)' }, { a: '-5' }]);
    expect(csv).toBe('"A"\r\n"say ""hi"", ok"\r\n"\'=SUM(1)"\r\n"-5"');
  });
  it('escapes HTML in the Excel export', () => {
    expect(toXls([{ key: 'a', label: 'A<b>' }], [{ a: '<script>' }])).toContain('&lt;script&gt;');
  });
  it('builds a branded RA bill and demand letter', () => {
    const bill = { code: 'RA-0001', bill_no: 1, status: 'approved', gross_amount: 100000, gst_percent: 18, gst_amount: 18000, retention_percent: 5, retention_amount: 5000, tds_percent: 1, tds_amount: 1000, net_amount: 112000, paid_amount: 0, period_from: '2026-01-01', period_to: '2026-01-31', due_date: '2026-03-02' };
    const h = brandedDocument({ title: 'x', bodyHtml: raBillHtml({ bill, workOrder: { code: 'WO-1', title: 'RCC' }, vendor: { name: 'Shree <Co>', gstin: 'G' }, project: 'Tower A' }), brand: { company: 'Selora Realty', letterhead: 'Line1\nLine2', logo: 'data:image/png;base64,AAA' } });
    expect(h).toContain('1,12,000.00');
    expect(h).toContain('Shree &lt;Co&gt;');
    expect(h).toContain('Line1<br>Line2');
    expect(h).toContain('data:image/png;base64,AAA');
    expect(demandLetterHtml({ customer: 'A Kumar', project: 'Skyline', milestone: 'Slab 10', amount: 250000, dueOn: '2026-05-01', today: '2026-04-20' })).toContain('Rs 2,50,000.00');
  });
  it('builds Tally and Zoho exports', () => {
    const bills = [{ code: 'RA-0001', vendorName: 'Shree & Sons', workTitle: 'RCC', costHead: 'Civil', gross_amount: 100000, gst_amount: 18000, tds_amount: 1000, retention_amount: 5000, net_amount: 112000, gst_percent: 18, approved_at: '2026-02-01T10:00:00Z', created_at: '2026-01-31T00:00:00Z', due_date: '2026-03-03', status: 'approved' }];
    const xml = tallyXml({ company: 'Selora', bills, payments: [{ payment_date: '2026-02-10', amount: 50000, vendorName: 'Shree & Sons', bill: 'RA-0001', mode: 'Bank transfer' }] });
    expect(xml).toContain('<VOUCHERNUMBER>RA-0001</VOUCHERNUMBER>');
    expect(xml).toContain('Shree &amp; Sons');
    expect(xml).toContain('<DATE>20260201</DATE>');
    expect((xml.match(/<VOUCHER /g) || []).length).toBe(2);
    expect(xml).toContain('<AMOUNT>-100000.00</AMOUNT>');
    expect(zohoBillsCsv(bills).split('\r\n')[1]).toContain('"112000.00"');
  });
});
