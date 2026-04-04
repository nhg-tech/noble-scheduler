import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { formatShiftTime } from '../../utils/scheduling';
import { computeRoleSpan } from '../../utils/calculations';
import { useScheduler } from '../../context/SchedulerContext';

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

export default function GridHeader({
  onAddColumn,
  colWidth,
  onColWidthChange,
  employeeAssignments = {},
  onClearEmployeeAssignment,
  isReadOnly = false,
}) {
  const { schedule, extraRoles, setExtraRoles, columnOrder, setColumnOrder, getEffectiveRoles, getDeletedRoles, hiddenColumns, hideColumn, getTaskDefault, taskLibrary } = useScheduler();
  const [dragRoleId, setDragRoleId] = useState(null);
  const isDraggingRef  = useRef(false);
  const dragIdRef      = useRef(null);
  const resizeRef      = useRef({ active: false, startX: 0, startWidth: 120 });

  const effectiveRoles = getEffectiveRoles();
  // Include soft-deleted roles still referenced in columnOrder (from saved schedules/drafts)
  const deletedInOrder = getDeletedRoles().filter(r => columnOrder.includes(r.id));
  const allRolesBase = [...effectiveRoles, ...deletedInOrder, ...extraRoles];
  // Only show roles in columnOrder that are not session-hidden
  const orderedRoles = columnOrder
    .map(id => allRolesBase.find(r => r.id === id))
    .filter(Boolean)
    .filter(r => !hiddenColumns.has(r.id));

  // Delegate to shared utility — single source of truth for span calculation.
  // Pass allRolesBase so computeRoleSpan can detect overnight roles from config
  // rather than guessing from task positions (fixes ON shift span display).
  function getRoleRange(roleId) {
    return computeRoleSpan(roleId, schedule, taskLibrary, getTaskDefault, allRolesBase);
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

  // ── Column resize — drag right edge of any header to resize ALL columns ───
  function handleResizePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { active: true, startX: e.clientX, startWidth: colWidth };

    function onMove(ev) {
      if (!resizeRef.current.active) return;
      const delta    = ev.clientX - resizeRef.current.startX;
      const newWidth = Math.max(80, Math.min(320, resizeRef.current.startWidth + delta));
      onColWidthChange(newWidth);
    }
    function onUp() {
      resizeRef.current.active = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
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
        const assignment = employeeAssignments[role.id];
        return (
          <div
            key={role.id}
            onPointerEnter={() => handleColumnPointerEnter(role.id)}
            style={{
              width: colWidth, minWidth: colWidth, flexShrink: 0,
              padding: '6px 8px',
              borderRight: '1px solid var(--gray-light)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              opacity: isDragging ? 0.4 : 1,
              background: isDragging ? 'var(--purple-pale)' : role.deleted ? '#fff0f0' : 'var(--cream)',
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
              fontSize: 12, color: role.deleted ? 'var(--red, #c0392b)' : 'var(--dark)',
              letterSpacing: '0.02em', textDecoration: role.deleted ? 'line-through' : 'none',
            }}>{role.label}</div>
            {role.deleted && (
              <div style={{ fontSize: 9, color: 'var(--red, #c0392b)', fontWeight: 700,
                letterSpacing: '0.06em', marginTop: 1 }}>DELETED</div>
            )}

            <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 1 }}>{role.sub}</div>

            {/* Shift window + hours from Role Config */}
            {(role.shiftStart != null && role.shiftEnd != null) && (
              <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 1 }}>
                {fmtShift(role.shiftStart)}–{fmtShift(role.shiftEnd)}
                {role.hours != null && (
                  <span style={{ opacity: 0.75 }}>
                    /{role.hours}h
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
                return `${formatShiftTime(range.startMin / 60)}–${formatShiftTime(range.endMin / 60)}/${hStr}`;
              })() : '–'}
            </div>

            <StaffAssignmentDropZone
              roleId={role.id}
              assignment={assignment}
              onClear={onClearEmployeeAssignment}
              disabled={isReadOnly}
            />

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

            {/* Resize handle — drag to resize all columns simultaneously */}
            <div
              onPointerDown={handleResizePointerDown}
              title="Drag to resize columns"
              style={{
                position: 'absolute', top: 0, right: -3, bottom: 0,
                width: 6, cursor: 'col-resize', zIndex: 10,
              }}
            />
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

function StaffAssignmentDropZone({ roleId, assignment, onClear, disabled }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `staff-column-${roleId}`,
    data: { type: 'staff-column', roleId },
    disabled,
  });
  const fullName = assignment
    ? `${assignment.firstName || ''} ${assignment.lastName || ''}`.trim() || 'Assigned employee'
    : '';

  return (
    <div
      ref={setNodeRef}
      style={{
        width: '100%',
        minHeight: 38,
        marginTop: 8,
        borderRadius: 8,
        border: `1.5px dashed ${isOver ? 'var(--purple)' : 'var(--gray-light)'}`,
        background: isOver ? 'var(--purple-pale)' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: assignment ? '6px 8px' : '8px 6px',
        boxSizing: 'border-box',
        transition: 'all 0.12s',
      }}
    >
      {assignment ? (
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--purple)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {fullName}
            </div>
            <div style={{ fontSize: 9, color: 'var(--gray)', marginTop: 2 }}>
              {assignment.role || assignment.employeeCode || 'Assigned'}
            </div>
          </div>
          {!disabled && (
            <button
              onClick={() => onClear?.(roleId)}
              title="Remove employee assignment"
              style={{
                background: 'none',
                border: 'none',
                color: '#b0adc8',
                fontSize: 11,
                lineHeight: 1,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: isOver ? 'var(--purple)' : 'var(--gray)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Drop Employee
        </div>
      )}
    </div>
  );
}
