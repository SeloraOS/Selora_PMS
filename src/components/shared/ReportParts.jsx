/** Shared building blocks for the Projects report pages. */
import React from 'react';

export const tooltipStyle = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#1a1a2e' };

export const ReportPage = ({ children }) => (
  <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif', backgroundColor: '#f8f9fa', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {children}
  </div>
);

export function ReportHeader({ title, onExport, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{title}</h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {children}
        {onExport && (
          <button onClick={onExport} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Export CSV</button>
        )}
      </div>
    </div>
  );
}

export const StatRow = ({ children }) => <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>{children}</div>;

export const StatCard = ({ label, value }) => (
  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px', flex: 1, minWidth: '160px' }}>
    <div style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>{value}</div>
    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{label}</div>
  </div>
);

export const ChartRow = ({ children }) => <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>{children}</div>;

export const ChartCard = ({ title, children, height = '260px', empty }) => (
  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px', flex: 1, minWidth: '280px' }}>
    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '16px' }}>{title}</div>
    {empty ? (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#9ca3af' }}>No data yet</div>
    ) : (
      <div style={{ height }}>{children}</div>
    )}
  </div>
);

/** columns: [{ label, render(row), align?, color?(row) }] */
export function ReportTable({ columns, rows, empty = 'No data to show.' }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            {columns.map((c) => (
              <th key={c.label} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', textAlign: c.align || 'left' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{empty}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.key ?? i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {columns.map((c, j) => (
                <td key={c.label} style={{ padding: '10px 14px', fontSize: '13px', color: c.color ? c.color(row) : j === 0 ? '#1a1a2e' : '#374151', fontWeight: j === 0 ? 500 : 400, textAlign: c.align || 'left' }}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Download rows as a CSV file. `columns`: [{ label, render }] (render must return text/number). */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(c.csv ? c.csv(r) : c.render(r))).join(','));
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
