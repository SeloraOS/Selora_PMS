import React from 'react';
import { Pill, PRIORITY_COLORS } from '../../components/shared/KanbanBoard';
import { fmtDate } from '../../lib/kanban';
import { projectProgress, formatINR, todayStr } from '../../lib/reportData';

const mono = { fontSize: '11px', color: 'var(--text-muted, #6b7280)' };
const title = { fontSize: '13px', fontWeight: 600, color: 'var(--text-color, #1a1a1a)', margin: '4px 0', wordBreak: 'break-word' };
const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px' };

export function ProjectCard({ project, tasks }) {
  const progress = projectProgress(project.projectName, tasks);
  const late = project.status === 'Open' && project.expectedEndDate && project.expectedEndDate < todayStr();
  return (
    <>
      <div style={row}>
        <span style={mono}>{project.id}</span>
        {project.priority && <Pill color={PRIORITY_COLORS[project.priority]}>{project.priority}</Pill>}
      </div>
      <div style={title}>{project.projectName}</div>
      <div style={mono}>{[project.projectType, project.customer].filter(Boolean).join(' · ') || '—'}</div>
      <div style={{ marginTop: '8px', height: '4px', background: 'var(--border-color, #e5e7eb)', borderRadius: '2px' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#22c55e', borderRadius: '2px' }} />
      </div>
      <div style={row}>
        <span style={mono}>{progress}% complete</span>
        {project.expectedEndDate && <span style={{ ...mono, color: late ? '#ef4444' : mono.color }}>Due {fmtDate(project.expectedEndDate)}</span>}
      </div>
    </>
  );
}

export function TaskCard({ task, today }) {
  const closed = task.status === 'Completed' || task.status === 'Cancelled';
  const late = !closed && task.expectedEndDate && task.expectedEndDate < today;
  return (
    <>
      <div style={row}>
        <span style={mono}>{task.id}</span>
        <Pill color={PRIORITY_COLORS[task.priority]}>{task.priority}</Pill>
      </div>
      <div style={title}>{task.subject}</div>
      <div style={mono}>{task.project || 'No project'}</div>
      {task.expectedEndDate && (
        <div style={{ ...mono, marginTop: '6px', color: late ? '#ef4444' : mono.color, fontWeight: late ? 600 : 400 }}>
          {late ? 'Overdue · ' : 'Due '}{fmtDate(task.expectedEndDate)}
        </div>
      )}
    </>
  );
}

export function TimesheetCard({ timesheet }) {
  return (
    <>
      <div style={row}>
        <span style={mono}>{timesheet.id}</span>
        <span style={{ ...mono, fontWeight: 600 }}>{timesheet.totalWorkingHours} h</span>
      </div>
      <div style={title}>{timesheet.employee || 'Unassigned'}</div>
      <div style={mono}>{timesheet.project || 'No project'}</div>
      <div style={row}>
        <span style={mono}>{timesheet.customer || '—'}</span>
        <span style={{ ...mono, color: '#15803d', fontWeight: 600 }}>{formatINR(timesheet.totalBillableAmount)}</span>
      </div>
    </>
  );
}
