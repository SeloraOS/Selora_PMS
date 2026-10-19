import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

const th = { padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };

/**
 * Selectable, sortable list table driven by column definitions.
 * columns: visible columns [{ key, label, render(row), sortType? , align? }]
 * Clicking a sortable header sorts by it; clicking again flips the direction.
 */
export default function RecordTable({ columns, rows, selection, onOpen, sort, onSort }) {
  const hover = (e, on) => { e.currentTarget.style.backgroundColor = on ? 'var(--surface-gray-1, #f9fafb)' : 'transparent'; };
  return (
    <div style={{ overflowX: 'auto', padding: '0 24px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #6b7280)' }}>
            <th style={{ padding: '12px 0 12px 8px', width: '30px', textAlign: 'center' }}>
              <input type="checkbox" aria-label="Select all" checked={rows.length > 0 && rows.every((r) => selection.has(r.id))} onChange={(e) => selection.toggleAll(rows.map((r) => r.id), e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--gray-900, #111827)' }} />
            </th>
            {columns.map((c) => {
              const active = sort.key === c.key;
              return (
                <th key={c.key} aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => onSort(c.key)} style={{ ...th, textAlign: c.align || 'left', cursor: 'pointer', color: active ? 'var(--text-color, #1a1a1a)' : undefined, userSelect: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {c.label}
                    {active && (sort.order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={() => onOpen(row)} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', cursor: 'pointer', transition: 'background-color 0.15s' }} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
              <td style={{ padding: '12px 0 12px 8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selection.has(row.id)} onChange={() => selection.toggle(row.id)} style={{ cursor: 'pointer', accentColor: 'var(--gray-900, #111827)' }} />
              </td>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: '12px 16px', textAlign: c.align || 'left', color: c.primary ? 'var(--text-color, #1a1a1a)' : 'var(--text-muted, #6b7280)', fontWeight: c.key === 'id' ? 500 : 400, whiteSpace: c.key === 'id' ? 'nowrap' : undefined }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
