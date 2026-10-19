import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useProjects } from '../../../context/ProjectsContext';
import { useSite } from '../../../context/SiteContext';
import { useAuth } from '../../../context/AuthContext';
import { criticalPath, ganttSpan, ganttRange, barGeometry, baselineSlip, daysBetween, ticks, ZOOM_PX } from '../../../lib/gantt';
import { shiftTask } from '../../../lib/calendar';
import { addDays } from '../../../lib/dates';
import { todayStr } from '../../../lib/reportData';

const ROW = 44; const BAR = 24; const LABEL = 230; const HEAD = 52;
const control = { backgroundColor: 'var(--control-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' };
const dim = { ...control, color: 'var(--text-muted)' };
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '');

function Toggle({ on, onClick, children }) {
  return <button type="button" aria-pressed={on} onClick={onClick} style={{ ...control, background: on ? 'var(--gray-900)' : 'var(--control-bg)', color: on ? '#ffffff' : 'var(--text-muted)', borderColor: on ? 'var(--gray-900)' : 'var(--border-color)' }}>{children}</button>;
}

/**
 * Gantt chart for the Task page's third view. `tasks` are the tasks the page's filters already let through;
 * `project` is the project filter (a name) — with it the chart shows that project's tasks, without it collapsible project groups.
 */
