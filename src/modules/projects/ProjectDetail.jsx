import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useProjects } from '../../context/ProjectsContext';
import { useSetup } from '../../context/SetupContext';
import DeleteButton from '../../components/shared/DeleteButton';
import { 
  Home, ChevronRight, ChevronDown, ChevronUp, Trash2, Plus, 
  Bold, Italic, Underline, Strikethrough, Link as LinkIcon, Image, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  HelpCircle, Settings, Trash
} from 'lucide-react';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { loaded, projects, addProject, updateProject, deleteProject } = useProjects();
  const { projectTypes, templates, companies, holidayLists, settings } = useSetup();

  const isNew = id === 'new';
  const initialValuesFromState = location.state?.initialValues || {};

  // Form State
  const [formData, setFormData] = useState({
    series: 'PROJ-.####',
    projectName: '',
    fromTemplate: '',
    company: 'Selora Realty',
    status: 'Open',
    projectType: '',
    percentCompleteMethod: 'Task Completion',
    priority: 'Medium',
    department: '',
    isActive: 'Yes',
    estimatedCost: '',
    defaultCostCenter: '',
    collectProgress: false,
    holidayList: '',
    frequencyToCollectProgress: 'Hourly',
    fromTime: '',
    toTime: '',
    subject: 'For project - {0}, update your status',
    message: 'Message will be sent to the users to get their status on the Project',
    notes: '',
    description: '',
    customer: '',
    salesOrder: '',
    users: [],
    // timeline fields
    expectedStartDate: '',
    expectedEndDate: '',
    actualStartDate: '',
    actualEndDate: '',
  });

  const [activeTab, setActiveTab] = useState('Details');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(!isNew);

  // More Info section collapse states
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = useState(true);
  const [isUsersSectionOpen, setIsUsersSectionOpen] = useState(true);
  const [isNotesSectionOpen, setIsNotesSectionOpen] = useState(true);

  // New records start with the default company from settings
  useEffect(() => {
    if (isNew && settings) setFormData(prev => ({ ...prev, company: prev.company === 'Selora Realty' && settings.company ? settings.company : prev.company, holidayList: prev.holidayList || settings.holiday_list || '' }));
  }, [isNew, settings]);

  const loadedId = useRef(null);

  // Load existing project or set defaults (once per id, so realtime refetches don't wipe unsaved edits)
  useEffect(() => {
    if (!isNew) {
      if (!loaded || loadedId.current === id) return;
      const existing = projects.find(p => p.id === id);
      if (existing) {
        loadedId.current = id;
        setFormData({
          ...formData,
          ...existing,
          users: existing.users || []
        });
        setIsSaved(true);
      } else {
        navigate('/projects/project');
      }
    } else if (Object.keys(initialValuesFromState).length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        ...initialValuesFromState,
        users: initialValuesFromState.users || [] 
      }));
      setIsSaved(false);
    }
  }, [id, projects, loaded]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.projectName) {
      alert('Project Name is required');
      return;
    }

    if (isNew) {
      const created = await addProject(formData);
      if (!created) return;
      navigate(`/projects/project/${created.id}`);
    } else {
      updateProject(id, formData);
      setIsSaved(true);
    }
  };

  // Users table handlers
  const handleAddUserRow = () => {
    const newUsers = [...(formData.users || []), { user: '', fullName: '', selected: false }];
    handleInputChange('users', newUsers);
  };

  const handleRemoveUserRow = (index) => {
    const newUsers = formData.users.filter((_, idx) => idx !== index);
    handleInputChange('users', newUsers);
  };

  const handleUserFieldChange = (index, field, value) => {
    const newUsers = formData.users.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    handleInputChange('users', newUsers);
  };

  const toggleSelectAllUsers = (checked) => {
    const newUsers = formData.users.map(u => ({ ...u, selected: checked }));
    handleInputChange('users', newUsers);
  };

  const toggleSelectUser = (index, checked) => {
    const newUsers = formData.users.map((u, idx) => idx === index ? { ...u, selected: checked } : u);
    handleInputChange('users', newUsers);
  };

  const tabs = ['Details', 'Costing', 'Progress', 'More Info'];

  // Input styles helper
  const inputStyle = {
    width: '100%',
    backgroundColor: 'var(--card-bg)',
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
            backgroundColor: isSaved ? 'var(--st-green-bg)' : 'var(--st-amber-bg)',
            color: isSaved ? 'var(--st-green-fg)' : 'var(--st-amber-fg)',
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
              record={projects.find(p => p.id === id)}
              label={`project ${id}`}
              onDelete={async () => { if (await deleteProject(id) !== null) navigate('/projects/project'); }}
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
                    Series <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.series}
                    onChange={e => handleInputChange('series', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="PROJ-.####">PROJ-.####</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Project Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.projectName}
                    onChange={e => handleInputChange('projectName', e.target.value)}
                    style={inputStyle}
                  />
                </div>

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
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Project Type
                  </label>
                  <select
                    value={formData.projectType}
                    onChange={e => handleInputChange('projectType', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select…</option>
                    {projectTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    % Complete Method
                  </label>
                  <select
                    value={formData.percentCompleteMethod}
                    onChange={e => handleInputChange('percentCompleteMethod', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Task Completion">Task Completion</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    From Template
                  </label>
                  <select
                    value={formData.fromTemplate}
                    onChange={e => handleInputChange('fromTemplate', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    {[...new Set([formData.fromTemplate, ...templates.map(t => t.name)].filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
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
                    Is Active
                  </label>
                  <select
                    value={formData.isActive}
                    onChange={e => handleInputChange('isActive', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Accordion Timeline Panel */}
            <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '6px', backgroundColor: 'var(--surface-gray-1, #f9fafb)', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsTimelineOpen(!isTimelineOpen)}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-color, #1a1a1a)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                <span>Timeline</span>
                {isTimelineOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {isTimelineOpen && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--border-color, #e5e7eb)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>Expected Start Date</label>
                    <input 
                      type="date" 
                      value={formData.expectedStartDate} 
                      onChange={e => handleInputChange('expectedStartDate', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>Expected End Date</label>
                    <input 
                      type="date" 
                      value={formData.expectedEndDate} 
                      onChange={e => handleInputChange('expectedEndDate', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>Actual Start Date</label>
                    <input 
                      type="date" 
                      value={formData.actualStartDate} 
                      onChange={e => handleInputChange('actualStartDate', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>Actual End Date</label>
                    <input 
                      type="date" 
                      value={formData.actualEndDate} 
                      onChange={e => handleInputChange('actualEndDate', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ─── COSTING TAB ─── */}
        {activeTab === 'Costing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color, #1a1a1a)', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '8px', margin: 0 }}>
              Costing and Billing
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Estimated Cost
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedCost}
                    onChange={e => handleInputChange('estimatedCost', e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                    Company <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    value={formData.company}
                    onChange={e => handleInputChange('company', e.target.value)}
                    style={inputStyle}
                  >
                    {[...new Set([formData.company, ...companies.map(c => c.name)].filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Default Cost Center
                </label>
                <input
                  type="text"
                  value={formData.defaultCostCenter}
                  onChange={e => handleInputChange('defaultCostCenter', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── PROGRESS TAB ─── */}
        {activeTab === 'Progress' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="collectProgress"
                  checked={formData.collectProgress}
                  onChange={e => handleInputChange('collectProgress', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--blue-500, #0289f7)', cursor: 'pointer' }}
                />
                <label htmlFor="collectProgress" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color, #1a1a1a)', cursor: 'pointer' }}>
                  Collect Progress
                </label>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Holiday List
                </label>
                <select
                  value={formData.holidayList}
                  onChange={e => handleInputChange('holidayList', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">None</option>
                  {holidayLists.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  Frequency To Collect Progress
                </label>
                <select
                  value={formData.frequencyToCollectProgress}
                  onChange={e => handleInputChange('frequencyToCollectProgress', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Hourly">Hourly</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  From Time
                </label>
                <input
                  type="time"
                  value={formData.fromTime}
                  onChange={e => handleInputChange('fromTime', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                  To Time
                </label>
                <input
                  type="time"
                  value={formData.toTime}
                  onChange={e => handleInputChange('toTime', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Right Column */}
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
                  Message <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={formData.message}
                  onChange={e => handleInputChange('message', e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', display: 'block' }}>
                  Message will be sent to the users to get their status on the Project
                </span>
              </div>
            </div>

          </div>
        )}

        {/* ─── MORE INFO TAB (MATCHING SCREENSHOT) ─── */}
        {activeTab === 'More Info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Customer Details Collapsible Section */}
            <div style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setIsCustomerDetailsOpen(!isCustomerDetailsOpen)}
                style={accordionHeaderStyle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Customer Details {isCustomerDetailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              
              {isCustomerDetailsOpen && (
                <div style={{ padding: '16px 0 8px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                      Customer
                    </label>
                    <input
                      type="text"
                      value={formData.customer || ''}
                      onChange={e => handleInputChange('customer', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', display: 'block', marginBottom: '6px' }}>
                      Sales Order
                    </label>
                    <input
                      type="text"
                      value={formData.salesOrder || ''}
                      onChange={e => handleInputChange('salesOrder', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Users Collapsible Section */}
            <div style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setIsUsersSectionOpen(!isUsersSectionOpen)}
                style={accordionHeaderStyle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Users {isUsersSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {isUsersSectionOpen && (
                <div style={{ padding: '16px 0 8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', marginBottom: '4px' }}>
                    Project will be accessible on the website to these users
                  </div>

                  {/* Users Table */}
                  <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--card-bg, #ffffff)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-gray-1, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #6b7280)' }}>
                          <th style={{ padding: '10px 12px', width: '40px' }}>
                            <input 
                              type="checkbox" 
                              onChange={e => toggleSelectAllUsers(e.target.checked)}
                              checked={formData.users?.length > 0 && formData.users.every(u => u.selected)}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ padding: '10px 12px', width: '60px' }}>No.</th>
                          <th style={{ padding: '10px 12px' }}>User <span style={{ color: '#ef4444' }}>*</span></th>
                          <th style={{ padding: '10px 12px' }}>Full Name</th>
                          <th style={{ padding: '10px 12px', width: '160px' }}>View attachments</th>
                          <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}>
                            <Settings size={14} style={{ color: 'var(--text-muted, #6b7280)' }} />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {!formData.users || formData.users.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #6b7280)' }}>
                              No rows
                            </td>
                          </tr>
                        ) : (
                          formData.users.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={row.selected || false} 
                                  onChange={e => toggleSelectUser(idx, e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted, #6b7280)' }}>{idx + 1}</td>
                              <td style={{ padding: '6px 12px' }}>
                                <input
                                  type="text"
                                  placeholder="email@example.com"
                                  value={row.user}
                                  onChange={e => handleUserFieldChange(idx, 'user', e.target.value)}
                                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '13px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 12px' }}>
                                <input
                                  type="text"
                                  placeholder="Full Name"
                                  value={row.fullName}
                                  onChange={e => handleUserFieldChange(idx, 'fullName', e.target.value)}
                                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '13px' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted, #6b7280)' }}>
                                —
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUserRow(idx)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger, #e03636)', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center' }}
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

                  {/* Add Row Button */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAddUserRow}
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
                        gap: '4px'
                      }}
                    >
                      <Plus size={14} /> Add row
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* 3. Notes Collapsible Section */}
            <div style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setIsNotesSectionOpen(!isNotesSectionOpen)}
                style={accordionHeaderStyle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Notes {isNotesSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {isNotesSectionOpen && (
                <div style={{ padding: '16px 0 8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #6b7280)' }}>Notes</div>

                  {/* Mock Rich Text Editor Container */}
                  <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--card-bg)' }}>
                    
                    {/* Rich Text Editor Toolbar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: 'var(--surface-gray-1, #f9fafb)' }}>
                      <select style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color: 'var(--text-color, #1a1a1a)', outline: 'none' }}>
                        <option>Normal</option>
                      </select>
                      <select style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color: 'var(--text-color, #1a1a1a)', outline: 'none' }}>
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
                      <button type="button" style={toolbarButtonStyle} title="Text Background"><span style={{ fontSize: '13px', backgroundColor: '#fef08a', color: 'var(--text-color)', padding: '0 2px', borderRadius: '2px', lineHeight: 1 }}>A</span></button>
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
                      rows={8}
                      placeholder=""
                      value={formData.notes || ''}
                      onChange={e => handleInputChange('notes', e.target.value)}
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        padding: '12px 16px',
                        fontSize: '14px',
                        color: 'var(--text-color, #1a1a1a)',
                        backgroundColor: 'var(--card-bg)',
                        fontFamily: 'var(--font-family, Inter, sans-serif)',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                </div>
              )}
            </div>

          </div>
        )}

      </form>

    </div>
  );
}
