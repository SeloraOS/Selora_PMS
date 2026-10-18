import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';

const LIMIT = 8;

const includes = (q, ...fields) => fields.some((f) => String(f || '').toLowerCase().includes(q));

function Group({ title, items }) {
  if (!items.length) return null;
  return (
    <>
      <div style={{ padding: '10px 14px 4px', fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{title}</div>
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          style={{ padding: '10px 14px', display: 'flex', gap: '10px', textDecoration: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{ width: '28px', height: '28px', backgroundColor: '#f3f4f6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{it.icon}</div>
          <div>
            <div style={{ fontSize: '13px', color: '#1a1a2e', fontWeight: 500 }}>{it.title}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{it.subtitle}</div>
          </div>
        </Link>
      ))}
    </>
  );
}

export default function ProjectsSearch() {
  const { projects, projectTasks, timesheets } = useProjects();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const pick = (rows, test) => (q ? rows.filter(test) : rows).slice(0, LIMIT);
    return {
      projects: pick(projects, (p) => includes(q, p.projectName, p.id, p.projectType, p.department, p.status)).map((p) => ({
        to: `/projects/project/${p.id}`, icon: '🏢', title: p.projectName, subtitle: `${p.id} • ${p.projectType || 'Project'} • ${p.status}`,
      })),
      tasks: pick(projectTasks, (t) => includes(q, t.subject, t.id, t.project, t.status)).map((t) => ({
        to: `/projects/task/${t.id}`, icon: '☑️', title: t.subject, subtitle: `${t.id} • ${t.project || 'No project'} • ${t.status}`,
      })),
      timesheets: pick(timesheets, (ts) => includes(q, ts.id, ts.employee, ts.customer, ts.project, ts.note)).map((ts) => ({
        to: `/projects/timesheet/${ts.id}`, icon: '⏱️', title: `${ts.id} — ${ts.employee || 'Unassigned'}`, subtitle: `${ts.project || 'No project'} • ${ts.totalWorkingHours} h • ${ts.status}`,
      })),
    };
  }, [q, projects, projectTasks, timesheets]);

  const none = !groups.projects.length && !groups.tasks.length && !groups.timesheets.length;
  const label = (name) => (q ? name : `Recent ${name}`);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f8f9fa', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '60px' }}>
      <div style={{ width: '600px', maxWidth: '90vw', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', alignItems: 'center' }}>
        <Search size={18} color="#9ca3af" />
        <input
          type="text"
          placeholder="Search projects, tasks, timesheets…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '15px', color: '#1a1a2e' }}
          autoFocus
        />
      </div>

      <div style={{ width: '600px', maxWidth: '90vw', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', marginTop: '8px', overflow: 'hidden', maxHeight: '480px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <Group title={label('Projects')} items={groups.projects} />
        <Group title={label('Tasks')} items={groups.tasks} />
        <Group title={label('Timesheets')} items={groups.timesheets} />
        {none && <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Nothing matches “{query}”.</div>}
      </div>
    </div>
  );
}
