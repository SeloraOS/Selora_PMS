import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSelection } from '../../lib/useSelection';
import { useViewMode } from '../../lib/useViewMode';
import ViewMenu from '../../components/shared/ViewMenu';
import { SortMenu, ColumnsMenu } from '../../components/shared/ListMenus';
import RecordTable from '../../components/shared/RecordTable';
import { sortRows } from '../../lib/sortRows';
import { useListPrefs } from '../../lib/useListPrefs';
import { TASK_COLUMNS } from './listColumns';
import { useSetup } from '../../context/SetupContext';
import KanbanBoard from '../../components/shared/KanbanBoard';
import { TaskCard } from './kanbanCards';
import { todayStr } from '../../lib/reportData';
import BulkDeleteButton from '../../components/shared/BulkDeleteButton';
import { 
  Filter, RefreshCw, Plus, CheckSquare, X
} from 'lucide-react';

export default function TaskList() {
  const navigate = useNavigate();
  const { projects, projectTasks, addProjectTask, deleteProjectTask, updateProjectTask } = useProjects();
  const { view, setView, pipeline, setPipeline, pipelines } = useViewMode('task');
  const prefs = useListPrefs('task', TASK_COLUMNS, { key: 'createdOn', order: 'desc' });
  const { projectTypes } = useSetup();
  const pipelineCtx = { projects, projectTypes };
  const selection = useSelection();
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    subject: '',
    project: '',
    priority: 'Low'
  });

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('Open');
  const [statusTouched, setStatusTouched] = useState(false); // the default 'Open' filter must not hide cards on a board grouped by something else
  const [filterPriority, setFilterPriority] = useState('');

  const handleOpenModal = () => {
    setModalForm({ subject: '', project: projects.length > 0 ? projects[0].projectName : '', priority: 'Low' });
    setIsModalOpen(true);
  };
  const handleCloseModal = () => setIsModalOpen(false);

  const handleModalSave = (e) => {
    e.preventDefault();
    if (!modalForm.subject) return alert('Subject is required');
    addProjectTask({ subject: modalForm.subject, project: modalForm.project, priority: modalForm.priority, status: 'Open' });
    setIsModalOpen(false);
  };

  const handleEditFullForm = () => navigate('/projects/task/new', { state: { initialValues: modalForm } });

  const filteredTasks = (projectTasks || []).filter(task => {
    return task.id.toLowerCase().includes(filterId.toLowerCase()) &&
           task.subject.toLowerCase().includes(filterSubject.toLowerCase()) &&
           (filterProject ? task.project === filterProject : true) &&
           ((view === 'kanban' && (pipeline.id === 'status' || !statusTouched)) || !filterStatus || task.status === filterStatus) && // the board's columns are the statuses
           (filterPriority ? task.priority === filterPriority : true);
  });

  const sortedTasks = sortRows(filteredTasks, prefs.sortColumn, prefs.sort.order);

  const clearFilters = () => { setFilterId(''); setFilterSubject(''); setFilterProject(''); setFilterStatus(''); setFilterPriority(''); };

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
          <SortMenu columns={TASK_COLUMNS} sort={prefs.sort} onChange={prefs.setSort} />
          <ColumnsMenu columns={TASK_COLUMNS} visibleSet={prefs.visibleSet} onToggle={prefs.toggleColumn} onReset={prefs.resetColumns} disabled={view === 'kanban'} disabledHint="Columns apply to the list view" />
          <BulkDeleteButton rows={sortedTasks.filter(r => selection.has(r.id))} label="task" onDelete={deleteProjectTask} onDone={selection.clear} />
          <button onClick={handleOpenModal} style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      {/* ─── Expandable Filter Bar ─── */}
      {showFilters && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', padding: '12px 24px', alignItems: 'center' }}>
          <input placeholder="ID" value={filterId} onChange={e => setFilterId(e.target.value)} style={inputStyle} />
          <input placeholder="Subject" value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={inputStyle} />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={inputStyle}>
            <option value="">Project (All)</option>
            {projects.map(p => <option key={p.id} value={p.projectName}>{p.projectName}</option>)}
          </select>
          <select disabled={view === 'kanban' && pipeline.id === 'status'} title={view === 'kanban' && pipeline.id === 'status' ? 'The board columns are the statuses' : undefined} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setStatusTouched(true); }} style={inputStyle}>
            <option value="">Status (All)</option>
            <option value="Open">Open</option><option value="Working">Working</option><option value="Pending">Pending</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={inputStyle}>
            <option value="">Priority (All)</option>
            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option>
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
            columns={pipeline.columns(sortedTasks, pipelineCtx)}
            items={sortedTasks}
            getColumn={pipeline.column}
            getId={t => t.id}
            onOpen={t => navigate(`/projects/task/${t.id}`)}
            onMove={(t, column) => updateProjectTask(t.id, pipeline.patch(column))}
            renderCard={t => <TaskCard task={t} today={todayStr()} />}
          />
        ) : sortedTasks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '40px' }}>
            <CheckSquare size={48} strokeWidth={1} style={{ color: 'var(--gray-400, #9ca3af)', marginBottom: '16px' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-muted, #6b7280)', marginBottom: '16px', textAlign: 'center' }}>No Task found. Adjust filters to see more results.</p>
            <button onClick={handleOpenModal} style={{ backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-color, #1a1a1a)', padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Create a new Task
            </button>
          </div>
        ) : (
          <RecordTable
            columns={prefs.visibleColumns}
            rows={sortedTasks}
            selection={selection}
            onOpen={r => navigate(`/projects/task/${r.id}`)}
            sort={prefs.sort}
            onSort={key => prefs.setSort({ key, order: prefs.sort.key === key && prefs.sort.order === 'asc' ? 'desc' : 'asc' })}
          />
        )}
      </div>

      {/* ─── New Task Modal ─── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(1px)' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', borderRadius: '10px', width: '520px', maxWidth: '90%', display: 'flex', flexDirection: 'column', boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.15)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--divider-color)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>New Task</h2>
              <button onClick={handleCloseModal} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleModalSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Subject <span style={{ color: '#ef4444' }}>*</span></label><input type="text" required value={modalForm.subject} onChange={e => setModalForm(prev => ({ ...prev, subject: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }} /></div>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Project</label><select value={modalForm.project} onChange={e => setModalForm(prev => ({ ...prev, project: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }}><option value="">Select Project</option>{projects.map(p => (<option key={p.id} value={p.projectName}>{p.projectName}</option>))}</select></div>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Priority</label><select value={modalForm.priority} onChange={e => setModalForm(prev => ({ ...prev, priority: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option></select></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button type="button" onClick={handleEditFullForm} style={{ backgroundColor: 'var(--surface-gray-2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-light)', cursor: 'pointer' }}>Edit Full Form</button>
                <button type="submit" style={{ backgroundColor: 'var(--gray-900)', border: '1px solid var(--gray-900)', borderRadius: '6px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
