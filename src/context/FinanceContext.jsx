import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { watchTables } from '../lib/realtime';
import { useAuth } from './AuthContext';

const FinanceContext = createContext(null);

// table -> [state key, select, order column, ascending]
const TABLES = {
  cost_heads: ['costHeads', '*', 'sort_order', true],
  vendors: ['vendors', '*', 'name', true],
  budgets: ['budgets', '*', 'created_at', true],
  work_orders: ['workOrders', '*', 'created_at', false],
  ra_bills: ['bills', '*', 'created_at', false],
  payments: ['payments', '*', 'payment_date', false],
  material_requests: ['materialRequests', '*', 'created_at', false],
  finance_summary: ['summary', '*', 'project_id', true],
};

export function FinanceProvider({ children }) {
  const { isInternal, isExternal, role } = useAuth();
  const [data, setData] = useState({ costHeads: [], vendors: [], budgets: [], workOrders: [], bills: [], payments: [], materialRequests: [], summary: [] });
  const [loaded, setLoaded] = useState(false);

  // clients never see finance; contractors only get what row level security lets through (their own orders and bills)
  const tables = role === 'client' ? [] : isInternal ? Object.keys(TABLES) : ['vendors', 'work_orders', 'ra_bills', 'payments'];

  const load = useCallback(async (table) => {
    const [key, select, order, asc] = TABLES[table];
    const { data: rows, error } = await supabase.from(table).select(select).order(order, { ascending: asc });
    if (error) console.error(`Error fetching ${table}:`, error);
    else setData((prev) => ({ ...prev, [key]: rows }));
  }, []);

  useEffect(() => {
    Promise.all(tables.map(load)).then(() => setLoaded(true));
    if (!tables.length) return undefined;
    const handlers = Object.fromEntries(tables.map((t) => [t, () => load(t)]));
    // roll-ups change whenever the documents behind them do
    for (const t of ['budgets', 'work_orders', 'ra_bills', 'payments']) if (handlers[t]) { const own = handlers[t]; handlers[t] = () => { own(); if (isInternal) load('finance_summary'); }; }
    return watchTables('finance-module', handlers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, role]);

  const fail = (what, error) => { console.error(`Error ${what}:`, error); window.alert(`Error ${what}: ${error.message}`); return null; };
  const refresh = async (table) => { await load(table); if (isInternal && table !== 'vendors' && table !== 'cost_heads' && table !== 'material_requests') await load('finance_summary'); };

  const save = async (table, row, id) => {
    const q = id ? supabase.from(table).update(row).eq('id', id) : supabase.from(table).insert(row);
    const { data: saved, error } = await q.select().single();
    if (error) return fail(`saving ${table.replace('_', ' ')}`, error);
    await refresh(table);
    if (table === 'payments') await load('ra_bills');
    return saved;
  };
  const remove = async (table, id) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return fail(`deleting ${table.replace('_', ' ')}`, error);
    await refresh(table);
    if (table === 'payments') await load('ra_bills');
    return true;
  };

  return <FinanceContext.Provider value={{ ...data, loaded, isExternal, save, remove }}>{children}</FinanceContext.Provider>;
}

export const useFinance = () => useContext(FinanceContext);
