import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../../context/ProjectsContext';
import { useSite } from '../../../context/SiteContext';
import { useAuth } from '../../../context/AuthContext';
import { criticalPath, ganttSpan, ganttRange, barGeometry, baselineSlip, daysBetween } from '../../../lib/gantt';
import { shiftTask } from '../../../lib/calendar';
import { addDays } from '../../../lib/dates';
import { todayStr } from '../../../lib/reportData';

const DAY = 26; // px per day
const ROW = 34;
const LABEL = 240;
const btn = { padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' };

export default function Gantt() {
  const { projects, projectTasks, updateProjectTask } = useProjects();
  const { setBaseline } = useSite();
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const today = todayStr();
  const [project, setProject] = useState('');
  const [msg, setMsg] = useState('');
  const drag = useRef(null);
  const [live, setLive] = useState(null); // { id, dStart, dEnd } while dragging

  const tasks = useMemo(() => projectTasks.filter((t) => (!project || t.project === project) && t.isTemplate !== 'Yes' && ganttSpan(t)), [projectTasks, project]);
  const critical = useMemo(() => criticalPath(tasks), [tasks]);
  const range = useMemo(() => ganttRange(tasks, today), [tasks, today]);
  const days = daysBetween(range.from, range.to) + 1;
  const width = days * DAY;
  const dates = Array.from({ length: days }, (_, i) => addDays(range.from, i));
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.project.localeCompare(b.project) || ganttSpan(a).start.localeCompare(ganttSpan(b).start)), [tasks]);

  const onDown = (e, t, mode) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { id: t.id, mode, x: e.clientX, delta: 0 }; };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    d.delta = Math.round((e.clientX - d.x) / DAY);
    setLive({ id: d.id, mode: d.mode, delta: d.delta });
  };
  const onUp = async (t) => {
    const d = drag.current; drag.current = null; setLive(null);
    if (!d || !d.delta) { if (d) navigate(`/projects/task/${t.id}`); return; }
    if (d.mode === 'move') await updateProjectTask(t.id, shiftTask(t, d.delta));
    else { const span = ganttSpan(t); const end = addDays(span.end, d.delta); await updateProjectTask(t.id, { expectedStartDate: t.expectedStartDate || span.start, expectedEndDate: end < span.start ? span.start : end }); }
  };

  const setBase = async () => {
    const p = projects.find((x) => x.projectName === project);
    if (!p) return;
    if (!window.confirm(`Freeze the current plan of "${project}" as its baseline?`)) return;
    const n = await setBaseline(p.dbId);
    if (n !== null) setMsg(`Baseline saved for ${n} tasks. Reload the page to see it.`);
  };

  return (
    <div data-testid="gantt" style={{ padding: '16px 20px', color: 'var(--text-color)', fontFamily: 'var(--font-family)', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '100%' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, flex: 1 }}>Gantt</h1>
        <select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)} style={btn}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.dbId}>{p.projectName}</option>)}
        </select>
        {isStaff && <button style={btn} disabled={!project} title={project ? '' : 'Pick a project first'} onClick={setBase}>Set baseline</button>}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 8, background: '#3b82f6', borderRadius: 2 }} /> Task</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 8, background: '#ef4444', borderRadius: 2 }} /> Critical path</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 4, background: 'var(--gray-400)', borderRadius: 2 }} /> Baseline</span>
        <span>Drag a bar to move it, drag its right edge to change the end date, click to open.</span>
        {msg && <span role="status" style={{ color: 'var(--st-green-fg)' }}>{msg}</span>}
      </div>
      {sorted.length === 0 ? <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tasks with dates to show.</div> : (
        <div style={{ overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', width: LABEL + width, position: 'relative' }}>
            <div style={{ width: LABEL, flexShrink: 0, position: 'sticky', left: 0, background: 'var(--card-bg)', zIndex: 2, borderRight: '1px solid var(--border-color)' }}>
              <div style={{ height: ROW, borderBottom: '1px solid var(--border-color)', padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>Task</div>
              {sorted.map((t) => (
                <div key={t.id} onClick={() => navigate(`/projects/task/${t.id}`)} style={{ height: ROW, padding: '0 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: '1px solid var(--divider-color)', cursor: 'pointer', overflow: 'hidden' }}>
                  <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</span>
                  {!project && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.project}</span>}
                </div>
              ))}
            </div>
            <div style={{ width, position: 'relative' }}>
              <div style={{ display: 'flex', height: ROW, borderBottom: '1px solid var(--border-color)' }}>
                {dates.map((d) => (
                  <div key={d} style={{ width: DAY, flexShrink: 0, fontSize: '9px', textAlign: 'center', color: 'var(--text-muted)', paddingTop: 6, boxSizing: 'border-box', background: d === today ? 'var(--surface-gray-2)' : undefined }}>
                    {d.slice(8) === '01' || d === dates[0] ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }) : ''}<br />{d.slice(8)}
                  </div>
                ))}
              </div>
              {/* today line */}
              {today >= range.from && today <= range.to && <div style={{ position: 'absolute', top: 0, bottom: 0, left: daysBetween(range.from, today) * DAY + DAY / 2, width: 1, background: '#ef4444', opacity: 0.6, pointerEvents: 'none' }} />}
              {sorted.map((t) => {
                const span = ganttSpan(t);
                const l = live?.id === t.id ? live : null;
                const start = l?.mode === 'move' ? addDays(span.start, l.delta) : span.start;
                const end = l ? addDays(span.end, l.delta) : span.end;
                const g = barGeometry(start, end < start ? start : end, range.from);
                const isCrit = critical.has(t.id);
                const slip = baselineSlip(t);
                const hasBase = t.baselineStart || t.baselineEnd;
                const bg = barGeometry(t.baselineStart || t.baselineEnd, t.baselineEnd || t.baselineStart, range.from);
                return (
                  <div key={t.id} style={{ height: ROW, position: 'relative', borderBottom: '1px solid var(--divider-color)' }}>
                    {hasBase && <div title="Baseline" style={{ position: 'absolute', left: bg.offset * DAY, width: bg.length * DAY, bottom: 5, height: 4, background: 'var(--gray-400)', borderRadius: 2 }} />}
                    <div
                      data-testid="gantt-bar" data-critical={isCrit} data-task={t.id}
                      title={`${t.subject}: ${span.start} → ${span.end}${slip ? ` (${slip > 0 ? '+' : ''}${slip} d vs baseline)` : ''}`}
                      onPointerDown={(e) => onDown(e, t, 'move')} onPointerMove={onMove} onPointerUp={() => onUp(t)}
                      style={{ position: 'absolute', top: 6, height: 16, left: g.offset * DAY, width: g.length * DAY, background: isCrit ? '#ef4444' : '#3b82f6', borderRadius: 4, cursor: 'grab', touchAction: 'none', overflow: 'hidden', opacity: t.status === 'Completed' ? 0.55 : 1 }}
                    >
                      <div style={{ position: 'absolute', inset: 0, width: `${Number(t.percentComplete) || 0}%`, background: 'rgba(255,255,255,0.35)' }} />
                      <div onPointerDown={(e) => onDown(e, t, 'resize')} onPointerMove={onMove} onPointerUp={(e) => { e.stopPropagation(); onUp(t); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(0,0,0,0.25)' }} />
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
