import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { watchTables } from '../lib/realtime';
import { useSetup } from './SetupContext';
import { scheduleTemplateTasks } from '../lib/templates';
import { todayStr } from '../lib/reportData';
import {
  indexProjects,
  projectFromRow, projectToRow, projectUserRows,
  taskFromRow, taskToRow, dependencyRows,
  timesheetFromRow, timesheetToRow, entriesToRows,
} from '../lib/mappers';

const ProjectsContext = createContext(null);

const PROJECT_SELECT = '*, project_users(*)';
const TIMESHEET_SELECT = '*, timesheet_entries(*)';
const TASK_SELECT = '*, task_dependencies!task_dependencies_task_id_fkey(depends_on_id)';
const newest = { ascending: false };

const fail = (what, error) => {
  console.error(`Error ${what}:`, error);
  window.alert(`Error ${what}: ${error.message}`);
  return null;
};

export function ProjectsProvider({ children }) {
  const [projectRows, setProjectRows] = useState([]);
  const [taskRows, setTaskRows] = useState([]);
  const [timesheetRows, setTimesheetRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const { projectTypes, templates } = useSetup();
  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  const idx = useMemo(() => indexProjects(projectRows, projectTypes, taskRows), [projectRows, projectTypes, taskRows]);
  const idxRef = useRef(idx);
  idxRef.current = idx;

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projects').select(PROJECT_SELECT).order('created_at', newest);
    if (error) console.error('Error fetching projects:', error);
    else setProjectRows(data);
  }, []);
  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase.from('project_tasks').select(TASK_SELECT).order('created_at', newest);
    if (error) console.error('Error fetching project tasks:', error);
    else setTaskRows(data);
  }, []);
  const loadTimesheets = useCallback(async () => {
    const { data, error } = await supabase.from('timesheets').select(TIMESHEET_SELECT).order('created_at', newest);
    if (error) console.error('Error fetching timesheets:', error);
    else setTimesheetRows(data);
  }, []);

  useEffect(() => {
    Promise.all([loadProjects(), loadTasks(), loadTimesheets()]).then(() => setLoaded(true));
  }, [loadProjects, loadTasks, loadTimesheets]);

  // Realtime: refetch the affected table whenever any client changes it
  useEffect(() => watchTables('projects-module', {
    projects: loadProjects,
    project_tasks: loadTasks,
    task_dependencies: loadTasks,
    timesheets: loadTimesheets,
    timesheet_entries: loadTimesheets,
    project_users: loadProjects,
  }), [loadProjects, loadTasks, loadTimesheets]);

  const projects = useMemo(() => projectRows.map((r) => projectFromRow(r, idx)), [projectRows, idx]);
  const projectTasks = useMemo(() => taskRows.map((r) => taskFromRow(r, idx)), [taskRows, idx]);
  const timesheets = useMemo(() => timesheetRows.map((r) => timesheetFromRow(r, idx)), [timesheetRows, idx]);

  // ── Projects ──────────────────────────────────────────────────────────────
  const writeProjectUsers = async (projectId, users) => {
    const { error: delErr } = await supabase.from('project_users').delete().eq('project_id', projectId);
    if (delErr) return delErr;
    const rows = projectUserRows(projectId, users);
    if (!rows.length) return null;
    const { error } = await supabase.from('project_users').insert(rows);
    return error;
  };

  const fetchProject = async (id) => {
    const { data: row, error } = await supabase.from('projects').select(PROJECT_SELECT).eq('id', id).single();
    if (error) return fail('loading project', error);
    setProjectRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    return projectFromRow(row, idxRef.current);
  };

  // A project created From Template gets the template's tasks, scheduled from the project start date.
  const createTemplateTasks = async (project, templateName) => {
    const template = templatesRef.current.find((t) => t.name === templateName);
    const rows = scheduleTemplateTasks(project, template?.project_template_tasks || [], todayStr());
    if (!rows.length) return null;
    const { error } = await supabase.from('project_tasks').insert(rows);
    if (!error) loadTasks();
    return error;
  };

  const addProject = async (data) => {
    const { data: row, error } = await supabase
      .from('projects').insert(projectToRow(data, idxRef.current)).select('id, company, expected_start_date').single();
    if (error) return fail('adding project', error);
    const userErr = await writeProjectUsers(row.id, data.users);
    if (userErr) return fail('saving project users', userErr);
    if (data.fromTemplate) {
      const tplErr = await createTemplateTasks(row, data.fromTemplate);
      if (tplErr) fail('creating tasks from the template', tplErr);
    }
    return fetchProject(row.id);
  };

  const updateProject = async (code, updates) => {
    const { data: row, error } = await supabase
      .from('projects').update(projectToRow(updates, idxRef.current)).eq('code', code).select('id').single();
    if (error) return fail('updating project', error);
    if (Object.prototype.hasOwnProperty.call(updates, 'users')) {
      const userErr = await writeProjectUsers(row.id, updates.users);
      if (userErr) return fail('saving project users', userErr);
    }
    return fetchProject(row.id);
  };

  const deleteProject = async (code) => {
    const { error } = await supabase.from('projects').delete().eq('code', code);
    if (error) return fail('deleting project', error);
    setProjectRows((prev) => prev.filter((r) => r.code !== code));
    loadTasks(); // tasks of the project are unlinked by the database
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const writeDependencies = async (taskId, deps) => {
    const { error: delErr } = await supabase.from('task_dependencies').delete().eq('task_id', taskId);
    if (delErr) return delErr;
    const rows = dependencyRows(taskId, deps, idxRef.current);
    if (!rows.length) return null;
    const { error } = await supabase.from('task_dependencies').insert(rows);
    return error;
  };

  const fetchTask = async (id) => {
    const { data: row, error } = await supabase.from('project_tasks').select(TASK_SELECT).eq('id', id).single();
    if (error) return fail('loading project task', error);
    setTaskRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    return taskFromRow(row, { ...idxRef.current, taskById: new Map([...idxRef.current.taskById, [row.id, row]]) });
  };

  const addProjectTask = async (data) => {
    const { data: row, error } = await supabase
      .from('project_tasks').insert(taskToRow(data, idxRef.current)).select('id').single();
    if (error) return fail('adding project task', error);
    const depErr = await writeDependencies(row.id, data.dependencies);
    if (depErr) return fail('saving task dependencies', depErr);
    return fetchTask(row.id);
  };

  const updateProjectTask = async (code, updates) => {
    const { data: row, error } = await supabase
      .from('project_tasks').update(taskToRow(updates, idxRef.current)).eq('code', code).select('id').single();
    if (error) return fail('updating project task', error);
    if (Object.prototype.hasOwnProperty.call(updates, 'dependencies')) {
      const depErr = await writeDependencies(row.id, updates.dependencies);
      if (depErr) return fail('saving task dependencies', depErr);
    }
    return fetchTask(row.id);
  };

  const deleteProjectTask = async (code) => {
    const { error } = await supabase.from('project_tasks').delete().eq('code', code);
    if (error) return fail('deleting project task', error);
    setTaskRows((prev) => prev.filter((r) => r.code !== code));
  };

  // ── Timesheets ────────────────────────────────────────────────────────────
  const writeEntries = async (timesheetId, entries) => {
    const { error: delErr } = await supabase.from('timesheet_entries').delete().eq('timesheet_id', timesheetId);
    if (delErr) return delErr;
    const rows = entriesToRows(timesheetId, entries, idxRef.current);
    if (!rows.length) return null;
    const { error } = await supabase.from('timesheet_entries').insert(rows);
    return error;
  };

  const fetchTimesheet = async (id) => {
    const { data: row, error } = await supabase.from('timesheets').select(TIMESHEET_SELECT).eq('id', id).single();
    if (error) return fail('loading timesheet', error);
    setTimesheetRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    return timesheetFromRow(row, idxRef.current);
  };

  const addTimesheet = async (data) => {
    const { data: row, error } = await supabase
      .from('timesheets').insert(timesheetToRow(data, idxRef.current)).select('id').single();
    if (error) return fail('adding timesheet', error);
    const entriesErr = await writeEntries(row.id, data.timeSheets);
    if (entriesErr) return fail('saving timesheet entries', entriesErr);
    return fetchTimesheet(row.id);
  };

  const updateTimesheet = async (code, updates) => {
    const { data: row, error } = await supabase
      .from('timesheets').update(timesheetToRow(updates, idxRef.current)).eq('code', code).select('id').single();
    if (error) return fail('updating timesheet', error);
    if (Object.prototype.hasOwnProperty.call(updates, 'timeSheets')) {
      const entriesErr = await writeEntries(row.id, updates.timeSheets);
      if (entriesErr) return fail('saving timesheet entries', entriesErr);
    }
    return fetchTimesheet(row.id);
  };

  const deleteTimesheet = async (code) => {
    const { error } = await supabase.from('timesheets').delete().eq('code', code);
    if (error) return fail('deleting timesheet', error);
    setTimesheetRows((prev) => prev.filter((r) => r.code !== code));
  };

  return (
    <ProjectsContext.Provider value={{
      loaded,
      projects, addProject, updateProject, deleteProject,
      projectTasks, addProjectTask, updateProjectTask, deleteProjectTask,
      timesheets, addTimesheet, updateTimesheet, deleteTimesheet,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export const useProjects = () => useContext(ProjectsContext);
