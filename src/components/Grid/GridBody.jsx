import { useMemo, useState } from 'react';
import { TIME_SLOTS } from '../../data/roles';
import { GRID_SLOT_MINUTES, inShift, slotStartMin, keyToRoleAndMin } from '../../utils/scheduling';
import { formatMin } from '../../utils/scheduling';
import GridCell from './GridCell';
import TaskBlock from './TaskBlock';
import GridHeader from './GridHeader';
import { useScheduler } from '../../context/SchedulerContext';

const TIME_COL_W = 52;
const SLOT_H = 22; // 15-min slot height — keeps same px/min density as the old 44px/30min

export default function GridBody({ schedule, onEdit, onRemove, onSplit, onResize, onCopy, onPasteAt, hasClipboard, onCreateHere, onAddColumn }) {
  const { extraRoles, columnOrder, getEffectiveRoles, getDeletedRoles, userTaskDefs, hiddenColumns, taskLibrary, colWidth, setColWidth } = useScheduler();
  const effectiveRoles = getEffectiveRoles();
  // Include soft-deleted roles still referenced in columnOrder (from saved schedules/drafts)
  const deletedInOrder = getDeletedRoles().filter(r => columnOrder.includes(r.id));
  const allRolesBase = [...effectiveRoles, ...deletedInOrder, ...extraRoles];
  // Only render columns in columnOrder that are not session-hidden
  const allRoles = columnOrder
    .map(id => allRolesBase.find(r => r.id === id))
    .filter(Boolean)
    .filter(r => !hiddenColumns.has(r.id));
  // contextMenu: { type:'block', x, y, blockKey } | { type:'cell', x, y, roleId, slotMin }
  const [contextMenu, setContextMenu] = useState(null);

  // Build a map: roleId -> list of { blockKey, task, slotMin } rendered in that column
  const blocksByRole = useMemo(() => {
    const map = {};
    allRoles.forEach(r => { map[r.id] = []; });
    Object.entries(schedule).forEach(([blockKey, task]) => {
      const { roleId, startMin } = keyToRoleAndMin(blockKey);
      if (!map[roleId]) return;
      // Resolve display code from userTaskDefs — use stored taskId, fall back to taskLibrary lookup by code
      const libTask = task.taskId
        ? taskLibrary.find(t => t.id === task.taskId)
        : taskLibrary.find(t => t.code === task.code);
      const override = libTask ? (userTaskDefs[libTask.id] || {}) : {};
      const resolvedCode = override.code ?? task.code;
      const resolvedTask = resolvedCode !== task.code ? { ...task, code: resolvedCode } : task;
      map[roleId].push({ blockKey, task: resolvedTask, startMin });
    });
    return map;
  }, [schedule, allRoles, userTaskDefs]);

  function handleBlockContextMenu(e, blockKey) {
    e.preventDefault();
    e.stopPropagation(); // prevent cell handler from also firing
    setContextMenu({ type: 'block', x: e.clientX, y: e.clientY, blockKey });
  }

  function handleCellContextMenu(e, roleId, slotMin) {
    // Only show if the click wasn't on a task block (stopPropagation handles that)
    setContextMenu({ type: 'cell', x: e.clientX, y: e.clientY, roleId, slotMin });
  }

  function closeMenu() { setContextMenu(null); }

  return (
    <div
      style={{ display: 'flex', flex: 1, overflow: 'auto', flexDirection: 'column' }}
      onClick={closeMenu}
    >
      {/* Column headers — sticky at top of the scroll container */}
      <GridHeader onAddColumn={onAddColumn} colWidth={colWidth} onColWidthChange={setColWidth} />

      {/* Grid rows */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>

      {/* Time gutter */}
      <div style={{
        width: TIME_COL_W,
        minWidth: TIME_COL_W,
        flexShrink: 0,
        borderRight: '1px solid var(--gray-light)',
        background: 'var(--cream)',
        position: 'sticky',
        left: 0,
        zIndex: 20,
      }}>
        {TIME_SLOTS.map((slot, idx) => {
          const isHour = slot.min === 0;
          const isMidnight = slot.isMidnight;
          return (
            <div
              key={idx}
              style={{
                height: SLOT_H,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
                paddingRight: 6,
                paddingTop: isMidnight ? 2 : 3,
                borderBottom: isMidnight
                  ? '2px solid var(--purple)'
                  : '1px solid var(--gray-light)',
                borderTop: isMidnight ? '2px solid var(--purple)' : undefined,
                boxSizing: 'border-box',
                background: isMidnight ? 'rgba(62,42,126,0.04)' : undefined,
              }}
            >
              {isHour && (
                <span style={{
                  fontSize: 9,
                  fontFamily: "'DM Mono', monospace",
                  color: isMidnight ? 'var(--purple)' : 'var(--gray)',
                  fontWeight: isMidnight ? 700 : 400,
                  letterSpacing: '-0.02em',
                }}>
                  {isMidnight ? 'MID' : formatMin(slot.hour * 60 + slot.min)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Role columns */}
      {allRoles.map(role => {
        const blocks = blocksByRole[role.id] || [];

        return (
          <div
            key={role.id}
            style={{
              width: colWidth,
              minWidth: colWidth,
              flexShrink: 0,
              borderRight: '1px solid var(--gray-light)',
              position: 'relative',
            }}
          >
            {TIME_SLOTS.map((slot, slotIdx) => {
              const slotMin = slot.hour * 60 + slot.min;
              const isInShiftVal = inShift(role, slotIdx);

              return (
                <GridCell
                  key={slotIdx}
                  roleId={role.id}
                  slotIdx={slotIdx}
                  slotMin={slotMin}
                  isInShift={isInShiftVal}
                  isMidnight={slot.isMidnight}
                  onContextMenu={handleCellContextMenu}
                />
              );
            })}

            {/* Task blocks rendered in absolute position over cells */}
            {blocks.map(({ blockKey, task, startMin }) => {
              // Find which slot this block starts in
              const slotIdx = TIME_SLOTS.findIndex(
                s => s.hour * 60 + s.min === Math.floor(startMin / GRID_SLOT_MINUTES) * GRID_SLOT_MINUTES
              );
              const slotMin = slotIdx >= 0 ? TIME_SLOTS[slotIdx].hour * 60 + TIME_SLOTS[slotIdx].min : startMin;

              return (
                <div
                  key={blockKey}
                  className="task-block"
                  onContextMenu={(e) => handleBlockContextMenu(e, blockKey)}
                  style={{ position: 'absolute', left: 0, right: 0, top: slotIdx * SLOT_H, zIndex: 10 }}
                >
                  <TaskBlock
                    blockKey={blockKey}
                    task={task}
                    slotMin={slotMin}
                    onEdit={onEdit}
                    onRemove={onRemove}
                    onSplit={onSplit}
                    onResize={onResize}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

        {/* 32px spacer matches the + button width in GridHeader to keep columns aligned */}
        <div style={{ width: 32, minWidth: 32, flexShrink: 0 }} />

      </div>{/* end grid rows */}

      {/* Context menu — block variant */}
      {contextMenu?.type === 'block' && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid var(--gray-light)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            minWidth: 160,
            padding: '4px 0',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
          }}
          onClick={e => e.stopPropagation()}
        >
          <MenuItem onClick={() => { onEdit(contextMenu.blockKey); closeMenu(); }}>✏️ Edit</MenuItem>
          <MenuItem onClick={() => { onSplit(contextMenu.blockKey); closeMenu(); }}>✂️ Split</MenuItem>
          <MenuItem onClick={() => { onCopy?.(contextMenu.blockKey); closeMenu(); }}>📋 Copy</MenuItem>
          <MenuItem onClick={() => { onRemove(contextMenu.blockKey); closeMenu(); }} danger>🗑 Remove</MenuItem>
        </div>
      )}

      {/* Context menu — empty cell variant */}
      {contextMenu?.type === 'cell' && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid var(--gray-light)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            minWidth: 160,
            padding: '4px 0',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
          }}
          onClick={e => e.stopPropagation()}
        >
          <MenuItem onClick={() => { onCreateHere?.(contextMenu.roleId, contextMenu.slotMin); closeMenu(); }}>
            ✏️ Create custom task
          </MenuItem>
          <MenuItem onClick={() => { onAddColumn?.(); closeMenu(); }}>
            ➕ Add column
          </MenuItem>
          {hasClipboard && (
            <MenuItem onClick={() => { onPasteAt?.(contextMenu.roleId, contextMenu.slotMin); closeMenu(); }}>
              📋 Paste
            </MenuItem>
          )}
        </div>
      )}

      {/* Global hover rule for delete button */}
      <style>{`
        .task-block:hover .block-del { display: flex !important; }
      `}</style>
    </div>
  );
}

function MenuItem({ children, onClick, danger, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '7px 14px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--gray)' : danger ? '#FF5252' : 'var(--dark)',
        opacity: disabled ? 0.55 : 1,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--gray-light)'; }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  );
}
