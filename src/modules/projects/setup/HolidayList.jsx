import React from 'react';
import SetupListPage from '../../../components/shared/SetupListPage';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/permissions';

export default function HolidayList() {
  const { holidayLists, loaded, saveHolidayList, remove } = useSetup();
  const { profile } = useAuth();
  const count = (r) => (r.holidays || []).length;

  return (
    <SetupListPage
      title="Holiday List"
      rows={holidayLists}
      loading={!loaded}
      canEdit={can(profile, 'editSetup')}
      searchText={(r) => r.name}
      columns={[
        { key: 'name', label: 'Holiday List' },
        { key: 'holidays', label: 'Holidays', render: count },
      ]}
      fields={[
        { name: 'name', label: 'Holiday List Name', required: true },
        { name: 'holidays', label: 'Holidays', type: 'rowlist', columns: [
          { key: 'holiday_date', placeholder: 'Date', type: 'date', width: '150px' },
          { key: 'description', placeholder: 'Description' },
        ] },
      ]}
      toForm={(r) => ({ name: r.name, holidays: (r.holidays || []).slice().sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)) })}
      fromForm={(v) => ({ name: v.name.trim(), holidays: v.holidays })}
      onSave={(values, row) => saveHolidayList({ ...values, id: row?.id })}
      onDelete={(row) => remove('holiday_lists', row.id)}
    />
  );
}
