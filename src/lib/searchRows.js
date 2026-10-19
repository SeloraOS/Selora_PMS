import { cellValue } from './exportRows';

/** Rows whose plain-text cells (all columns, not just the visible ones) contain every word of `query`. */
export function searchRows(rows, columns, query, extra = () => '') {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => {
    const hay = `${columns.map((c) => cellValue(c, r)).join(' ')} ${extra(r)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
