import React, { useEffect, useRef, useState } from 'react';
import { List, LayoutGrid, ChevronDown, Check, Rows3 } from 'lucide-react';

const button = { backgroundColor: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', color: 'var(--text-muted, #4b5563)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'inherit' };
const menu = { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, minWidth: '200px', background: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '6px', color: 'var(--text-color, #1a1a1a)' };
const item = (active) => ({ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', border: 'none', borderRadius: '6px', background: active ? 'var(--surface-gray-2, #f3f4f6)' : 'transparent', color: 'inherit', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontWeight: active ? 600 : 400 });

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, ref };
}

/**
 * Left side of the list toolbar:
 *  - a "List View / Kanban View" dropdown
 *  - in kanban view, a pipeline picker next to it (the pipeline is the field the board is grouped by)
 */
export default function ViewMenu({ view, setView, pipelines, pipeline, setPipeline }) {
  const views = useDropdown();
  const pipes = useDropdown();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div ref={views.ref} style={{ position: 'relative' }}>
        <button type="button" aria-haspopup="menu" aria-expanded={views.open} onClick={() => views.setOpen(!views.open)} style={{ ...button, color: 'var(--text-color, #1a1a1a)', fontWeight: 500 }}>
          {view === 'kanban' ? <LayoutGrid size={14} /> : <List size={14} />} {view === 'kanban' ? 'Kanban View' : 'List View'}
          <ChevronDown size={14} style={{ color: 'var(--text-muted, #9ca3af)' }} />
        </button>
        {views.open && (
          <div role="menu" style={menu}>
            <button type="button" role="menuitem" style={item(view === 'list')} onClick={() => { setView('list'); views.setOpen(false); }}>
              <List size={14} /> List View {view === 'list' && <Check size={14} style={{ marginLeft: 'auto' }} />}
            </button>
            <button type="button" role="menuitem" style={item(view === 'kanban')} onClick={() => { setView('kanban'); views.setOpen(false); }}>
              <LayoutGrid size={14} /> Kanban View {view === 'kanban' && <Check size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          </div>
        )}
      </div>

      {view === 'kanban' ? (
        <div ref={pipes.ref} style={{ position: 'relative' }}>
          <button type="button" aria-haspopup="dialog" aria-expanded={pipes.open} aria-label="Select pipeline" onClick={() => pipes.setOpen(!pipes.open)} style={{ ...button, color: 'var(--text-color, #1a1a1a)' }}>
            <Rows3 size={14} /> Pipeline: <strong style={{ fontWeight: 600 }}>{pipeline.label}</strong>
            <ChevronDown size={14} style={{ color: 'var(--text-muted, #9ca3af)' }} />
          </button>
          {pipes.open && (
            <div role="dialog" aria-label="Pipeline" style={{ ...menu, minWidth: '230px' }}>
              <div style={{ padding: '4px 10px 8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #6b7280)' }}>Group cards by</div>
              {pipelines.map((p) => (
                <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === pipeline.id} style={item(p.id === pipeline.id)} onClick={() => { setPipeline(p.id); pipes.setOpen(false); }}>
                  {p.label} {p.id === pipeline.id && <Check size={14} style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
              <div style={{ padding: '8px 10px 4px', fontSize: '11px', color: 'var(--text-muted, #6b7280)', borderTop: '1px solid var(--border-color, #e5e7eb)', marginTop: '6px' }}>
                Dragging a card to another column changes that field.
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
