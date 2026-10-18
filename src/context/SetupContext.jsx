import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { watchTables } from '../lib/realtime';

const SetupContext = createContext(null);

// table -> [state key, select, order column]
const TABLES = {
  project_types: ['projectTypes', '*', 'name'],
  activity_types: ['activityTypes', '*', 'name'],
  activity_costs: ['activityCosts', '*, activity_types(name)', 'created_at'],
  project_templates: ['templates', '*, project_types(name), project_template_tasks(*)', 'name'],
  companies: ['companies', '*', 'name'],
  holiday_lists: ['holidayLists', '*, holidays(*)', 'name'],
  project_updates: ['updates', '*, projects(project_name, code)', 'update_date'],
  profiles: ['profiles', '*', 'created_at'],
};

const fail = (what, error) => {
  console.error(`Error ${what}:`, error);
  window.alert(`Error ${what}: ${error.message}`);
  return null;
};

export function SetupProvider({ children }) {
  const [data, setData] = useState({
    projectTypes: [], activityTypes: [], activityCosts: [], templates: [],
    companies: [], holidayLists: [], updates: [], profiles: [],
  });
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (table) => {
    const [key, select, order] = TABLES[table];
    const { data: rows, error } = await supabase
      .from(table).select(select).order(order, { ascending: table === 'project_updates' ? false : true });
    if (error) console.error(`Error fetching ${table}:`, error);
    else setData((prev) => ({ ...prev, [key]: rows }));
  }, []);

  const loadSettings = useCallback(async () => {
    const { data: row, error } = await supabase.from('pm_settings').select('*').maybeSingle();
    if (error) console.error('Error fetching settings:', error);
    else setSettings(row);
  }, []);

  useEffect(() => {
    Promise.all([...Object.keys(TABLES).map(load), loadSettings()]).then(() => setLoaded(true));
  }, [load, loadSettings]);

  useEffect(() => {
    const handlers = { pm_settings: loadSettings, projects: () => load('project_updates'), project_template_tasks: () => load('project_templates'), holidays: () => load('holiday_lists') };
    for (const table of Object.keys(TABLES)) handlers[table] = () => load(table);
    return watchTables('setup-module', handlers);
  }, [load, loadSettings]);

  // Generic create/update/delete. `row` uses database column names.
  const save = async (table, row, id) => {
    const q = id
      ? supabase.from(table).update(row).eq('id', id)
      : supabase.from(table).insert(row);
    const { data: saved, error } = await q.select().single();
    if (error) return fail(`saving ${table.replace('_', ' ')}`, error);
    await load(table);
    return saved;
  };

  const remove = async (table, id) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return fail(`deleting ${table.replace('_', ' ')}`, error);
    await load(table);
    return true;
  };

  const saveSettings = async (changes) => {
    const { data: row, error } = await supabase.from('pm_settings').update(changes).eq('id', true).select().single();
    if (error) return fail('saving settings', error);
    setSettings(row);
    return row;
  };

  // Templates carry their task list: replace the list on every save.
  const saveTemplate = async ({ id, name, project_type_id, tasks }) => {
    const saved = await save('project_templates', { name, project_type_id: project_type_id || null }, id);
    if (!saved) return null;
    const { error: delErr } = await supabase.from('project_template_tasks').delete().eq('template_id', saved.id);
    if (delErr) return fail('saving template tasks', delErr);
    const rows = (tasks || [])
      .filter((t) => t.subject)
      .map((t, i) => ({
        template_id: saved.id, subject: t.subject, description: t.description || null,
        start_day: Number(t.start_day) || 0, duration: Number(t.duration) || 1, sort_order: i,
      }));
    if (rows.length) {
      const { error } = await supabase.from('project_template_tasks').insert(rows);
      if (error) return fail('saving template tasks', error);
    }
    await load('project_templates');
    return saved;
  };

  // Holiday lists carry their dates: replace the dates on every save.
  const saveHolidayList = async ({ id, name, holidays }) => {
    const saved = await save('holiday_lists', { name }, id);
    if (!saved) return null;
    const { error: delErr } = await supabase.from('holidays').delete().eq('list_id', saved.id);
    if (delErr) return fail('saving holidays', delErr);
    const seen = new Set();
    const rows = (holidays || [])
      .filter((h) => h.holiday_date && !seen.has(h.holiday_date) && seen.add(h.holiday_date))
      .map((h) => ({ list_id: saved.id, holiday_date: h.holiday_date, description: h.description || null }));
    if (rows.length) {
      const { error } = await supabase.from('holidays').insert(rows);
      if (error) return fail('saving holidays', error);
    }
    await load('holiday_lists');
    return saved;
  };

  const updateRole = async (profileId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
    if (error) return fail('updating role', error);
    await load('profiles');
    return true;
  };

  return (
    <SetupContext.Provider value={{ ...data, settings, loaded, save, remove, saveSettings, saveTemplate, saveHolidayList, updateRole }}>
      {children}
    </SetupContext.Provider>
  );
}

export const useSetup = () => useContext(SetupContext);
