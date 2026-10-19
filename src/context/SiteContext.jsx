import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { watchTables } from '../lib/realtime';
import { enqueue, flushQueue, queueSize, isOfflineError } from '../lib/offlineQueue';

const SiteContext = createContext(null);

// table -> [state key, select, order column, ascending]
const TABLES = {
  trades: ['trades', '*', 'name', true],
  snag_categories: ['snagCategories', '*', 'name', true],
  daily_reports: ['reports', '*, daily_report_work(*), daily_report_manpower(*)', 'report_date', false],
  snags: ['snags', '*', 'created_at', false],
  approvals: ['approvals', '*', 'expiry_on', true],
};

export function SiteProvider({ children }) {
  const [data, setData] = useState({ trades: [], snagCategories: [], reports: [], snags: [], approvals: [] });
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(queueSize());

  const load = useCallback(async (table) => {
    const [key, select, order, asc] = TABLES[table];
    const { data: rows, error } = await supabase.from(table).select(select).order(order, { ascending: asc, nullsFirst: false });
    if (error) console.error(`Error fetching ${table}:`, error);
    else setData((prev) => ({ ...prev, [key]: rows }));
  }, []);

  useEffect(() => { Promise.all(Object.keys(TABLES).map(load)).then(() => setLoaded(true)); }, [load]);
  useEffect(() => {
    const handlers = { daily_report_work: () => load('daily_reports'), daily_report_manpower: () => load('daily_reports') };
    for (const t of Object.keys(TABLES)) handlers[t] = () => load(t);
    return watchTables('site-module', handlers);
  }, [load]);

  const fail = (what, error) => { console.error(`Error ${what}:`, error); window.alert(`Error ${what}: ${error.message}`); return null; };

  const save = async (table, row, id) => {
    const q = id ? supabase.from(table).update(row).eq('id', id) : supabase.from(table).insert(row);
    const { data: saved, error } = await q.select().single();
    if (error) return fail(`saving ${table.replace('_', ' ')}`, error);
    await load(table);
    return saved;
  };
  const remove = async (table, id) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return fail(`deleting ${table.replace('_', ' ')}`, error);
    await load(table);
    return true;
  };

  /**
   * Write one daily report (header + work lines + manpower lines). One report per project and date.
   * report: { project_id, report_date, weather, blockers, summary, status, visibility?, work: [{task_id, progress_pct, note}], manpower: [{trade, head_count}] }
   * Returns { ok, queued, error }.
   */
  const writeReport = useCallback(async (report) => {
    const { work = [], manpower = [], queuedAt, ...head } = report;
    const { data: existing, error: findErr } = await supabase.from('daily_reports').select('id,status').eq('project_id', head.project_id).eq('report_date', head.report_date).maybeSingle();
    if (findErr) throw findErr;
    if (existing && existing.status === 'submitted' && head.status !== 'submitted') return { ok: false, error: 'This day already has a submitted report' };
    // children are written while the report is a draft; submitting afterwards applies the progress to the tasks
    const finalStatus = head.status;
    const draftHead = existing?.status === 'submitted' ? head : { ...head, status: 'draft' };
    const q = existing
      ? supabase.from('daily_reports').update(draftHead).eq('id', existing.id)
      : supabase.from('daily_reports').insert(draftHead);
    const { data: saved, error } = await q.select().single();
    if (error) throw error;
    const delW = await supabase.from('daily_report_work').delete().eq('report_id', saved.id);
    if (delW.error) throw delW.error;
    const delM = await supabase.from('daily_report_manpower').delete().eq('report_id', saved.id);
    if (delM.error) throw delM.error;
    const workRows = work.filter((w) => w.task_id).map((w, i) => ({ report_id: saved.id, task_id: w.task_id, progress_pct: Number(w.progress_pct) || 0, note: w.note || null, sort_order: i }));
    const seen = new Set();
    const manRows = manpower.filter((m) => m.trade && Number(m.head_count) > 0 && !seen.has(m.trade) && seen.add(m.trade)).map((m, i) => ({ report_id: saved.id, trade: m.trade, head_count: Number(m.head_count), sort_order: i }));
    if (workRows.length) { const r = await supabase.from('daily_report_work').insert(workRows); if (r.error) throw r.error; }
    if (manRows.length) { const r = await supabase.from('daily_report_manpower').insert(manRows); if (r.error) throw r.error; }
    if (finalStatus === 'submitted' && saved.status !== 'submitted') {
      const r = await supabase.from('daily_reports').update({ status: 'submitted' }).eq('id', saved.id);
      if (r.error) throw r.error;
    }
    return { ok: true, id: saved.id };
  }, []);

  /** Draft/submit a report; when offline it waits in the local queue and is retried automatically. */
  const saveReport = async (report) => {
    const queue = () => { enqueue(report); setPending(queueSize()); return { ok: true, queued: true }; };
    if (!navigator.onLine) return queue();
    try {
      // a stalled connection counts as offline; saving is idempotent (one report per project and date), so a late success is harmless
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Failed to fetch (timeout)')), 20000));
      const r = await Promise.race([writeReport(report), timeout]);
      await load('daily_reports');
      return r;
    } catch (error) {
      if (isOfflineError(error)) return queue();
      return { ok: false, error: error.message };
    }
  };

  const flush = useCallback(async () => {
    if (!queueSize()) return;
    const sent = await flushQueue(async (item) => (await writeReport(item)).ok);
    setPending(queueSize());
    if (sent) load('daily_reports');
  }, [writeReport, load]);

  useEffect(() => {
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [flush]);

  const addStandardApprovals = async (projectId) => {
    const { data: n, error } = await supabase.rpc('add_standard_approvals', { p_project: projectId });
    if (error) return fail('adding standard approvals', error);
    await load('approvals');
    return n;
  };
  const setBaseline = async (projectId) => {
    const { data: n, error } = await supabase.rpc('set_project_baseline', { p_project: projectId });
    if (error) return fail('setting the baseline', error);
    return n;
  };

  return (
    <SiteContext.Provider value={{ ...data, loaded, pending, save, remove, saveReport, flush, addStandardApprovals, setBaseline }}>
      {children}
    </SiteContext.Provider>
  );
}

export const useSite = () => useContext(SiteContext);
