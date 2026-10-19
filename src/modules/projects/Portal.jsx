/** Client / contractor portal: read-mostly views of the projects they are members of (access enforced by RLS). */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSetup } from '../../context/SetupContext';
import { useAuth } from '../../context/AuthContext';
import { projectProgress, todayStr } from '../../lib/reportData';
import { FilesPanel, CommentsPanel } from '../../components/shared/RecordPanels';
import ProjectMembers from './ProjectMembers';

const page = { padding: '24px 28px', color: 'var(--text-color)', fontFamily: 'var(--font-family)', display: 'flex', flexDirection: 'column', gap: '20px' };
const card = { border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--card-bg)', padding: '16px 20px' };
const muted = { fontSize: '12px', color: 'var(--text-muted)' };
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');
const STATUS = { Open: ['var(--st-blue-bg)', 'var(--st-blue-fg)'], Working: ['var(--st-amber-bg)', 'var(--st-amber-fg)'], Completed: ['var(--st-green-bg)', 'var(--st-green-fg)'], Overdue: ['var(--st-red-bg)', 'var(--st-red-fg)'] };
const Badge = ({ s }) => { const [bg, fg] = STATUS[s] || ['var(--surface-gray-2)', 'var(--text-light)']; return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: bg, color: fg, fontWeight: 600 }}>{s}</span>; };

function Progress({ value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px' }}><div style={{ width: `${value}%`, height: '100%', background: '#22c55e', borderRadius: '3px' }} /></div>
      <span style={muted}>{value}%</span>
    </div>
  );
}

