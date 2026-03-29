import { useState, useRef } from 'react'; // useState kept for dragRoleId
import { formatShiftTime, keyToRoleAndMin } from '../../utils/scheduling';
import { useScheduler } from '../../context/SchedulerContext';

const ROLE_COL_W = 120;
const TIME_COL_W = 52;

function arrayMove(arr, from, to) {
  const next = [...arr];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

// Compact shift-time formatter: 6.5 → "6:30a", 15.0 → "3p", 21.0 → "9p"
function fmtShift(decimal) {
  const total  = ((decimal % 24) + 24) % 24;
  const h24    = Math.floor(total);
  const m      = Math.round((total - h24) * 60);
  const suffix = h24 < 12 ? 'a' : 'p';
  const h12    = h24 % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export default function GridHeader({ onAddColumn }) {
  const { schedule, extraRoles, setExtraRoles, columnOrder, setColumnOrder, getEffectiveRoles, hiddenColumns, hideColumn, getTaskDefault, taskLibrary } = useScheduler();
  const [dragRoleId, setDragRoleId] = useState(null);
  const isDraggingRef  = useRef(false);
  const dragIdRef      = useRef(null);

  const allRolesBase = [...getEffectiveRoles(), ...extraRoles];
  // Only show roles in columnOrder that are not session-hidden
  const orderedRoles = columnOrder
    .map(id => allRolesBase.find(r => r.id === id))
    .filter(Boolean)
    .filter(r => !hiddenColumns.has(r.id));

  function getRoleRange(roleId) {
    let minStart = Infinity, maxEnd = -Infinity, nonCountedMins = 0;
    Object.entries(schedule).forEach(([key, task]) => {
      const { roleId: rid, startMin } = keyToRoleAndMin(key);
      if (rid !== roleId) return;
      const dur = Number(task.durationMin ?? task.slots * 30);
      minStart = Math.min(minStart, startMin);
      maxEnd   = Math.max(maxEnd, startMin + dur);
      // Accumulate durations for tasks that do NOT count toward hours (breaks, lunch, etc.)
      const libTask = taskLibrary.find(t => t.code === task.code || t.id === task.taskId);
      const counts  = libTask ? (getTaskDefault(libTask.id)?.countHours !== false) : true;
      if (!counts) nonCountedMins += dur;
    });
    if (minStart === Infinity) return null;
    return { startMin: minStart, endMin: maxEnd, nonCountedMins };
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

  // ── Hide any column from the current schedule view (session-only) ─────────
  // Built-in/Role Config columns: add to hiddenColumns (transient, resets on reload).
  // Quick-add extraRoles: purge entirely (they have no other home).
  function handleHideColumn(id) {
    if (extraRoles.some(r => r.id === id)) {
      setColumnOrder(prev => prev.filter(x => x !== id));
      setExtraRoles(prev => prev.filter(r => r.id !== id));
    } else {
      hideColumn(id);
    }
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
            {/* Drag grip — slightly darker so it's discoverable */}
            <div
              onPointerDown={e => handleGripPointerDown(e, role.id)}
              title="Drag to reorder"
              style={{
                position: 'absolute', top: 3, left: 3,
                cursor: isDragging ? 'grabbing' : 'grab',
                color: '#b0adc8',
                fontSize: 11, lineHeight: 1, padding: '1px 2px', borderRadius: 3,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--purple)'}
              onMouseLeave={e => e.currentTarget.style.color = '#b0adc8'}
            >⠿</div>

            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              fontSize: 12, color: 'var(--dark)', letterSpacing: '0.02em',
            }}>{role.label}</div>

            <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 1 }}>{role.sub}</div>

            {/* Shift window + hours from Role Config */}
            {(role.shiftStart != null && role.shiftEnd != null) && (
              <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 1 }}>
                {fmtShift(role.shiftStart)}–{fmtShift(role.shiftEnd)}
                {role.hours != null && (
                  <span style={{ marginLeft: 3, opacity: 0.75 }}>
                    / {role.hours}h
                  </span>
                )}
              </div>
            )}

            {/* Actual task span: first task start → last task end, hours exclude countHours:false tasks */}
            <div style={{
              fontSize: 9, marginTop: 1,
              fontFamily: "'DM Mono', monospace",
              color: range ? 'var(--purple)' : 'var(--gray)',
            }}>
              {range ? (() => {
                const spanMins   = range.endMin - range.startMin;
                const countedH   = (spanMins - range.nonCountedMins) / 60;
                const hStr       = countedH % 1 === 0 ? `${countedH}h` : `${countedH.toFixed(1)}h`;
                return `${formatShiftTime(range.startMin / 60)}–${formatShiftTime(range.endMin / 60)} / ${hStr}`;
              })() : '–'}
            </div>

            {/* ✕ shown on every column — hides from this schedule only */}
            <button
              onClick={() => handleHideColumn(role.id)}
              title={extraRoles.some(r => r.id === role.id) ? 'Remove column' : 'Hide column from this schedule'}
              style={{
                position: 'absolute', top: 3, right: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 9, color: '#b0adc8', padding: '1px 3px',
                lineHeight: 1, borderRadius: 3,
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#FF5252'}
              onMouseLeave={e => e.currentTarget.style.color = '#b0adc8'}
            >✕</button>
          </div>
        );
      })}

      {/* Add column button */}
      <button
        onClick={onAddColumn}
        title="Add column"
        style={{
          width: 32, border: 'none', flexShrink: 0,
          borderRight: '1px solid var(--gray-light)',
          background: 'transparent',
          cursor: 'pointer', color: 'var(--purple)',
          fontSize: 20, fontWeight: 300, lineHeight: 1,
        }}
      >+</button>
    </div>
  );
}
