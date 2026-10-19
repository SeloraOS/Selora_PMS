import React, { useMemo, useState } from 'react';
import { useProjects } from '../../../context/ProjectsContext';
import { useSetup } from '../../../context/SetupContext';
import { demandLetterHtml, brandedDocument, printDocument } from '../../../lib/exportRows';
import { todayStr } from '../../../lib/reportData';
import { addDays } from '../../../lib/dates';
import { control } from './shared';

const label = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' };

/** Demand letter for a construction-linked payment milestone, printed on the company letterhead (Save as PDF from the print dialog). */
export default function DemandLetter() {
  const { projects } = useProjects();
  const { settings } = useSetup();
  const today = todayStr();
  const [v, setV] = useState({ project: '', customer: '', milestone: '', amount: '', dueOn: addDays(today, 15), reference: '' });
  const [blocked, setBlocked] = useState(false);
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const pick = (name) => { const p = projects.find((x) => x.projectName === name); setV((s) => ({ ...s, project: name, customer: s.customer || p?.customer || '' })); };
  const ready = v.project && v.customer && v.milestone && Number(v.amount) > 0;
  const brand = { company: settings?.company, letterhead: settings?.letterhead, logo: settings?.company_logo };
  const body = useMemo(() => demandLetterHtml({ ...v, amount: Number(v.amount) || 0, today }), [v, today]);
  const doc = brandedDocument({ title: `Demand letter - ${v.milestone}`, bodyHtml: body, brand });

  return (
    <div data-testid="demand-letter" style={{ padding: '20px', color: 'var(--text-color)', fontFamily: 'var(--font-family)', display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: '20px', alignItems: 'start', backgroundColor: 'var(--surface-gray-1)', minHeight: '100%' }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Demand letter</h1>
        <label style={label}>Project<select aria-label="Project" style={control} value={v.project} onChange={(e) => pick(e.target.value)}><option value="">Select…</option>{projects.map((p) => <option key={p.dbId}>{p.projectName}</option>)}</select></label>
        <label style={label}>Customer<input aria-label="Customer" style={control} value={v.customer} onChange={(e) => set('customer', e.target.value)} /></label>
        <label style={label}>Milestone<input aria-label="Milestone" style={control} value={v.milestone} placeholder="e.g. Completion of 10th floor slab" onChange={(e) => set('milestone', e.target.value)} /></label>
        <label style={label}>Amount (₹)<input aria-label="Amount" type="number" min="0" style={control} value={v.amount} onChange={(e) => set('amount', e.target.value)} /></label>
        <label style={label}>Pay by<input aria-label="Pay by" type="date" style={control} value={v.dueOn} onChange={(e) => set('dueOn', e.target.value)} /></label>
        <label style={label}>Reference<input aria-label="Reference" style={control} value={v.reference} onChange={(e) => set('reference', e.target.value)} /></label>
        <button disabled={!ready} onClick={() => setBlocked(!printDocument(doc))} style={{ ...control, background: 'var(--gray-900)', color: '#ffffff', cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6, fontWeight: 600 }}>Print / Save as PDF</button>
        {blocked && <div role="alert" style={{ fontSize: '12px', color: 'var(--st-red-fg)' }}>The browser blocked the print window. Allow pop-ups for this site.</div>}
        {!settings?.letterhead && !settings?.company_logo && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Add a logo and letterhead in Projects Settings > Branding.</div>}
      </div>
      <div style={{ background: '#ffffff', color: '#111111', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '24px', minHeight: '400px' }}>
        <iframe title="Preview" srcDoc={doc} style={{ width: '100%', height: '560px', border: 'none', background: '#ffffff' }} sandbox="" />
      </div>
    </div>
  );
}
