/**
 * Column-aware sorting for the list pages.
 * column: { key, sortType?: 'text'|'number'|'date'|'code'|'rank', sortValue?: (row) => any, rank?: string[] }
 * Empty values always go last (in both directions); ties keep their original order.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const isEmpty = (v) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v));

function compare(type, a, b, column) {
  switch (type) {
    case 'number': return Number(a) - Number(b);
    case 'rank': return (column.rank || []).indexOf(a) - (column.rank || []).indexOf(b);
    case 'date': return a < b ? -1 : a > b ? 1 : 0; // ISO strings / timestamps sort lexically
    default: return collator.compare(String(a), String(b)); // text and codes (PROJ-0009 < PROJ-0010)
  }
}

export function sortRows(rows, column, order = 'asc') {
  if (!column) return rows;
  const type = column.sortType || 'text';
  const dir = order === 'desc' ? -1 : 1;
  const read = column.sortValue || ((r) => r[column.key]);
  return rows
    .map((row, i) => ({ row, i, v: read(row) }))
    .sort((x, y) => {
      const ex = isEmpty(x.v); const ey = isEmpty(y.v);
      if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1; // empties last, whatever the direction
      return compare(type, x.v, y.v, column) * dir || x.i - y.i;
    })
    .map((x) => x.row);
}