export default function GanttChart({ tasks: pageTasks, project }) {
  const { projects, updateProjectTask } = useProjects();
  const { setBaseline } = useSite();
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const today = todayStr();
  const store = (k, v) => { try { localStorage.setItem(`selora-gantt:${k}`, v); } catch { /* storage unavailable */ } };
  const load = (k, d) => { try { return localStorage.getItem(`selora-gantt:${k}`) ?? d; } catch { return d; } };

  const [zoom, setZoomState] = useState(() => load('zoom', 'week'));
  const [hideDone, setHideDone] = useState(() => load('hideDone', '1') === '1');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [open, setOpen] = useState({}); // project -> expanded (All projects view)
  const [msg, setMsg] = useState('');
  const [live, setLive] = useState(null);
  const drag = useRef(null);
  const scroller = useRef(null);
  const setZoom = (z) => { setZoomState(z); store('zoom', z); };
  const px = ZOOM_PX[zoom];

  // tasks of the chosen scope; the critical path is worked out on all of them before any filter hides rows
  const scoped = useMemo(() => pageTasks.filter((t) => t.isTemplate !== 'Yes' && ganttSpan(t)), [pageTasks]);
  const critical = useMemo(() => criticalPath(scoped), [scoped]);
  const visibleTasks = useMemo(() => scoped.filter((t) => (!hideDone || !['Completed', 'Cancelled'].includes(t.status)) && (!onlyCritical || critical.has(t.id))), [scoped, hideDone, onlyCritical, critical]);
  const range = useMemo(() => ganttRange(visibleTasks, today), [visibleTasks, today]);
  const days = daysBetween(range.from, range.to) + 1;
  const width = days * px;
  const head = useMemo(() => ticks(range.from, range.to, zoom), [range, zoom]);

  const groups = useMemo(() => {
    const names = [...new Set(visibleTasks.map((t) => t.project))].sort((a, b) => a.localeCompare(b));
    return names.map((name) => ({ name, tasks: visibleTasks.filter((t) => t.project === name).sort((a, b) => ganttSpan(a).start.localeCompare(ganttSpan(b).start)) }));
  }, [visibleTasks]);
  const rows = useMemo(() => {
    const out = [];
    for (const g of groups) {
      if (!project) out.push({ type: 'group', g });
      if (project || open[g.name]) g.tasks.forEach((t) => out.push({ type: 'task', t }));
    }
    return out;
  }, [groups, open, project]);

  const goToday = () => { const el = scroller.current; if (el && today >= range.from && today <= range.to) el.scrollLeft = Math.max(0, daysBetween(range.from, today) * px - 240); };
  useEffect(() => { goToday(); }, [zoom, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e, t, mode) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { id: t.id, mode, x: e.clientX, delta: 0 }; };
  const onMove = (e) => { const d = drag.current; if (!d) return; d.delta = Math.round((e.clientX - d.x) / px); setLive({ id: d.id, mode: d.mode, delta: d.delta }); };
  const onUp = async (t) => {
    const d = drag.current; drag.current = null; setLive(null);
    if (!d || !d.delta) { if (d) navigate(`/projects/task/${t.id}`); return; }
    if (d.mode === 'move') await updateProjectTask(t.id, shiftTask(t, d.delta));
    else { const span = ganttSpan(t); const end = addDays(span.end, d.delta); await updateProjectTask(t.id, { expectedStartDate: t.expectedStartDate || span.start, expectedEndDate: end < span.start ? span.start : end }); }
  };
  const setBase = async () => {
    const p = projects.find((x) => x.projectName === project);
    if (!p || !window.confirm(`Freeze the current plan of "${project}" as its baseline?`)) return;
    const n = await setBaseline(p.dbId);
    if (n !== null) setMsg(`Baseline saved for ${n} tasks. Reload to see it.`);
  };

  const monthStrip = (
    <div style={{ display: 'flex', height: HEAD / 2, borderBottom: '1px solid var(--border-color)' }}>
      {head.months.map((m) => <div key={m.offset} style={{ width: m.span * px, flexShrink: 0, fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', padding: '6px 8px', boxSizing: 'border-box', borderLeft: '1px solid var(--border-color)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{m.label}</div>)}
    </div>
  );

  return (
    <div data-testid="gantt" style={{ color: 'var(--text-color)', fontFamily: 'var(--font-family)', backgroundColor: 'var(--bg-color)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', gap: '8px', flexWrap: 'wrap' }}>
        <div role="group" aria-label="Zoom" style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
          {['day', 'week', 'month'].map((z) => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} style={{ ...control, border: 'none', borderRadius: 0, background: zoom === z ? 'var(--surface-gray-2)' : 'var(--control-bg)', fontWeight: zoom === z ? 600 : 400 }}>{z[0].toUpperCase() + z.slice(1)}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Toggle on={hideDone} onClick={() => { setHideDone(!hideDone); store('hideDone', hideDone ? '0' : '1'); }}>Hide completed</Toggle>
          <Toggle on={onlyCritical} onClick={() => setOnlyCritical(!onlyCritical)}>Critical path only</Toggle>
          <Toggle on={showBaseline} onClick={() => setShowBaseline(!showBaseline)}>Baseline</Toggle>
          <button type="button" onClick={goToday} style={dim}>Today</button>
          {isStaff && <button type="button" style={dim} disabled={!project} title={project ? '' : 'Filter by a project first'} onClick={setBase}>Set baseline</button>}
        </div>
      </div>
      <div style={{ padding: '0 24px 8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 8, background: '#3b82f6', borderRadius: 2 }} /> Task</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 8, background: '#ef4444', borderRadius: 2 }} /> Critical path</span>
        <span>Drag to move · drag the right edge to resize · click to open{!project && ' · click a project to expand it'}</span>
        {msg && <span role="status" style={{ color: 'var(--st-green-fg)' }}>{msg}</span>}
      </div>

      {visibleTasks.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No tasks with dates to show. Try turning off “Hide completed” or adjusting the filters.</div> : (
        <div ref={scroller} style={{ overflow: 'auto', margin: '0 24px 24px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--card-bg)', maxHeight: 'calc(100vh - 300px)' }}>
          <div style={{ display: 'flex', width: LABEL + width, position: 'relative' }}>
            <div style={{ width: LABEL, flexShrink: 0, position: 'sticky', left: 0, background: 'var(--card-bg)', zIndex: 3, borderRight: '1px solid var(--border-color)' }}>
              <div style={{ height: HEAD, borderBottom: '1px solid var(--border-color)', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 4 }}>{project || 'Projects'} · {visibleTasks.length} tasks</div>
              {rows.map((r) => r.type === 'group' ? (
                <div key={`g:${r.g.name}`} onClick={() => setOpen((o) => ({ ...o, [r.g.name]: !o[r.g.name] }))} style={{ height: ROW, padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--divider-color)', background: 'var(--surface-gray-1)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {open[r.g.name] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.g.name}</span><span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{r.g.tasks.length}</span>
                </div>
              ) : (
                <div key={r.t.id} onClick={() => navigate(`/projects/task/${r.t.id}`)} title={r.t.subject} style={{ height: ROW, padding: '0 12px 0 ' + (project ? '12px' : '28px'), display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--divider-color)', cursor: 'pointer', fontSize: '13px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.t.subject}</span>
                </div>
              ))}
            </div>
            <div style={{ width, position: 'relative' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card-bg)', height: HEAD, borderBottom: '1px solid var(--border-color)' }}>
                {monthStrip}
                <div style={{ position: 'relative', height: HEAD / 2 }}>
                  {head.marks.map((m) => <span key={m.date} style={{ position: 'absolute', left: m.offset * px, width: zoom === 'day' ? px : 7 * px, textAlign: zoom === 'day' ? 'center' : 'left', paddingLeft: zoom === 'day' ? 0 : 4, fontSize: '10px', color: 'var(--text-muted)', top: 7 }}>{m.label}</span>)}
                </div>
              </div>
              {today >= range.from && today <= range.to && <div style={{ position: 'absolute', top: 0, bottom: 0, left: daysBetween(range.from, today) * px + px / 2, width: 2, background: '#ef4444', opacity: 0.55, pointerEvents: 'none', zIndex: 1 }} title="Today" />}
              {rows.map((r) => {
                if (r.type === 'group') {
                  const spans = r.g.tasks.map(ganttSpan);
                  const s = spans.reduce((m, x) => (x.start < m ? x.start : m), spans[0].start); const e = spans.reduce((m, x) => (x.end > m ? x.end : m), spans[0].end);
                  const g = barGeometry(s, e, range.from);
                  const done = Math.round(r.g.tasks.reduce((n, t) => n + (Number(t.percentComplete) || 0), 0) / r.g.tasks.length);
                  return <div key={`g:${r.g.name}`} style={{ height: ROW, position: 'relative', borderBottom: '1px solid var(--divider-color)', background: 'var(--surface-gray-1)' }}>
                    <div title={`${r.g.name}: ${fmt(s)} to ${fmt(e)} · ${done}% done`} style={{ position: 'absolute', top: 15, height: 14, left: g.offset * px, width: Math.max(4, g.length * px), background: 'var(--gray-400)', borderRadius: 3 }} />
                  </div>;
                }
                const t = r.t; const span = ganttSpan(t);
                const l = live?.id === t.id ? live : null;
                const start = l?.mode === 'move' ? addDays(span.start, l.delta) : span.start;
                const end = l ? addDays(span.end, l.delta) : span.end;
                const g = barGeometry(start, end < start ? start : end, range.from);
                const isCrit = critical.has(t.id); const slip = baselineSlip(t);
                const hasBase = showBaseline && (t.baselineStart || t.baselineEnd);
                const bg = hasBase ? barGeometry(t.baselineStart || t.baselineEnd, t.baselineEnd || t.baselineStart, range.from) : null;
                const barW = Math.max(6, g.length * px);
                const pct = Number(t.percentComplete) || 0;
                return (
                  <div key={t.id} style={{ height: ROW, position: 'relative', borderBottom: '1px solid var(--divider-color)' }}>
                    {bg && <div title="Baseline" style={{ position: 'absolute', left: bg.offset * px, width: bg.length * px, bottom: 5, height: 4, background: 'var(--gray-400)', borderRadius: 2 }} />}
                    <div data-testid="gantt-bar" data-critical={isCrit} data-task={t.id}
                      title={`${t.subject}\n${fmt(span.start)} → ${fmt(span.end)} · ${pct}% done${slip ? ` · ${slip > 0 ? '+' : ''}${slip} d vs baseline` : ''}`}
                      onPointerDown={(e) => onDown(e, t, 'move')} onPointerMove={onMove} onPointerUp={() => onUp(t)}
                      style={{ position: 'absolute', top: (ROW - BAR) / 2 - (hasBase ? 3 : 0), height: BAR, left: g.offset * px, width: barW, background: isCrit ? '#ef4444' : '#3b82f6', borderRadius: 5, cursor: 'grab', touchAction: 'none', overflow: 'hidden', opacity: t.status === 'Completed' ? 0.55 : 1 }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(255,255,255,0.3)' }} />
                      {barW >= 64 && <span style={{ position: 'relative', fontSize: '11px', fontWeight: 600, color: '#ffffff', padding: '0 8px', lineHeight: `${BAR}px`, whiteSpace: 'nowrap' }}>{pct}%</span>}
                      <div onPointerDown={(e) => onDown(e, t, 'resize')} onPointerMove={onMove} onPointerUp={(e) => { e.stopPropagation(); onUp(t); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(0,0,0,0.25)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
