import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/permissions';

export default function ProjectTemplate() {
  const { templates, projectTypes, loaded, saveTemplate, remove } = useSetup();
  const { profile } = useAuth();
  const taskCount = (r) => (r.project_template_tasks || []).length;

  return (
    <SetupListPage
      title="Project Template"
      rows={templates}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => `${r.name} ${r.project_types?.name || ''}`}
      filters={[{ key: 'type', label: 'Project Type', options: projectTypes.map((t) => t.name), get: (r) => r.project_types?.name }]}
      columns={[
        { key: 'name', label: 'Template' },
        { key: 'type', label: 'Project Type', render: (r) => r.project_types?.name || '—' },
        { key: 'tasks', label: 'Tasks', render: taskCount },
      ]}
      fields={[
        { name: 'name', label: 'Template Name', required: true },
        { name: 'project_type_id', label: 'Project Type', type: 'select', options: projectTypes.map((t) => ({ value: t.id, label: t.name })) },
        { name: 'tasks', label: 'Tasks', type: 'rowlist', columns: [
          { key: 'subject', placeholder: 'Task subject' },
          { key: 'start_day', placeholder: 'Start day', type: 'number', width: '70px', default: 0 },
          { key: 'duration', placeholder: 'Days', type: 'number', width: '70px', default: 1 },
        ] },
      ]}
      toForm={(r) => ({
        name: r.name,
        project_type_id: r.project_type_id || '',
        tasks: (r.project_template_tasks || []).slice().sort((a, b) => a.sort_order - b.sort_order),
      })}
      fromForm={(v) => ({ name: v.name.trim(), project_type_id: v.project_type_id || null, tasks: v.tasks })}
      onSave={(values, row) => saveTemplate({ ...values, id: row?.id })}
      onDelete={(row) => remove('project_templates', row.id)}
    />
  );
}
