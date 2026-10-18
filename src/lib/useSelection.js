import { useState, useCallback } from 'react';

/** Row selection by id for list pages (header checkbox selects/clears the visible rows). */
export function useSelection() {
  const [ids, setIds] = useState(() => new Set());
  const toggle = useCallback((id) => setIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);
  const toggleAll = useCallback((visibleIds, on) => setIds(on ? new Set(visibleIds) : new Set()), []);
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, toggle, toggleAll, clear, count: ids.size, has: (id) => ids.has(id) };
}
