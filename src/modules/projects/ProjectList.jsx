import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSelection } from '../../lib/useSelection';
import { useViewMode } from '../../lib/useViewMode';
import ViewMenu from '../../components/shared/ViewMenu';
import KanbanBoard from '../../components/shared/KanbanBoard';
import { ProjectCard } from './kanbanCards';
import BulkDeleteButton from '../../components/shared/BulkDeleteButton';
import { useSetup } from '../../context/SetupContext';
import { 
  Filter, RefreshCw, MoreHorizontal, ChevronDown, Plus, FileText, X, List, ArrowUpDown, Columns
} from 'lucide-react';

export default function ProjectList() {
  const navigate = useNavigate();
  const { projects, addProject, deleteProject, updateProject, projectTasks } = useProjects();
  const { view, setView, pipeline, setPipeline, pipelines } = useViewMode('project');
  const selection = useSelection();
  const { templates, companies, settings, projectTypes } = useSetup();
  const pipelineCtx = { projects, projectTypes };
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    series: 'PROJ-.####',
    projectName: '',
    fromTemplate: '',
    company: 'Selora Realty'
  });

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState('Open');
  const [statusTouched, setStatusTouched] = useState(false); // the default 'Open' filter must not hide cards on a board grouped by something else
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [sortBy, setSortBy] = useState('createdOn');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal handlers
  const handleOpenModal = () => {
    setModalForm({
      series: 'PROJ-.####',
      projectName: '',
      fromTemplate: '',
      company: 'Selora Realty'
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleModalSave = (e) => {
    e.preventDefault();
    if (!modalForm.projectName) {
      alert('Project Name is required');
      return;
    }
    addProject({
      projectName: modalForm.projectName,
      series: modalForm.series,
      fromTemplate: modalForm.fromTemplate,
      company: modalForm.company,
      status: 'Open'
    });
    setIsModalOpen(false);
  };

  const handleEditFullForm = () => {
    navigate('/projects/project/new', { state: { initialValues: modalForm } });
  };

  // Filter logic
  const filteredProjects = projects.filter(proj => {
    const matchesId = proj.id.toLowerCase().includes(filterId.toLowerCase());
    const matchesName = proj.projectName.toLowerCase().includes(filterName.toLowerCase());
    const matchesStatus = (view === 'kanban' && (pipeline.id === 'status' || !statusTouched)) || !filterStatus || proj.status === filterStatus; // the board's columns are the statuses
    const matchesType = filterType ? proj.projectType?.toLowerCase().includes(filterType.toLowerCase()) : true;
    const matchesPriority = filterPriority ? proj.priority === filterPriority : true;
    return matchesId && matchesName && matchesStatus && matchesType && matchesPriority;
  });

  // Sort logic
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let fieldA = a[sortBy] || '';
    let fieldB = b[sortBy] || '';
    if (sortBy === 'createdOn') {
      const partsA = fieldA.split('/');
      const partsB = fieldB.split('/');
      if (partsA.length === 3 && partsB.length === 3) {
        fieldA = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime();
        fieldB = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime();
      }
    }
    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const clearFilters = () => {
    setFilterId('');
    setFilterName('');
    setFilterStatus('');
    setFilterType('');
    setFilterPriority('');
  };

  const inputStyle = {
    backgroundColor: 'var(--control-bg, #ffffff)',
    border: '1px solid var(--border-color, #e5e7eb)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '13px',
    color: 'var(--text-color, #1a1a1a)',
    outline: 'none',
    fontFamily: 'var(--font-family, Inter, sans-serif)',
    width: '100%',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    backgroundColor: 'var(--control-bg, #ffffff)',
    border: '1px solid var(--border-color, #e5e7eb)',
    color: 'var(--text-muted, #4b5563)',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-family, Inter, sans-serif)',
    transition: 'all 0.15s'
  };

  return (
    <div style={{ fontFamily: 'var(--font-family, Inter, sans-serif)', color: 'var(--text-color, #1a1a1a)', backgroundColor: 'var(--bg-color, #ffffff)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* ─── Top Action Bar ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ViewMenu view={view} setView={setView} pipelines={pipelines} pipeline={pipeline} setPipeline={setPipeline} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => window.location.reload()} style={{ ...buttonStyle, padding: '6px 8px' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowFilters(!showFilters)} style={{ ...buttonStyle, backgroundColor: showFilters ? 'var(--surface-gray-2, #f3f4f6)' : 'var(--control-bg, #ffffff)' }}>
            <Filter size={14} /> Filter
          </button>
          <button style={buttonStyle}>
            <ArrowUpDown size={14} /> Sort
          </button>
          <button style={buttonStyle}>
            <Columns size={14} /> Columns
          </button>
          <button style={{ ...buttonStyle, padding: '6px 8px' }}>
            <MoreHorizontal size={14} />
          </button>
          <BulkDeleteButton rows={sortedProjects.filter(r => selection.has(r.id))} label="project" onDelete={deleteProject} onDone={selection.clear} />
          <button onClick={handleOpenModal} style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <Plus size={14} /> Add Project
          </button>
        </div>
      </div>

      {/* ─── Expandable Filter Bar ─── */}
      {showFilters && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', padding: '12px 24px', alignItems: 'center' }}>
          <input placeholder="ID" value={filterId} onChange={e => setFilterId(e.target.value)} style={inputStyle} />
          <input placeholder="Project Name" value={filterName} onChange={e => setFilterName(e.target.value)} style={inputStyle} />
          <select disabled={view === 'kanban' && pipeline.id === 'status'} title={view === 'kanban' && pipeline.id === 'status' ? 'The board columns are the statuses' : undefined} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setStatusTouched(true); }} style={inputStyle}>
            <option value="">Status (All)</option>
            <option value="Open">Open</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input placeholder="Project Type" value={filterType} onChange={e => setFilterType(e.target.value)} style={inputStyle} />
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={inputStyle}>
            <option value="">Priority (All)</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
          <button onClick={clearFilters} style={{ ...buttonStyle, width: '100%', justifyContent: 'center' }}>
            <Filter size={13} /> Clear Filters
          </button>
          <select value={`${sortBy}:${sortOrder}`} onChange={e => { const [field, order] = e.target.value.split(':'); setSortBy(field); setSortOrder(order); }} style={inputStyle}>
            <option value="createdOn:desc">Created On ↓</option>
            <option value="createdOn:asc">Created On ↑</option>
            <option value="projectName:asc">Name A-Z</option>
            <option value="projectName:desc">Name Z-A</option>
          </select>
        </div>
      )}

      {/* ─── Main Content / Table ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color, #ffffff)' }}>
        {view === 'kanban' ? (
          <KanbanBoard
            key={pipeline.id}
            columns={pipeline.columns(sortedProjects, pipelineCtx)}
            items={sortedProjects}
            getColumn={pipeline.column}
            getId={p => p.id}
            onOpen={p => navigate(`/projects/project/${p.id}`)}
            onMove={(p, column) => updateProject(p.id, pipeline.patch(column))}
            renderCard={p => <ProjectCard project={p} tasks={projectTasks} />}
          />
        ) : sortedProjects.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '40px' }}>
            <FileText size={48} strokeWidth={1} style={{ color: 'var(--gray-400, #9ca3af)', marginBottom: '16px' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-muted, #6b7280)', marginBottom: '16px', textAlign: 'center' }}>
              No Project found. Adjust filters to see more results.
            </p>
            <button 
              onClick={handleOpenModal}
              style={{ backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-color, #1a1a1a)', padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Create a new Project
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '0 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #6b7280)' }}>
                  <th style={{ padding: '12px 0 12px 8px', width: '30px', textAlign: 'center' }}><input type="checkbox" checked={sortedProjects.length > 0 && sortedProjects.every(r => selection.has(r.id))} onChange={e => selection.toggleAll(sortedProjects.map(r => r.id), e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--gray-900, #111827)' }} /></th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROJECT NAME</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROJECT TYPE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRIORITY</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CREATED ON</th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map(proj => (
                  <tr 
                    key={proj.id} 
                    onClick={() => navigate(`/projects/project/${proj.id}`)}
                    style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-gray-1, #f9fafb)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 0 12px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selection.has(proj.id)} onChange={() => selection.toggle(proj.id)} style={{ cursor: 'pointer', accentColor: 'var(--gray-900, #111827)' }} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-color, #1a1a1a)', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={12} color="var(--text-muted, #6b7280)" />
                        </div>
                        {proj.id}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-color, #1a1a1a)' }}>{proj.projectName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: proj.status === 'Open' ? 'var(--st-blue-bg)' : proj.status === 'Completed' ? 'var(--st-green-bg)' : 'var(--st-red-bg)', color: proj.status === 'Open' ? 'var(--st-blue-fg)' : proj.status === 'Completed' ? 'var(--st-green-fg)' : 'var(--st-red-fg)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: proj.status === 'Open' ? '#3b82f6' : proj.status === 'Completed' ? '#22c55e' : '#ef4444' }}></div>
                        {proj.status}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted, #6b7280)' }}>{proj.projectType || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted, #6b7280)' }}>{proj.priority || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted, #6b7280)' }}>{proj.createdOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── New Project Modal ─── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(1px)' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', borderRadius: '10px', width: '520px', maxWidth: '90%', display: 'flex', flexDirection: 'column', boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.15)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--divider-color)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>New Project</h2>
              <button onClick={handleCloseModal} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleModalSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Series <span style={{ color: '#ef4444' }}>*</span></label><select value={modalForm.series} onChange={e => setModalForm(prev => ({ ...prev, series: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }}><option value="PROJ-.####">PROJ-.####</option></select></div>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Project Name <span style={{ color: '#ef4444' }}>*</span></label><input type="text" required value={modalForm.projectName} onChange={e => setModalForm(prev => ({ ...prev, projectName: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }} /></div>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>From Template</label><select value={modalForm.fromTemplate} onChange={e => setModalForm(prev => ({ ...prev, fromTemplate: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }}><option value="">None</option>{templates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
              <div><label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Company <span style={{ color: '#ef4444' }}>*</span></label><select required value={modalForm.company} onChange={e => setModalForm(prev => ({ ...prev, company: e.target.value }))} style={{ ...inputStyle, padding: '8px 12px' }}>{[...new Set([modalForm.company, settings?.company, ...companies.map(c => c.name)].filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
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
