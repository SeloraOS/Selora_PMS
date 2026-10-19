import { useState, useCallback } from 'react';
import { PIPELINES, pipelineById } from './kanban';

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, v) => { try { localStorage.setItem(key, v); } catch { /* storage unavailable */ } };

/**
 * Per-page view settings, remembered in localStorage:
 *   view     'list' | 'kanban'
 *   pipeline the field the board is grouped by (see PIPELINES in lib/kanban.js)
 */
export function useViewMode(entity) {
  const pipelines = PIPELINES[entity] || []; // pages without pipelines are list-only
  const [view, setViewState] = useState(() => (pipelines.length && read(`selora-view:${entity}`) === 'kanban' ? 'kanban' : 'list'));
  const [pipelineId, setPipelineState] = useState(() => (pipelines.length ? pipelineById(entity, read(`selora-pipeline:${entity}`)).id : null));

  const setView = useCallback((v) => { setViewState(v); write(`selora-view:${entity}`, v); }, [entity]);
  const setPipeline = useCallback((id) => {
    if (!(PIPELINES[entity] || []).some((p) => p.id === id)) return;
    setPipelineState(id);
    write(`selora-pipeline:${entity}`, id);
  }, [entity]);

  return { view: pipelines.length ? view : 'list', setView, pipeline: pipelines.length ? pipelineById(entity, pipelineId) : null, setPipeline, pipelines };
}
