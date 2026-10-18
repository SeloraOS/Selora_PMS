import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';

export default function GettingStarted() {
  const navigate = useNavigate();

  const StepCard = ({ num, title, desc, completed, onClick }) => (
    <div 
      onClick={onClick}
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px 20px', marginBottom: '10px', display: 'flex', gap: '16px', alignItems: 'center', cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.borderColor = '#3b82f6'; }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.borderColor = '#e5e7eb'; }}
    >
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: completed ? '#dcfce7' : '#f9fafb', border: `1px solid ${completed ? '#22c55e' : '#e5e7eb'}`, color: completed ? '#22c55e' : '#6b7280', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
        {completed ? <Check size={14} /> : num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a2e', marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>{desc}</div>
      </div>
      <div>
        {completed ? <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 500 }}>Done</span> : <ChevronRight size={16} color="#d1d5db" />}
      </div>
    </div>
  );

  const QuickLink = ({ title, path }) => (
    <div 
      onClick={() => navigate(path)}
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#1a1a2e', textAlign: 'center', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {title}
    </div>
  );

  return (
    <div style={{ padding: '32px 20px', fontFamily: 'Inter, sans-serif', backgroundColor: '#f8f9fa', minHeight: '100%' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px 0' }}>Get Started with Projects</h1>
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px' }}>Set up your project management system</div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>2 of 6 steps completed</div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: '33.33%', height: '100%', background: '#3b82f6' }} />
          </div>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <StepCard num={1} completed title="Create your first Project" desc="Add a project with name and timeline" />
          <StepCard num={2} completed title="Define Project Types" desc="Set up Residential, Commercial etc." />
          <StepCard num={3} title="Add Activity Types" desc="Define activities and billing rates" onClick={() => navigate('/projects/setup/activity-type')} />
          <StepCard num={4} title="Create a Project Template" desc="Save reusable task templates" onClick={() => navigate('/projects/setup/project-template')} />
          <StepCard num={5} title="Log your first Timesheet" desc="Track time on project activities" onClick={() => navigate('/projects/timesheet')} />
          <StepCard num={6} title="View Project Reports" desc="Check progress and analytics" onClick={() => navigate('/projects/reports/project-summary')} />
        </div>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a2e', margin: '0 0 16px 0' }}>Quick Links</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <QuickLink title="Projects" path="/projects/project" />
            <QuickLink title="Tasks" path="/projects/task" />
            <QuickLink title="Timesheets" path="/projects/timesheet" />
            <QuickLink title="Reports" path="/projects/reports/project-summary" />
            <QuickLink title="Settings" path="/projects/settings" />
            <QuickLink title="Updates" path="/projects/setup/project-update" />
          </div>
        </div>

      </div>
    </div>
  );
}
