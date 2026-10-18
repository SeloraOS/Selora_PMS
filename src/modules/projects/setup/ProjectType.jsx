import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { useProjects } from '../../../context/ProjectsContext';
import { can } from '../../../lib/permissions';

export default function ProjectType() {
  const { projectTypes, loaded, save, remove } = useSetup();
  const { projects } = useProjects();
  const { profile } = useAuth();
  const inUse = (row) => projects.filter((p) => p.projectType === row.name).length;

  return (
    <SetupListPage
      title="Project Type"
      rows={projectTypes}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => `${r.name} ${r.description || ''}`}
      columns={[
        { key: 'name', label: 'Project Type' },
        { key: 'description', label: 'Description' },
        { key: 'projects', label: 'Projects', render: (r) => inUse(r) },
      ]}
      fields={[
        { name: 'name', label: 'Project Type Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      fromForm={(v) => ({ name: v.name.trim(), description: v.description || null })}
      onSave={(values, row) => save('project_types', values, row?.id)}
      onDelete={(row) => remove('project_types', row.id)}
    />
  );
}