export function PortalHome() {
  const { projects, projectTasks } = useProjects();
  const { updates } = useSetup();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const mine = useMemo(() => projectTasks.filter((t) => t.assigneeId === user?.id && t.status !== 'Completed' && t.status !== 'Cancelled'), [projectTasks, user]);
  const today = todayStr();

  return (
    <div data-testid="portal-home" style={page}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <div style={muted}>{role === 'contractor' ? 'Your projects and assigned tasks' : 'Progress on your projects'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {projects.length === 0 && <div style={{ ...card, ...muted }}>You have not been added to any project yet.</div>}
        {projects.map((p) => (
          <div key={p.id} data-testid="portal-project" onClick={() => navigate(`/projects/project/${p.id}`)} style={{ ...card, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><strong style={{ fontSize: '14px' }}>{p.projectName}</strong><Badge s={p.status} /></div>
            <div style={muted}>{[p.projectType, p.customer].filter(Boolean).join(' · ') || p.id}</div>
            <Progress value={projectProgress(p.projectName, projectTasks)} />
            <div style={muted}>{fmt(p.expectedStartDate)} → {fmt(p.expectedEndDate)}</div>
          </div>
        ))}
      </div>

      {role === 'contractor' && (
        <div style={card}>
          <strong style={{ fontSize: '14px' }}>Your tasks ({mine.length})</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {mine.length === 0 && <div style={muted}>Nothing assigned to you right now.</div>}
            {mine.map((t) => (
              <Link key={t.id} to={`/projects/task/${t.id}`} data-testid="portal-task" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', textDecoration: 'none', color: 'var(--text-color)', fontSize: '13px' }}>
                <span style={{ flex: 1 }}>{t.subject}<span style={{ ...muted, display: 'block' }}>{t.project}</span></span>
                <span style={{ ...muted, color: t.expectedEndDate && t.expectedEndDate < today ? '#ef4444' : undefined }}>Due {fmt(t.expectedEndDate)}</span>
                <Badge s={t.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <strong style={{ fontSize: '14px' }}>Latest updates</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {updates.length === 0 && <div style={muted}>No updates shared with you yet.</div>}
          {updates.slice(0, 8).map((u) => (
            <div key={u.id} data-testid="portal-update" style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '10px' }}>
              <div style={{ fontSize: '13px' }}>{u.description}</div>
              <div style={muted}>{u.projects?.project_name} · {u.type} · {fmt(u.update_date)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PortalProject() {
  const { id } = useParams();
  const { projects, projectTasks } = useProjects();
  const { updates } = useSetup();
  const project = projects.find((p) => p.id === id);
  const [tab, setTab] = useState('Overview');
  if (!project) return <div style={page}><div style={muted}>Project not found, or you do not have access to it. <Link to="/projects">Back to your projects</Link></div></div>;
  const tasks = projectTasks.filter((t) => t.project === project.projectName);
  const ups = updates.filter((u) => u.project_id === project.dbId);

  return (
    <div data-testid="portal-project-detail" style={page}>
      <div>
        <Link to="/projects" style={{ ...muted, textDecoration: 'none' }}>← Your projects</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '6px 0 4px' }}>{project.projectName}</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><Badge s={project.status} /><span style={muted}>{fmt(project.expectedStartDate)} → {fmt(project.expectedEndDate)}</span></div>
        <div style={{ maxWidth: '360px', marginTop: '10px' }}><Progress value={projectProgress(project.projectName, projectTasks)} /></div>
      </div>
      <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border-color)' }}>
        {['Overview', 'Tasks', 'Updates', 'Team', 'Files', 'Discussion'].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--blue-500)' : '2px solid transparent', color: tab === t ? 'var(--text-color)' : 'var(--text-muted)', padding: '8px 0', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t ? 600 : 500, fontFamily: 'inherit' }}>{t}</button>
        ))}
      </div>
      {tab === 'Overview' && (
        <div style={card}>
          <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{project.description || 'No description.'}</div>
          <div style={{ ...muted, marginTop: '10px' }}>{[project.projectType, project.customer, project.company].filter(Boolean).join(' · ')}</div>
        </div>
      )}
      {tab === 'Tasks' && (
        <div style={card}>
          {tasks.length === 0 && <div style={muted}>No tasks yet.</div>}
          {tasks.map((t) => (
            <Link key={t.id} to={`/projects/task/${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--divider-color)', textDecoration: 'none', color: 'var(--text-color)', fontSize: '13px' }}>
              <span style={{ flex: 1 }}>{t.subject}</span><span style={muted}>Due {fmt(t.expectedEndDate)}</span><Badge s={t.status} />
            </Link>
          ))}
        </div>
      )}
      {tab === 'Updates' && (
        <div style={card}>
          {ups.length === 0 && <div style={muted}>No updates shared yet.</div>}
          {ups.map((u) => <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--divider-color)' }}><div style={{ fontSize: '13px' }}>{u.description}</div><div style={muted}>{u.type} · {fmt(u.update_date)}</div></div>)}
        </div>
      )}
      {tab === 'Team' && <div style={card}><ProjectMembers projectId={project.dbId} /></div>}
      {tab === 'Files' && <FilesPanel projectId={project.dbId} recordType="project" recordId={project.dbId} />}
      {tab === 'Discussion' && <CommentsPanel projectId={project.dbId} recordType="project" recordId={project.dbId} />}
    </div>
  );
}

export function PortalTask() {
  const { id } = useParams();
  const { projects, projectTasks, updateProjectTask } = useProjects();
  const { user, role } = useAuth();
  const task = projectTasks.find((t) => t.id === id);
  const project = projects.find((p) => p.projectName === task?.project);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('Details');
  if (!task) return <div style={page}><div style={muted}>Task not found, or you do not have access to it. <Link to="/projects">Back</Link></div></div>;
  const mine = role === 'contractor' && task.assigneeId === user?.id;
  const save = async (patch) => { setSaving(true); await updateProjectTask(task.id, patch); setSaving(false); };
  const inp = { padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--control-bg)', color: 'var(--text-color)', fontSize: '13px', fontFamily: 'inherit' };

  return (
    <div data-testid="portal-task-detail" style={page}>
      <div>
        {project && <Link to={`/projects/project/${project.id}`} style={{ ...muted, textDecoration: 'none' }}>← {project.projectName}</Link>}
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '6px 0 4px' }}>{task.subject}</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><Badge s={task.status} /><span style={muted}>Due {fmt(task.expectedEndDate)} · {task.priority} priority</span></div>
      </div>
      <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border-color)' }}>
        {['Details', 'Files', 'Discussion'].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--blue-500)' : '2px solid transparent', color: tab === t ? 'var(--text-color)' : 'var(--text-muted)', padding: '8px 0', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t ? 600 : 500, fontFamily: 'inherit' }}>{t}</button>
        ))}
      </div>
      {tab === 'Details' && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{task.description || 'No description.'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><div style={muted}>Expected</div><div style={{ fontSize: '13px' }}>{fmt(task.expectedStartDate)} → {fmt(task.expectedEndDate)}</div></div>
            <div><div style={muted}>Actual</div><div style={{ fontSize: '13px' }}>{fmt(task.actualStartDate)} → {fmt(task.actualEndDate)}</div></div>
          </div>
          {mine && (
            <div data-testid="contractor-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <div><div style={muted}>Status</div>
                <select aria-label="Task status" value={task.status} disabled={saving} onChange={(e) => save({ status: e.target.value })} style={inp}>
                  {['Open', 'Working', 'Pending', 'Completed'].map((s) => <option key={s}>{s}</option>)}
                </select></div>
              <div><div style={muted}>Actual start</div><input type="date" aria-label="Actual start" value={task.actualStartDate || ''} disabled={saving} onChange={(e) => save({ actualStartDate: e.target.value })} style={inp} /></div>
              <div><div style={muted}>Actual end</div><input type="date" aria-label="Actual end" value={task.actualEndDate || ''} disabled={saving} onChange={(e) => save({ actualEndDate: e.target.value })} style={inp} /></div>
            </div>
          )}
        </div>
      )}
      {tab === 'Files' && project && <FilesPanel projectId={project.dbId} recordType="task" recordId={task.dbId} />}
      {tab === 'Discussion' && project && <CommentsPanel projectId={project.dbId} recordType="task" recordId={task.dbId} />}
    </div>
  );
}
