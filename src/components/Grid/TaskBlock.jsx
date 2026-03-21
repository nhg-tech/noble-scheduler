import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useRef } from 'react';
import { resolveBlockHex, resolveBlockText } from '../../data/palette';
import { keyToRoleAndMin } from '../../utils/scheduling';

const SLOT_H = 44;

export default function TaskBlock({ blockKey, task, slotMin, onEdit, onRemove, onSplit, onResize }) {
  const { startMin } = keyToRoleAndMin(blockKey);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: blockKey,
    data: { type: 'block', blockKey },
  });

  // Also act as a drop target so chips dropped onto visible blocks trigger conflict detection
  const { roleId, startMin: blockStartMin } = keyToRoleAndMin(blockKey);
  const { setNodeRef: setDropRef } = useDroppable({
    id: `block-over:${blockKey}`,
    data: { type: 'block-over', blockKey, roleId, startMin: blockStartMin },
  });

  const resizeRef      = useRef(null);
  const startYRef      = useRef(null);
  const origDurRef     = useRef(null);

  // Color resolution
  const effectiveColor = task.color || 'block-group';
  const bgHex          = resolveBlockHex(effectiveColor);
  const textCol        = resolveBlockText(effectiveColor);

  const durationMin  = task.durationMin ?? task.slots * 30;
  const offsetInSlot = startMin - slotMin;
  const topPx        = Math.round((offsetInSlot / 30) * SLOT_H) + 2;
  const heightPx     = Math.round((durationMin / 30) * SLOT_H) - 2;

  const overflowStyle = (task.overlap || task.overflow)
    ? 'outline: 2px solid #FF5252; outline-offset: -2px;'
    : '';

  // Resize via mousedown on handle
  function startResizeDrag(e) {
    e.stopPropagation();
    e.preventDefault();
    startYRef.current  = e.clientY;
    origDurRef.current = durationMin;

    function onMove(ev) {
      const dy      = ev.clientY - startYRef.current;
      const addMins = Math.round(dy / (SLOT_H / 30) / 5) * 5;
      const newMins = Math.max(10, origDurRef.current + addMins);
      if (resizeRef.current) resizeRef.current.style.height = `${Math.round((newMins / 30) * SLOT_H) - 2}px`;
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const dy      = ev.clientY - startYRef.current;
      const addMins = Math.round(dy / (SLOT_H / 30) / 5) * 5;
      const newMins = Math.max(10, origDurRef.current + addMins);
      onResize(blockKey, newMins);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Merged block color bar
  let colorBar = null;
  if (task.merged && task.colors && task.constituents) {
    const totalDur = task.constituents.reduce((s, c) => s + c.durationMin, 0);
    colorBar = (
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        display: 'flex', flexDirection: 'column', borderRadius: 5, overflow: 'hidden', pointerEvents: 'none' }}>
        {task.constituents.map((c, i) => {
          const pct  = (c.durationMin / totalDur) * 100;
          const hex  = resolveBlockHex(task.colors?.[i] ?? task.color ?? 'block-group');
          const txt  = resolveBlockText(hex);
          return (
            <div key={i} style={{ flex: `0 0 ${pct}%`, background: hex,
              display: 'flex', alignItems: 'center', padding: '2px 7px', minHeight: 0 }}>
              <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 700,
                color: txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.code}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const codeLabel = task.merged ? null : (
    <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 700, opacity: 1, letterSpacing: '0.02em' }}>
      {task.code}
    </div>
  );

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); resizeRef.current = node; }}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(blockKey)}
      onContextMenu={(e) => { e.preventDefault(); /* handled by wrapper */ }}
      style={{
        position: 'absolute',
        left: 2, right: 2,
        top: `${topPx}px`,
        height: `${heightPx}px`,
        borderRadius: 5,
        padding: '4px 7px',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        background: bgHex,
        color: textCol,
        outline: (task.overlap || task.overflow) ? '2px solid #FF5252' : 'none',
        outlineOffset: '-2px',
        opacity: isDragging ? 0.5 : 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {colorBar}
      {codeLabel}
      {/* Overflow indicator */}
      {task.overflow && (
        <div style={{ position: 'absolute', top: 2, left: 3, width: 6, height: 6,
          borderRadius: '50%', background: '#FF5252' }} />
      )}
      {/* Remove button */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(blockKey); }}
        style={{
          position: 'absolute', top: 2, right: 3, width: 14, height: 14,
          borderRadius: '50%', background: 'rgba(0,0,0,0.15)', color: 'inherit',
          border: 'none', cursor: 'pointer', fontSize: 9,
          display: 'none', alignItems: 'center', justifyContent: 'center',
        }}
        className="block-del"
      >✕</button>
      {/* Resize handle */}
      <div
        onMouseDown={startResizeDrag}
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 10,
          cursor: 'ns-resize', borderRadius: '0 0 5px 5px',
          background: 'rgba(0,0,0,0.12)',
        }}
      />
      <style>{`.task-block:hover .block-del { display: flex !important; }`}</style>
    </div>
  );
}
