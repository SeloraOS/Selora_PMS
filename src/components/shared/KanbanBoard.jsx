/**
 * Generic drag-and-drop kanban board.
 *
 * columns:   [{ id, label, color }]
 * items:     records to show (already filtered/sorted by the page)
 * getColumn: item -> column id (items whose column is not listed get their own trailing column)
 * getId:     item -> stable id (the document code)
 * onMove:    (item, columnId) => Promise; resolve null/false to signal failure (the card snaps back)
 * renderCard:(item) => node
 */
import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function KanbanBoard({ columns, items, getColumn, getId, onMove, onOpen, renderCard, canMove = () => true }) {
  // Optimistic placement: id -> column, dropped as soon as the real data catches up (or the move fails)
  const [moved, setMoved] = useState({});

  useEffect(() => {
    setMoved((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of items) {
        const id = getId(item);
        if (id in next && getColumn(item) === next[id]) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [items, getColumn, getId]);

  const columnOf = (item) => moved[getId(item)] ?? getColumn(item);

  const allColumns = useMemo(() => {
    const known = new Set(columns.map((c) => c.id));
    const extra = [...new Set(items.map(getColumn))].filter((id) => id && !known.has(id)).map((id) => ({ id, label: id, color: '#9ca3af' }));
    return [...columns, ...extra];
  }, [columns, items, getColumn]);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(allColumns.map((c) => [c.id, []]));
    for (const item of items) (map[moved[getId(item)] ?? getColumn(item)] ||= []).push(item);
    return map;
  }, [allColumns, items, moved, getColumn, getId]);

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const item = items.find((i) => getId(i) === draggableId);
    if (!item) return;
    const to = destination.droppableId;
    setMoved((m) => ({ ...m, [draggableId]: to }));
    const result = await onMove(item, to);
    if (!result) setMoved((m) => { const { [draggableId]: _gone, ...rest } = m; return rest; }); // failed: snap back
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* No overflow here on purpose: the page's <main> is the single scroll container (required by @hello-pangea/dnd) */}
      <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', alignItems: 'flex-start', width: 'max-content', minWidth: '100%', boxSizing: 'border-box' }}>
        {allColumns.map((col) => {
          const cards = byColumn[col.id] || [];
          return (
            <div key={col.id} data-testid={`kanban-col-${col.id}`} style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', background: 'var(--surface-gray-1, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-color, #1a1a1a)' }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted, #6b7280)', background: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px', padding: '0 8px' }}>{cards.length}</span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ padding: '8px', minHeight: '60px', flex: 1, background: snapshot.isDraggingOver ? 'var(--surface-gray-2, #f3f4f6)' : 'transparent', transition: 'background 0.1s' }}
                  >
                    {cards.map((item, index) => (
                      <Draggable key={getId(item)} draggableId={getId(item)} index={index} isDragDisabled={!canMove(item)}>
                        {(p, s) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            data-testid={`kanban-card-${getId(item)}`}
                            onClick={() => onOpen && onOpen(item)}
                            style={{ background: 'var(--control-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer', boxShadow: s.isDragging ? '0 6px 16px rgba(0,0,0,0.15)' : 'none', ...p.draggableProps.style }}
                          >
                            {renderCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {cards.length === 0 && !snapshot.isDraggingOver && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #9ca3af)', textAlign: 'center', padding: '12px 0' }}>No items</div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

/** Small colored pill used on cards. */
export function Pill({ children, color = '#6b7280' }) {
  return <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 8px', borderRadius: '10px', color, border: `1px solid ${color}`, whiteSpace: 'nowrap' }}>{children}</span>;
}

export const PRIORITY_COLORS = { Low: '#6b7280', Medium: '#3b82f6', High: '#f59e0b', Urgent: '#ef4444' };
