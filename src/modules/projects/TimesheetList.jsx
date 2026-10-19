import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSelection } from '../../lib/useSelection';
import { useViewMode } from '../../lib/useViewMode';
import ViewMenu from '../../components/shared/ViewMenu';
import { SortMenu, ColumnsMenu, ExportMenu } from '../../components/shared/ListMenus';
import RecordTable from '../../components/shared/RecordTable';
import { sortRows } from '../../lib/sortRows';
import { useListPrefs } from '../../lib/useListPrefs';
import { TIMESHEET_COLUMNS } from './listColumns';
import { useSetup } from '../../context/SetupContext';
import KanbanBoard from '../../components/shared/KanbanBoard';
import { TimesheetCard } from './kanbanCards';
import BulkDeleteButton from '../../components/shared/BulkDeleteButton';
import { 
  Filter, RefreshCw, Plus, FileText, Clock
} from 'lucide-react';

export default function TimesheetList() {
  const navigate = useNavigate();
  const { timesheets, projects, deleteTimesheet, updateTimesheet } = useProjects();
  const { view, setView, pipeline, setPipeline, pipelines } = useViewMode('timesheet');
  const prefs = useListPrefs('timesheet', TIMESHEET_COLUMNS, { key: 'createdOn', order: 'desc' });
  const { projectTypes } = useSetup();
  const pipelineCtx = { projects, projectTypes };
  const selection = useSelection();

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');

  const filteredTimesheets = (timesheets || []).filter(ts => {
    return (ts.id || '').toLowerCase().includes(filterId.toLowerCase()) &&
           (ts.employee || '').toLowerCase().includes(filterEmployee.toLowerCase()) &&
           ((view === 'kanban' && pipeline.id === 'status') || !filterStatus || ts.status === filterStatus) && // the board's columns are the statuses
           (filterProject ? (ts.project || '').toLowerCase().includes(filterProject.toLowerCase()) : true);
  });

  const sortedTimesheets = sortRows(filteredTimesheets, prefs.sortColumn, prefs.sort.order);

  const clearFilters = () => { setFilterId(''); setFilterEmployee(''); setFilterStatus(''); setFilterProject(''); };

  const handleAddTimesheet = () => navigate('/projects/timesheet/new');

  const inputStyle = { backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: 'var(--text-color, #1a1a1a)', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const buttonStyle = { backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #4b5563)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.15s' };

  return (
    <div style={{ fontFamily: 'var(--font-family, Inter, sans-serif)', color: 'var(--text-color, #1a1a1a)', backgroundColor: 'var(--bg-color, #ffffff)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* ─── Top Action Bar ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ViewMenu view={view} setView={setView} pipelines={pipelines} pipeline={pipeline} setPipeline={setPipeline} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => window.location.reload()} style={{ ...buttonStyle, padding: '6px 8px' }}><RefreshCw size={14} /></button>
          <button onClick={() => setShowFilters(!showFilters)} style={{ ...buttonStyle, backgroundColor: showFilters ? 'var(--surface-gray-2, #f3f4f6)' : 'var(--control-bg, #ffffff)' }}>
            <Filter size={14} /> Filter
          </button>
          <SortMenu columns={TIMESHEET_COLUMNS} sort={prefs.sort} onChange={prefs.setSort} />
          <ColumnsMenu columns={TIMESHEET_COLUMNS} visibleSet={prefs.visibleSet} onToggle={prefs.toggleColumn} onReset={prefs.resetColumns} disabled={view === 'kanban'} disabledHint="Columns apply to the list view" />
          <ExportMenu name="timesheets" columns={prefs.visibleColumns} rows={sortedTimesheets} disabled={!sortedTimesheets.length} />
          <BulkDeleteButton rows={sortedTimesheets.filter(r => selection.has(r.id))} label="timesheet" onDelete={deleteTimesheet} onDone={selection.clear} />
          <button onClick={handleAddTimesheet} style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <Plus size={14} /> Add Timesheet
          </button>
        </div>
      </div>

      {/* ─── Expandable Filter Bar ─── */}
      {showFilters && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', padding: '12px 24px', alignItems: 'center' }}>
          <input placeholder="ID" value={filterId} onChange={e => setFilterId(e.target.value)} style={inputStyle} />
          <input placeholder="Employee" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} style={inputStyle} />
          <input placeholder="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} style={inputStyle} />
          <select disabled={view === 'kanban' && pipeline.id === 'status'} title={view === 'kanban' && pipeline.id === 'status' ? 'The board columns are the statuses' : undefined} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="">Status (All)</option><option value="Draft">Draft</option><option value="Submitted">Submitted</option><option value="Billed">Billed</option><option value="Cancelled">Cancelled</option>
          </select>
          <button onClick={clearFilters} style={{ ...buttonStyle, width: '100%', justifyContent: 'center' }}>
            <Filter size={13} /> Clear Filters
          </button>
        </div>
      )}

      {/* ─── Main Content / Table ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color, #ffffff)' }}>
        {view === 'kanban' ? (
          <KanbanBoard
            key={pipeline.id}
            columns={pipeline.columns(sortedTimesheets, pipelineCtx)}
            items={sortedTimesheets}
            getColumn={pipeline.column}
            getId={t => t.id}
            onOpen={t => navigate(`/projects/timesheet/${t.id}`)}
            onMove={(t, column) => updateTimesheet(t.id, pipeline.patch(column))}
            renderCard={t => <TimesheetCard timesheet={t} />}
          />
        ) : !timesheets || timesheets.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <FileText size={56} strokeWidth={1} style={{ color: 'var(--text-muted, #9ca3af)' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-muted, #6b7280)' }}>You haven't created a Timesheet yet</p>
              <button onClick={handleAddTimesheet} style={{ backgroundColor: 'var(--btn-default-bg, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-color, #1a1a1a)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                Create your first Timesheet
              </button>
            </div>
          </div>
        ) : (
          <RecordTable
            columns={prefs.visibleColumns}
            rows={sortedTimesheets}
            selection={selection}
            onOpen={r => navigate(`/projects/timesheet/${r.id}`)}
            sort={prefs.sort}
            onSort={key => prefs.setSort({ key, order: prefs.sort.key === key && prefs.sort.order === 'asc' ? 'desc' : 'asc' })}
          />
        )}
      </div>
    </div>
  );
}
