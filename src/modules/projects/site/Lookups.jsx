import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSite } from '../../../context/SiteContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/permissions';

function Lookup({ title, table, rows, columnLabel }) {
  const { loaded, save, remove } = useSite();
  const { profile } = useAuth();
  return (
    <SetupListPage
      title={title}
      rows={rows}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => r.name}
      columns={[{ key: 'name', label: columnLabel }]}
      fields={[{ name: 'name', label: columnLabel, required: true }]}
      fromForm={(v) => ({ name: v.name.trim() })}
      onSave={(values, row) => save(table, values, row?.id)}
      onDelete={(row) => remove(table, row.id)}
    />
  );
}
export const Trades = () => { const { trades } = useSite(); return <Lookup title="Trade" table="trades" rows={trades} columnLabel="Trade" />; };
export const SnagCategories = () => { const { snagCategories } = useSite(); return <Lookup title="Snag Category" table="snag_categories" rows={snagCategories} columnLabel="Category" />; };
