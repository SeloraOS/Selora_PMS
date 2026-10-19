import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { useProjects } from '../../../context/ProjectsContext';
import { can } from '../../../lib/permissions';

const TYPES = ['Progress', 'Milestone', 'Issue', 'Other'];
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB') : '—');

export default function ProjectUpdate() {
  const { updates, loaded, save, remove } = useSetup();
  const { projects } = useProjects();
  const { profile, user } = useAuth();
  const project = (r) => r.projects?.project_name || '—';

  return (
    <SetupListPage
      title="Project Update"
      rows={updates}
      loading={!loaded}
      canEdit // anyone signed in can post updates
      canDelete={(r) => can(profile, 'delete', { createdBy: r.created_by }) || r.created_by === user?.id}
      searchText={(r) => `${project(r)} ${r.description || ''} ${r.sent_to || ''}`}
      filters={[{ key: 'type', label: 'Type', options: TYPES, get: (r) => r.type }]}
      columns={[
        { key: 'project', label: 'Project', render: project },
        { key: 'type', label: 'Type' },
        { key: 'description', label: 'Update' },
        { key: 'update_date', label: 'Date', render: (r) => fmt(r.update_date) },
        { key: 'sent_to', label: 'Sent To' },
        { key: 'visibility', label: 'Visible to', render: (r) => (r.visibility === 'shared' ? 'Clients & contractors' : 'Internal only') },
      ]}
      fields={[
        { name: 'project_id', label: 'Project', type: 'select', required: true, options: projects.map((p) => ({ value: p.dbId || p.id, label: p.projectName })) },
        { name: 'type', label: 'Type', type: 'select', default: 'Progress', options: TYPES.map((t) => ({ value: t, label: t })) },
        { name: 'description', label: 'Update', type: 'textarea', required: true },
        { name: 'update_date', label: 'Date', type: 'date', default: new Date().toISOString().slice(0, 10) },
        { name: 'sent_to', label: 'Sent To' },
        { name: 'visibility', label: 'Visible to', type: 'select', default: 'internal', options: [{ value: 'internal', label: 'Internal only' }, { value: 'shared', label: 'Clients & contractors on this project' }] },
      ]}
      fromForm={(v) => ({ project_id: v.project_id, type: v.type, description: v.description, update_date: v.update_date || null, sent_to: v.sent_to || null, visibility: v.visibility || 'internal' })}
      onSave={(values, row) => save('project_updates', values, row?.id)}
      onDelete={(row) => remove('project_updates', row.id)}
    />
  );
}
