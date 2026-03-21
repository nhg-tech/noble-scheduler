import { useState, useRef } from 'react';
import { ROLES } from '../../data/roles';
import { formatShiftTime, keyToRoleAndMin } from '../../utils/scheduling';
import { useScheduler } from '../../context/SchedulerContext';

const ROLE_COL_W = 120;
const TIME_COL_W = 52;

function arrayMove(arr, from, to) {
  const next = [...arr];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export default function GridHeader() {
  const { schedule, extraRoles, setExtraRoles, columnOrder, setColumnOrder } = useScheduler();
  const [showAdd, setShowAdd]   = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSub, setNewSub]     = useState('');
  const [dragRoleId, setDragRoleId] = useState(null);
  const isDraggingRef  = useRef(false);
  const dragIdRef      = useRef(null);

  const allRolesBase = [...ROLES, ...extraRoles];
  const orderedRoles = [
    ...columnOrder.map(id => allRolesBase.find(r => r.id === id)).filter(Boolean),
    ...allRolesBase.filter(r => !columnOrder.includes(r.id)),
  ];

  function getRoleRange(roleId) {
    let minStart = Infinity, maxEnd = -Infinity;
    Object.entries(schedule).forEach(([key, task]) => {
      const { roleId: rid, startMin } = keyToRoleAndMin(key);
      if (rid !== roleId) return;
      const dur = task.durationMin ?? task.slots * 30;
      minStart = Math.min(minStart, startMin);
      maxEnd   = Math.max(maxEnd, startMin + dur);
    });
    if (minStart === Infinity) return null;
    return { startMin: minStart, endMin: maxEnd };
  }

  // ── Custom pointer-based column drag (no nested DndContext) ──────────────
  function handleGripPointerDown(e, roleId) {
    e.stopPropagation(); // prevent outer dnd-kit sensor from activating
    e.preventDefault();
    isDraggingRef.current = true;
    dragIdRef.current = roleId;
    setDragRoleId(roleId);

    function onPointerUp() {
      isDraggingRef.current = false;
      dragIdRef.current = null;
      setDragRoleId(null);
      document.removeEventListener('pointerup', onPointerUp);
    }
    document.addEventListener('pointerup', onPointerUp);
  }

  function handleColumnPointerEnter(roleId) {
    if (!isDraggingRef.current || !dragIdRef.current) return;
    const draggingId = dragIdRef.current;
    if (draggingId === roleId) return;

    setColumnOrder(prev => {
      const from = prev.indexOf(draggingId);
      const to   = prev.indexOf(roleId);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  // ── Add / remove extra columns ───────────────────────────────────────────
  function handleAddRole() {
    if (!newLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    setExtraRoles(prev => [...prev, {
      id, label: newLabel.trim(), sub: newSub.trim() || 'TM',
      type: 'TM', shiftStart: 5, shiftEnd: 22, hours: 8, custom: true,
    }]);
    setColumnOrder(prev => [...prev, id]);
    setNewLabel(''); setNewSub(''); setShowAdd(false);
  }

  function handleRemoveRole(id) {
    setExtraRoles(prev => prev.filter(r => r.id !== id));
    setColumnOrder(prev => prev.filter(x => x !== id));
  }

  return (
    <div style={{
      display: 'flex', position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--cream)', borderBottom: '2px solid var(--gray-light)',
      flexShrink: 0,
    }}>
      {/* Time gutter header */}
      <div style={{
        width: TIME_COL_W, minWidth: TIME_COL_W,
        borderRight: '1px solid var(--gray-light)',
        background: 'var(--cream)', flexShrink: 0,
        position: 'sticky', left: 0, zIndex: 51,
      }} />

      {/* Role columns */}
      {orderedRoles.map(role => {
        const range = getRoleRange(role.id);
        const isDragging = dragRoleId === role.id;
        return (
          <div
            key={role.id}
            onPointerEnter={() => handleColumnPointerEnter(role.id)}
            style={{
              flex: '1 0 0', minWidth: ROLE_COL_W, padding: '6px 8px',
              borderRight: '1px solid var(--gray-light)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              opacity: isDragging ? 0.4 : 1,
              background: isDragging ? 'var(--purple-pale)' : 'var(--cream)',
              transition: 'background 0.1s, opacity 0.1s',
              userSelect: 'none',
            }}
          >
            {/* Drag grip */}
            <div
              onPointerDown={e => handleGripPointerDown(e, role.id)}
              title="Drag to reorder"
              style={{
                position: 'absolute', top: 3, left: 3,
                cursor: isDragging ? 'grabbing' : 'grab',
                color: 'var(--gray-light)',
                fontSize: 11, lineHeight: 1, padding: '1px 2px', borderRadius: 3,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--purple)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-light)'}
            >⠿</div>

            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              fontSize: 12, color: 'var(--dark)', letterSpacing: '0.02em',
            }}>{role.label}</div>

            <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 1 }}>{role.sub}</div>

            <div style={{
              fontSize: 9, marginTop: 1,
              fontFamily: "'DM Mono', monospace",
              color: range ? 'var(--purple)' : 'var(--gray-light)',
            }}>
              {range
                ? `${formatShiftTime(range.startMin / 60)}–${formatShiftTime(range.endMin / 60)}`
                : '–'}
            </div>

            {role.custom && (
              <button
                onClick={() => handleRemoveRole(role.id)}
                title="Remove column"
                style={{
                  position: 'absolute', top: 3, right: 3,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 9, color: 'var(--gray)', padding: '1px 3px',
                  lineHeight: 1, borderRadius: 3,
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#FF5252'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--gray)'}
              >✕</button>
            )}
          </div>
        );
      })}

      {/* Add column button + popover */}
      <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0, position: 'relative' }}>
        <button
          onClick={() => setShowAdd(v => !v)}
          title="Add column"
          style={{
            width: 32, border: 'none',
            borderRight: '1px solid var(--gray-light)',
            background: showAdd ? 'var(--purple-pale)' : 'transparent',
            cursor: 'pointer', color: 'var(--purple)',
            fontSize: 20, fontWeight: 300, lineHeight: 1,
          }}
        >+</button>

        {showAdd && (
          <div style={{
            position: 'absolute', top: '100%', right: 0,
            background: '#fff', border: '1px solid var(--gray-light)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: 12, zIndex: 200, minWidth: 190,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--gray)',
              marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>Add Column</div>
            <input
              value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (e.g. SOC 3)" maxLength={12} autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddRole()}
              style={popInputStyle}
            />
            <input
              value={newSub} onChange={e => setNewSub(e.target.value)}
              placeholder="Sub-text (e.g. TM)" maxLength={18}
              onKeyDown={e => e.key === 'Enter' && handleAddRole()}
              style={{ ...popInputStyle, marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setShowAdd(false); setNewLabel(''); setNewSub(''); }}
                style={popBtnStyle(false)}
              >Cancel</button>
              <button
                onClick={handleAddRole} disabled={!newLabel.trim()}
                style={popBtnStyle(true, !newLabel.trim())}
              >Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const popInputStyle = {
  width: '100%', padding: '6px 8px',
  border: '1px solid var(--gray-light)', borderRadius: 5,
  fontSize: 12, fontFamily: "'DM Sans', sans-serif",
  marginBottom: 6, boxSizing: 'border-box', outline: 'none',
};

function popBtnStyle(primary, disabled) {
  return {
    flex: 1, padding: '6px 8px', border: 'none', borderRadius: 5,
    background: primary && !disabled ? 'var(--purple)' : 'var(--gray-light)',
    color: primary && !disabled ? '#fff' : 'var(--gray)',
    cursor: primary && !disabled ? 'pointer' : 'default',
    fontSize: 11, fontWeight: primary ? 600 : 400,
    fontFamily: "'DM Sans', sans-serif",
  };
}
