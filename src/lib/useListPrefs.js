import { useCallback, useMemo, useState } from 'react';

const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

/**
 * Sort + visible columns for a list page, remembered per page in localStorage.
 * columns: [{ key, label, required?, defaultVisible? (default true), sortType?, ... }]
 */
export function useListPrefs(entity, columns, defaultSort) {
  const colKey = `selora-columns:${entity}`;
  const sortKey = `selora-sort:${entity}`;
  const known = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);
  const defaults = useMemo(() => columns.filter((c) => c.required || c.defaultVisible !== false).map((c) => c.key), [columns]);

  const [visible, setVisible] = useState(() => {
    const saved = read(colKey);
    return Array.isArray(saved) ? saved.filter((k) => known.has(k)) : defaults;
  });
  const [sort, setSortState] = useState(() => {
    const saved = read(sortKey);
    return saved && known.has(saved.key) && (saved.order === 'asc' || saved.order === 'desc') ? saved : defaultSort;
  });

  const visibleSet = useMemo(() => new Set([...visible, ...columns.filter((c) => c.required).map((c) => c.key)]), [visible, columns]);
  const visibleColumns = useMemo(() => columns.filter((c) => visibleSet.has(c.key)), [columns, visibleSet]);

  const toggleColumn = useCallback((key) => {
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      write(colKey, next);
      return next;
    });
  }, [colKey]);
  const resetColumns = useCallback(() => { setVisible(defaults); write(colKey, defaults); }, [colKey, defaults]);
  const setSort = useCallback((next) => { setSortState(next); write(sortKey, next); }, [sortKey]);

  return { visibleColumns, visibleSet, toggleColumn, resetColumns, sort, setSort, sortColumn: columns.find((c) => c.key === sort.key) };
}
