import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSelection } from '../../lib/useSelection';
import { useViewMode } from '../../lib/useViewMode';
import ViewMenu from '../../components/shared/ViewMenu';
import { useSetup } from '../../context/SetupContext';
import KanbanBoard from '../../components/shared/KanbanBoard';
import { TimesheetCard } from './kanbanCards';
import BulkDeleteButton from '../../components/shared/BulkDeleteButton';
import { 
  Filter, RefreshCw, MoreHorizontal, ChevronDown, Plus, FileText, List, ArrowUpDown, Columns, Clock
} from 'lucide-react';

export default function TimesheetList() {
  const navigate = useNavigate();
  const { timesheets, projects, deleteTimesheet, updateTimesheet } = useProjects();
  const { view, setView, pipeline, setPipeline, pipelines } = useViewMode('timesheet');
  const { projectTypes } = useSetup();
  const pipelineCtx = { projects, projectTypes };
  const selection = useSelection();

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [sortBy, setSortBy] = useState('createdOn');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredTimesheets = (timesheets || []).filter(ts => {
    return (ts.id || '').toLowerCase().includes(filterId.toLowerCase()) &&
           (ts.employee || '').toLowerCase().includes(filterEmployee.toLowerCase()) &&
           ((view === 'kanban' && pipeline.id === 'status') || !filterStatus || ts.status === filterStatus) && // the board's columns are the statuses
           (filterProject ? (ts.project || '').toLowerCase().includes(filterProject.toLowerCase()) : true);
  });

  const sortedTimesheets = [...filteredTimesheets].sort((a, b) => {
    let fieldA = a[sortBy] || ''; let fieldB = b[sortBy] || '';
    if (sortBy === 'createdOn') {
      const partsA = fieldA.split('/'); const partsB = fieldB.split('/');
      if (partsA.length === 3 && partsB.length === 3) {
        fieldA = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime();
        fieldB = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime();
      }
    }
    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

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
          <button style={buttonStyle}><ArrowUpDown size={14} /> Sort</button>
          <button style={buttonStyle}><Columns size={14} /> Columns</button>
          <button style={{ ...buttonStyle, padding: '6px 8px' }}><MoreHorizontal size={14} /></button>
          <BulkDeleteButton rows={sortedTimesheets.filter(r => selection.has(r.id))} label="timesheet" onDelete={deleteTimesheet} onDone={selection.clear} />
          <button onClick={handleAddTimesheet} style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <Plus size={14} /> Add Timesheet
          </button>
        </div>
      </div>

      {/* ─── Expandable Filter Bar ─── */}
      {showFilters && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', padding: '12px 24px', alignItems: 'center' }}>
          <input placeholder="ID" value={filterId} onChange={e => setFilterId(e.target.value)} style={inputStyle} />
          <input placeholder="Employee" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} style={inputStyle} />
          <input placeholder="Project" value={filterProject} onChange={e => setFilterProject(e.target.value)} style={inputStyle} />
          <select disabled={view === 'kanban' && pipeline.id === 'status'} title={view === 'kanban' && pipeline.id === 'status' ? 'The board columns are the statuses' : undefined} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="">Status (All)</option><option value="Draft">Draft</option><option value="Submitted">Submitted</option><option value="Billed">Billed</option><option value="Cancelled">Cancelled</option>
          </select>
          <button onClick={clearFilters} style={{ ...buttonStyle, width: '100%', justifyContent: 'center' }}>
            <Filter size={13} /> Clear Filters
          </button>
          <select value={`${sortBy}:${sortOrder}`} onChange={e => { const [field, order] = e.target.value.split(':'); setSortBy(field); setSortOrder(order); }} style={inputStyle}>
            <option value="createdOn:desc">Created On ↓</option><option value="createdOn:asc">Created On ↑</option><option value="totalWorkingHours:desc">Working Hrs ↓</option><option value="totalWorkingHours:asc">Working Hrs ↑</option>
          </select>
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
          <div style={{ overflowX: 'auto', padding: '0 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #6b7280)' }}>
                  <th style={{ padding: '12px 0 12px 8px', width: '30px', textAlign: 'center' }}><input type="checkbox" checked={sortedTimesheets.length > 0 && sortedTimesheets.every(r => selection.has(r.id))} onChange={e => selection.toggleAll(sortedTimesheets.map(r => r.id), e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--gray-900, #111827)' }} /></th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>EMPLOYEE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROJECT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WORKING HOURS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CREATED ON</th>
                </tr>
              </thead>
              <tbody>
                {sortedTimesheets.map(ts => (
                  <tr 
                    key={ts.id} 
                    onClick={() => navigate(`/projects/timesheet/${ts.id}`)}
                    style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-gray-1, #f9fafb)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 0 12px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selection.has(ts.id)} onChange={() => selection.toggle(ts.id)} style={{ cursor: 'pointer', accentColor: 'var(--gray-900, #111827)' }} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-color, #1a1a1a)', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Clock size={12} color="var(--text-muted, #6b7280)" />
                        </div>
                        {ts.id}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-color, #1a1a1a)' }}>{ts.employee || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted, #6b7280)' }}>{ts.project || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-color, #1a1a1a)' }}>{(ts.totalWorkingHours || 0).toFixed(3)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: ts.status === 'Draft' ? 'var(--st-amber-bg)' : 'var(--st-green-bg)', color: ts.status === 'Draft' ? 'var(--st-amber-fg)' : 'var(--st-green-fg)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: ts.status === 'Draft' ? '#f59e0b' : '#22c55e' }}></div>
                        {ts.status}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted, #6b7280)' }}>{ts.createdOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
