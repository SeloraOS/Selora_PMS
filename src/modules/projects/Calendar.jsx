import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useSite } from '../../context/SiteContext';
import { ChevronLeft, ChevronRight, Clock, Flag, MessageSquare, Plus, X, CalendarDays, AlertTriangle } from 'lucide-react';
import { useProjects } from '../../context/ProjectsContext';
import { useSetup } from '../../context/SetupContext';
import { entryRows, todayStr } from '../../lib/reportData';
import { addDays } from '../../lib/dates';
import {
  TYPES, TYPE_LABELS, buildEvents, groupByDay, monthGrid, weekDays, rangeFor, addMonths, daysBetween, shiftTask, weekdayIndex,
} from '../../lib/calendar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TYPE_DOT = { task: '#3b82f6', project: '#8b5cf6', timesheet: '#14b8a6', holiday: '#ec4899', update: '#f59e0b', approval: '#ef4444', snag: '#f97316' };

const readView = () => { try { const v = localStorage.getItem('selora-calendar-view'); return v === 'week' || v === 'agenda' ? v : 'month'; } catch { return 'month'; } };

const fmtLong = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthTitle = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const STATUS_TONE = {
  Open: ['var(--st-blue-bg)', 'var(--st-blue-fg)'],
  Working: ['var(--st-amber-bg)', 'var(--st-amber-fg)'],
  Completed: ['var(--st-green-bg)', 'var(--st-green-fg)'],
  Overdue: ['var(--st-red-bg)', 'var(--st-red-fg)'],
  Pending: ['var(--surface-gray-2)', 'var(--text-light)'],
  Cancelled: ['var(--surface-gray-2)', 'var(--text-muted)'],
};
const UPDATE_TONE = { Issue: STATUS_TONE.Overdue, Milestone: STATUS_TONE.Completed, Progress: STATUS_TONE.Open, Other: STATUS_TONE.Pending };

function tone(ev) {
  if (ev.type === 'task') return ev.overdue ? STATUS_TONE.Overdue : STATUS_TONE[ev.status] || STATUS_TONE.Open;
  if (ev.type === 'project') return ev.overdue ? STATUS_TONE.Overdue : ev.kind === 'done' ? STATUS_TONE.Completed : ['rgba(139,92,246,0.16)', 'var(--text-color)'];
  if (ev.type === 'update') return UPDATE_TONE[ev.kind] || UPDATE_TONE.Other;
  if (ev.type === 'timesheet') return ['rgba(20,184,166,0.16)', 'var(--text-color)'];
  return ['rgba(236,72,153,0.16)', 'var(--text-color)'];
}

