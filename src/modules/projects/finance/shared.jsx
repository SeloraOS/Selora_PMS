import React from 'react';

export const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');
const COLORS = {
  green: ['var(--st-green-bg)', 'var(--st-green-fg)'], amber: ['var(--st-amber-bg)', 'var(--st-amber-fg)'],
  red: ['var(--st-red-bg)', 'var(--st-red-fg)'], blue: ['var(--st-blue-bg)', 'var(--st-blue-fg)'], gray: ['var(--surface-gray-2)', 'var(--text-light)'],
};
export function Pill({ color = 'gray', children, ...rest }) {
  const [bg, fg] = COLORS[color];
  return <span {...rest} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: bg, color: fg, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}
export const WO_COLOR = { draft: 'gray', pending_approval: 'amber', approved: 'green', closed: 'blue', cancelled: 'red' };
export const BILL_COLOR = { draft: 'gray', submitted: 'amber', approved: 'blue', rejected: 'red', paid: 'green' };
export const control = { border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', background: 'var(--control-bg)', color: 'var(--text-color)', fontFamily: 'inherit' };
