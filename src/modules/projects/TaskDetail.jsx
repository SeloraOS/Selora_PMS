import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSetup } from '../../context/SetupContext';
import DeleteButton from '../../components/shared/DeleteButton';
import { 
  Home, ChevronRight, ChevronDown, ChevronUp, Trash2, Plus, 
  Bold, Italic, Underline, Strikethrough, Link as LinkIcon, Image, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  Settings
} from 'lucide-react';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { loaded, projects, projectTasks, addProjectTask, updateProjectTask, deleteProjectTask } = useProjects();
  const { companies } = useSetup();

  const isNew = id === 'new';
  const initialValuesFromState = location.state?.initialValues || {};

  // Form State
  const [formData, setFormData] = useState({
    subject: '',
    project: '',
    isTemplate: 'No',
    issue: '',
    type: '',
    color: '',
    isGroup: 'No',
    status: 'Open',
    priority: 'Low',
    weight: '',
    parentTask: '',
    description: '',
    dependencies: [],
    company: 'Selora Realty',
    department: '',
  });

  const [activeTab, setActiveTab] = useState('Details');
  const [isDependenciesOpen, setIsDependenciesOpen] = useState(true);
  const [isSaved, setIsSaved] = useState(!isNew);

  const loadedId = useRef(null);

  // Load existing task or set defaults (once per id, so realtime refetches don't wipe unsaved edits)
  useEffect(() => {
    if (!isNew) {
      if (!loaded || loadedId.current === id) return;
      const existing = (projectTasks || []).find(t => t.id === id);
      if (existing) {
        loadedId.current = id;
        setFormData({
          ...formData,
          ...existing,
          dependencies: existing.dependencies || []
        });
        setIsSaved(true);
      } else {
        navigate('/projects/task');
      }
    } else if (Object.keys(initialValuesFromState).length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        ...initialValuesFromState,
        dependencies: initialValuesFromState.dependencies || [] 
      }));
      setIsSaved(false);
    }
  }, [id, projectTasks, loaded]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.subject) {
      alert('Subject is required');
      return;
    }

    if (isNew) {
      const created = await addProjectTask(formData);
      if (!created) return;
      navigate(`/projects/task/${created.id}`);
    } else {
      updateProjectTask(id, formData);
      setIsSaved(true);
    }
  };

  // Dependencies handlers
  const handleAddDependency = () => {
    const newDeps = [...(formData.dependencies || []), { taskId: '', subject: '', selected: false }];
    handleInputChange('dependencies', newDeps);
  };

  const handleRemoveDependency = (index) => {
    const newDeps = formData.dependencies.filter((_, idx) => idx !== index);
    handleInputChange('dependencies', newDeps);
  };

  const handleDependencyFieldChange = (index, field, value) => {
    const newDeps = formData.dependencies.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    handleInputChange('dependencies', newDeps);
  };

  const tabs = ['Details', 'Description', 'More Info'];

  // Input styles helper
  const inputStyle = {
    width: '100%',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color, #e5e7eb)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--text-color, #1a1a1a)',
    fontSize: '14px',
    fontFamily: 'var(--font-family, Inter, sans-serif)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const accordionHeaderStyle = {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--text-color, #1a1a1a)',
    padding: '12px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color, #e5e7eb)'
  };

  const toolbarButtonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted, #6b7280)',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.1s'
  };

  return (
    <div style={{ padding: '16px 24px', fontFamily: 'var(--font-family, Inter, sans-serif)', color: 'var(--text-color, #1a1a1a)', backgroundColor: 'var(--bg-color, #ffffff)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* ─── Breadcrumbs & Save Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status Pill Tag */}
          <span style={{ 
            backgroundColor: isSaved ? '#f0fdf4' : '#fff7ed',
            color: isSaved ? '#15803d' : '#b45309',
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '11px', 
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {isSaved ? 'Saved' : 'Not Saved'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isNew && (
            <DeleteButton
              record={projectTasks.find(t => t.id === id)}
              label={`task ${id}`}
              onDelete={async () => { if (await deleteProjectTask(id) !== null) navigate('/projects/task'); }}
            />
          )}
        <button 
          onClick={handleSave} 
          style={{ backgroundColor: 'var(--gray-900, #111827)', border: '1px solid var(--gray-900, #111827)', color: '#ffffff', padding: '6px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Save
        </button>
        </div>
      </div>

      {/* ─── Segmented Tabs ─── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e5e7eb)', marginBottom: '24px', gap: '24px' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--blue-500, #0289f7)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-color, #1a1a1a)' : 'var(--text-muted, #6b7280)',
              padding: '10px 0',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Active Tab Panel Form ─── */}
      <form onSubmit={handleSave} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* ─── DETAILS TAB ─── */}
        {activeTab === 'Details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Subject <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={e => handleInputChange('subject', e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Project
                  </label>
                  <select
                    value={formData.project}
                    onChange={e => handleInputChange('project', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.projectName}>{p.projectName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => handleInputChange('priority', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Weight
                  </label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={e => handleInputChange('weight', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => handleInputChange('status', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Open">Open</option>
                    <option value="Working">Working</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Type
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={e => handleInputChange('type', e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Parent Task
                  </label>
                  <select
                    value={formData.parentTask}
                    onChange={e => handleInputChange('parentTask', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    {projectTasks
                      .filter(t => t.id !== id && t.project === (formData.project || ''))
                      .map(t => <option key={t.id} value={t.id}>{t.id} — {t.subject}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Color
                  </label>
                  <input
                    type="text"
                    placeholder="#388AE5"
                    value={formData.color}
                    onChange={e => handleInputChange('color', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

            </div>

            {/* Accordion Dependencies Panel */}
            <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '6px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsDependenciesOpen(!isDependenciesOpen)}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-color, #1a1a1a)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                <span>Dependencies</span>
                {isDependenciesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {isDependenciesOpen && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--border-color, #e5e7eb)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #6b7280)' }}>
                          <th style={{ padding: '10px 12px', width: '40px' }}>Select</th>
                          <th style={{ padding: '10px 12px', width: '60px' }}>No.</th>
                          <th style={{ padding: '10px 12px' }}>Task ID <span style={{ color: '#ef4444' }}>*</span></th>
                          <th style={{ padding: '10px 12px' }}>Subject</th>
                          <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!formData.dependencies || formData.dependencies.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted, #6b7280)' }}>
                              No dependencies linked
                            </td>
                          </tr>
                        ) : (
                          formData.dependencies.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="checkbox" style={{ cursor: 'pointer' }} />
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted, #6b7280)' }}>{idx + 1}</td>
                              <td style={{ padding: '6px 12px' }}>
                                <select
                                  value={row.taskId}
                                  onChange={e => {
                                    const t = projectTasks.find(x => x.id === e.target.value);
                                    handleDependencyFieldChange(idx, 'taskId', e.target.value);
                                    handleDependencyFieldChange(idx, 'subject', t ? t.subject : '');
                                  }}
                                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '13px' }}
                                >
                                  <option value="">Select task…</option>
                                  {projectTasks
                                    .filter(t => t.id !== id)
                                    .map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '6px 12px' }}>
                                <input
                                  type="text"
                                  placeholder="Dependency Subject"
                                  value={row.subject}
                                  readOnly
                                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '13px' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDependency(idx)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger, #e03636)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDependency}
                    style={{
                      backgroundColor: 'var(--btn-default-bg, #f3f4f6)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      color: 'var(--text-color, #1a1a1a)',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      width: 'fit-content'
                    }}
                  >
                    <Plus size={14} /> Add row
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ─── DESCRIPTION TAB ─── */}
        {activeTab === 'Description' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #6b7280)' }}>Description</div>

            {/* Mock Rich Text Editor Container */}
            <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              
              {/* Rich Text Editor Toolbar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: 'var(--surface-gray-1, #f9fafb)' }}>
                <select style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color: 'var(--text-color, #1a1a1a)', outline: 'none' }}>
                  <option>Normal</option>
                </select>
                <select style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color: 'var(--text-color, #1a1a1a)', outline: 'none' }}>
                  <option>Table</option>
                </select>

                <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />

                <button type="button" style={toolbarButtonStyle} title="Horizontal Rule"><span style={{ fontSize: '12px', fontWeight: 'bold' }}>---</span></button>
                <button type="button" style={{ ...toolbarButtonStyle, fontWeight: 'bold' }} title="Bold"><Bold size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Italic"><Italic size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Underline"><Underline size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Strikethrough"><Strikethrough size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Clear Formatting"><span style={{ fontSize: '11px', fontFamily: 'monospace' }}>Tx</span></button>
                
                <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />

                <button type="button" style={toolbarButtonStyle} title="Text Color"><span style={{ fontSize: '13px', color: '#ef4444', borderBottom: '2px solid #ef4444', lineHeight: 1 }}>A</span></button>
                <button type="button" style={toolbarButtonStyle} title="Text Background"><span style={{ fontSize: '13px', backgroundColor: '#fef08a', color: '#1a1a1a', padding: '0 2px', borderRadius: '2px', lineHeight: 1 }}>A</span></button>
                <button type="button" style={toolbarButtonStyle} title="Blockquote"><span style={{ fontSize: '13px', fontFamily: 'serif', fontWeight: 'bold' }}>“</span></button>
                <button type="button" style={toolbarButtonStyle} title="Code Block"><span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>&lt;/&gt;</span></button>
                
                <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />

                <button type="button" style={toolbarButtonStyle} title="Link"><LinkIcon size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Image"><Image size={13} /></button>
                
                <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />

                <button type="button" style={toolbarButtonStyle} title="Align Left"><AlignLeft size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Align Center"><AlignCenter size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Align Right"><AlignRight size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Align Justify"><AlignJustify size={13} /></button>
                
                <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />

                <button type="button" style={toolbarButtonStyle} title="Unordered List"><List size={13} /></button>
                <button type="button" style={toolbarButtonStyle} title="Ordered List"><ListOrdered size={13} /></button>
              </div>

              {/* Text Area */}
              <textarea
                rows={10}
                placeholder=""
                value={formData.description || ''}
                onChange={e => handleInputChange('description', e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: 'var(--text-color, #1a1a1a)',
                  backgroundColor: '#ffffff',
                  fontFamily: 'var(--font-family, Inter, sans-serif)',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        )}

        {/* ─── MORE INFO TAB ─── */}
        {activeTab === 'More Info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Company
                </label>
                <select
                  value={formData.company}
                  onChange={e => handleInputChange('company', e.target.value)}
                  style={inputStyle}
                >
                  {[...new Set([formData.company, ...companies.map(c => c.name)].filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={e => handleInputChange('department', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Is Group
                </label>
                <select
                  value={formData.isGroup}
                  onChange={e => handleInputChange('isGroup', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Is Template
                </label>
                <select
                  value={formData.isTemplate}
                  onChange={e => handleInputChange('isTemplate', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Issue
                </label>
                <input
                  type="text"
                  value={formData.issue}
                  onChange={e => handleInputChange('issue', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}

      </form>

    </div>
  );
}