const chipBase = { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', lineHeight: 1.35, padding: '4px 8px', borderRadius: '5px', marginBottom: '5px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', boxSizing: 'border-box' };

function ChipBody({ ev }) {
  const Icon = ev.type === 'timesheet' ? Clock : ev.type === 'project' ? Flag : ev.type === 'update' ? MessageSquare : null;
  return (
    <>
      {Icon && <Icon size={10} style={{ flexShrink: 0 }} />}
      {ev.overdue && ev.type !== 'task' && <AlertTriangle size={10} style={{ flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.type === 'task' && !ev.isStart && !ev.isFirstInRow ? `· ${ev.title}` : ev.title}</span>
    </>
  );
}

function Chip({ ev, index, onOpen }) {
  const [bg, fg] = tone(ev);
  const style = { ...chipBase, background: bg, color: fg, borderLeft: ev.type === 'task' && ev.isStart ? `3px solid ${fg}` : '3px solid transparent' };
  const title = [ev.title, ev.sub].filter(Boolean).join(' · ');
  if (ev.type === 'task') {
    return (
      <Draggable draggableId={ev.key} index={index}>
        {(p, snap) => (
          <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} data-testid={`cal-${ev.key}`} title={title}
            onClick={(e) => { e.stopPropagation(); onOpen(ev); }}
            style={{ ...style, boxShadow: snap.isDragging ? '0 6px 16px rgba(0,0,0,0.3)' : 'none', ...p.draggableProps.style }}>
            <ChipBody ev={ev} />
          </div>
        )}
      </Draggable>
    );
  }
  return (
    <div data-testid={`cal-${ev.key}`} title={title} onClick={(e) => { e.stopPropagation(); onOpen(ev); }} style={style}>
      <ChipBody ev={ev} />
    </div>
  );
}

function DayCell({ day, events, today, inMonth = true, maxChips, tall, onCreate, onOpen, onMore }) {
  const holiday = events.find((e) => e.type === 'holiday');
  // Month view: a multi-day task is drawn on its first and last day and at the start of each week, not on every day in between
  const rest = events.filter((e) => e.type !== 'holiday' && !(maxChips && e.type === 'task' && !e.isStart && !e.isEnd && weekdayIndex(day) !== 0));
  const shown = maxChips ? rest.slice(0, maxChips) : rest;
  const hidden = rest.length - shown.length;
  const isToday = day === today;
  let taskIndex = 0; // Draggables need consecutive indexes; only task chips are draggable
  const weekend = [5, 6].includes((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7);
  return (
    <Droppable droppableId={day}>
      {(p, snap) => (
        <div
          ref={p.innerRef} {...p.droppableProps} data-testid={`cal-day-${day}`}
          onClick={() => onCreate(day)}
          style={{ minHeight: tall ? '380px' : '150px', padding: '8px', cursor: 'pointer', boxSizing: 'border-box', minWidth: 0,
            background: snap.isDraggingOver ? 'var(--surface-gray-3)' : holiday ? 'rgba(236,72,153,0.10)' : weekend ? 'var(--surface-gray-1)' : 'var(--card-bg)', opacity: inMonth ? 1 : 0.55 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: isToday ? 700 : 500, width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? 'var(--gray-900)' : 'transparent', color: isToday ? '#ffffff' : 'var(--text-color)' }}>{Number(day.slice(8))}</span>
            {holiday && <span title={holiday.title} style={{ fontSize: '10px', color: 'var(--text-color)', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎉 {holiday.title}</span>}
          </div>
          {shown.map((ev) => <Chip key={ev.key} ev={ev} index={ev.type === 'task' ? taskIndex++ : 0} onOpen={onOpen} />)}
          {p.placeholder}
          {hidden > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onMore(day); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '2px 4px' }}>+{hidden} more</button>
          )}
        </div>
      )}
    </Droppable>
  );
}

function DayPopup({ day, events, onClose, onOpen, onCreate }) {
  return (
    <div role="dialog" aria-label={fmtLong(day)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '10px', width: '480px', maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
          <strong style={{ fontSize: '14px' }}>{fmtLong(day)}</strong>
          <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '12px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nothing scheduled.</div>}
          {events.map((ev) => {
            const [bg, fg] = tone(ev);
            return (
              <div key={ev.key} onClick={() => ev.link && onOpen(ev)} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 10px', borderRadius: '6px', background: bg, color: fg, cursor: ev.link ? 'pointer' : 'default' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', minWidth: '62px', opacity: 0.85 }}>{ev.type === 'project' ? 'Project' : ev.type}</span>
                <span style={{ fontSize: '13px' }}>{ev.title}{ev.sub && <span style={{ display: 'block', fontSize: '11px', opacity: 0.8 }}>{ev.sub}</span>}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" onClick={() => onCreate(day)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--gray-900)', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}><Plus size={14} /> New task on this day</button>
        </div>
      </div>
    </div>
  );
}

const navBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '30px', minWidth: '30px', padding: '0 10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' };

export default function Calendar() {
  const navigate = useNavigate();
  const { projects, projectTasks, timesheets, updateProjectTask } = useProjects();
  const { holidayLists, updates, settings } = useSetup();
  const { approvals, snags } = useSite();
  const today = todayStr();

  const [view, setViewState] = useState(readView);
  const [cursor, setCursor] = useState(today);
  const [types, setTypes] = useState(() => new Set(TYPES));
  const [project, setProject] = useState('');
  const [openDay, setOpenDay] = useState(null);
  const [moved, setMoved] = useState({}); // optimistic task date patches while a save is in flight

  const setView = (v) => { setViewState(v); try { localStorage.setItem('selora-calendar-view', v); } catch { /* storage unavailable */ } };

  const tasks = useMemo(() => projectTasks.map((t) => (moved[t.id] ? { ...t, ...moved[t.id] } : t)), [projectTasks, moved]);
  const entries = useMemo(() => entryRows(timesheets), [timesheets]);
  const holidays = useMemo(() => holidayLists.find((l) => l.name === settings?.holiday_list)?.holidays || [], [holidayLists, settings]);

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const events = useMemo(
    () => buildEvents({ tasks, projects, entries, holidays, updates, approvals, snags }, { ...range, today, types, project }),
    [tasks, projects, entries, holidays, updates, approvals, snags, range, today, types, project]
  );
  const byDay = useMemo(() => groupByDay(events), [events]);

  const y = Number(cursor.slice(0, 4)); const m = Number(cursor.slice(5, 7)) - 1;
  const step = (dir) => setCursor((c) => (view === 'week' ? addDays(c, dir * 7) : addMonths(c, dir)));
  const title = view === 'week' ? `${fmtShort(range.from)} – ${fmtShort(range.to)} ${range.to.slice(0, 4)}` : monthTitle(cursor);

  const openEvent = (ev) => { if (ev.type === 'timesheet') setOpenDay(ev.date); else if (ev.link) navigate(ev.link); };
  const createTask = (day) => navigate('/projects/task/new', { state: { initialValues: { expectedStartDate: day, expectedEndDate: day } } });
  const toggleType = (t) => setTypes((prev) => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const id = draggableId.split(':')[1];
    const task = projectTasks.find((t) => t.id === id);
    if (!task) return;
    const patch = shiftTask(task, daysBetween(source.droppableId, destination.droppableId));
    setMoved((s) => ({ ...s, [id]: patch }));
    await updateProjectTask(id, patch); // alerts and returns nothing useful on failure; the optimistic patch is dropped either way
    setMoved((s) => { const { [id]: _done, ...rest } = s; return rest; });
  };

  const cellProps = { today, onCreate: createTask, onOpen: openEvent, onMore: setOpenDay };
  const dayEvents = (d) => byDay.get(d) || [];
  const empty = events.length === 0;

  return (
    <div style={{ fontFamily: 'var(--font-family)', color: 'var(--text-color)', background: 'var(--bg-color)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '12px 24px', borderBottom: '1px solid var(--border-color)' }}>
        <button type="button" aria-label="Previous" onClick={() => step(-1)} style={navBtn}><ChevronLeft size={16} /></button>
        <button type="button" onClick={() => setCursor(today)} style={navBtn}>Today</button>
        <button type="button" aria-label="Next" onClick={() => step(1)} style={navBtn}><ChevronRight size={16} /></button>
        <h2 data-testid="cal-title" style={{ fontSize: '16px', fontWeight: 600, margin: '0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={16} /> {title}</h2>
        <div role="group" aria-label="Calendar view" style={{ display: 'inline-flex', marginLeft: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
          {['month', 'week', 'agenda'].map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} style={{ ...navBtn, border: 'none', borderRadius: 0, background: view === v ? 'var(--surface-gray-3)' : 'var(--control-bg)', fontWeight: view === v ? 600 : 400, textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
        <select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)} style={{ ...navBtn, maxWidth: '220px' }}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.projectName}>{p.projectName}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px 24px', borderBottom: '1px solid var(--border-color)' }}>
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={types.has(t)} onClick={() => toggleType(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${types.has(t) ? TYPE_DOT[t] : 'var(--border-color)'}`, background: types.has(t) ? 'var(--surface-gray-2)' : 'transparent', color: types.has(t) ? 'var(--text-color)' : 'var(--text-muted)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: types.has(t) ? TYPE_DOT[t] : 'var(--gray-400)' }} /> {TYPE_LABELS[t]}
          </button>
        ))}
        {!settings?.holiday_list && <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>Pick a default holiday list in Project Settings to see holidays.</span>}
      </div>

      <div style={{ padding: '20px 28px', flex: 1 }}>
        {view === 'agenda' ? (
          <div data-testid="cal-agenda" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {empty && <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '40px', textAlign: 'center' }}>Nothing scheduled this month with the current filters.</div>}
            {[...byDay.keys()].sort().map((d) => (
              <div key={d} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--card-bg)' }}>
                <div style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 600, background: d === today ? 'var(--surface-blue-1)' : 'var(--surface-gray-1)', borderBottom: '1px solid var(--border-color)' }}>{fmtLong(d)}{d === today ? ' · Today' : ''}</div>
                <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {byDay.get(d).map((ev) => {
                    const [bg, fg] = tone(ev);
                    return (
                      <div key={ev.key} data-testid={`cal-ev-${ev.key}`} onClick={() => openEvent(ev)} style={{ display: 'flex', gap: '10px', padding: '6px 10px', borderRadius: '6px', background: bg, color: fg, cursor: ev.link || ev.type === 'timesheet' ? 'pointer' : 'default', fontSize: '13px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', minWidth: '62px' }}>{ev.type === 'project' ? 'Project' : ev.type}</span>
                        <span>{ev.title}{ev.sub && <span style={{ display: 'block', fontSize: '11px', opacity: 0.8 }}>{ev.sub}</span>}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '1px', background: 'var(--border-color)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              {WEEKDAYS.map((w, i) => (
                <div key={w} style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface-gray-1)', color: 'var(--text-muted)' }}>
                  {w}{view === 'week' ? ` ${Number(weekDays(cursor)[i].slice(8))}` : ''}
                </div>
              ))}
              {view === 'month'
                ? monthGrid(y, m).flat().map((c) => <DayCell key={c.date} day={c.date} inMonth={c.inMonth} events={dayEvents(c.date)} maxChips={3} {...cellProps} />)
                : weekDays(cursor).map((d) => <DayCell key={d} day={d} events={dayEvents(d)} tall {...cellProps} />)}
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Click a day to add a task · drag a task to another day to reschedule it · click an item to open it.</div>
          </DragDropContext>
        )}
      </div>

      {openDay && <DayPopup day={openDay} events={dayEvents(openDay)} onClose={() => setOpenDay(null)} onOpen={(ev) => { setOpenDay(null); if (ev.type !== 'timesheet') navigate(ev.link); }} onCreate={(d) => { setOpenDay(null); createTask(d); }} />}
    </div>
  );
}
