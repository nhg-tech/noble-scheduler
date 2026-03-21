import { useMemo, useState } from 'react';
import { ROLES, TIME_SLOTS } from '../../data/roles';
import { inShift, slotStartMin, keyToRoleAndMin } from '../../utils/scheduling';
import { formatMin } from '../../utils/scheduling';
import GridCell from './GridCell';
import TaskBlock from './TaskBlock';
import GridHeader from './GridHeader';
import { useScheduler } from '../../context/SchedulerContext';

const TIME_COL_W = 52;
const ROLE_COL_W = 120;
const SLOT_H = 44;

export default function GridBody({ schedule, onEdit, onRemove, onSplit, onResize }) {
  const { extraRoles, columnOrder } = useScheduler();
  const allRolesBase = [...ROLES, ...extraRoles];
  const allRoles = [
    ...columnOrder.map(id => allRolesBase.find(r => r.id === id)).filter(Boolean),
    ...allRolesBase.filter(r => !columnOrder.includes(r.id)),
  ];
  const [contextMenu, setContextMenu] = useState(null); // { x, y, blockKey }

  // Build a map: roleId -> list of { blockKey, task, slotMin } rendered in that column
  const blocksByRole = useMemo(() => {
    const map = {};
    allRoles.forEach(r => { map[r.id] = []; });
    Object.entries(schedule).forEach(([blockKey, task]) => {
      const { roleId, startMin } = keyToRoleAndMin(blockKey);
      if (map[roleId]) {
        map[roleId].push({ blockKey, task, startMin });
      }
    });
    return map;
  }, [schedule, allRoles]);

  function handleContextMenu(e, blockKey) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, blockKey });
  }

  function closeMenu() { setContextMenu(null); }

  return (
    <div
      style={{ display: 'flex', flex: 1, overflow: 'auto', flexDirection: 'column' }}
      onClick={closeMenu}
    >
      {/* Column headers — sticky at top of the scroll container */}
      <GridHeader />

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
          return (
            <div
              key={idx}
              style={{
                height: SLOT_H,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
                paddingRight: 6,
                paddingTop: 3,
                borderBottom: '1px solid var(--gray-light)',
                boxSizing: 'border-box',
              }}
            >
              {isHour && (
                <span style={{
                  fontSize: 9,
                  fontFamily: "'DM Mono', monospace",
                  color: 'var(--gray)',
                  letterSpacing: '-0.02em',
                }}>
                  {formatMin(slot.hour * 60 + slot.min)}
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
              flex: '1 0 0',
              minWidth: ROLE_COL_W,
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
                />
              );
            })}

            {/* Task blocks rendered in absolute position over cells */}
            {blocks.map(({ blockKey, task, startMin }) => {
              // Find which slot this block starts in
              const slotIdx = TIME_SLOTS.findIndex(
                s => s.hour * 60 + s.min === Math.floor(startMin / 30) * 30
              );
              const slotMin = slotIdx >= 0 ? TIME_SLOTS[slotIdx].hour * 60 + TIME_SLOTS[slotIdx].min : startMin;

              return (
                <div
                  key={blockKey}
                  className="task-block"
                  onContextMenu={(e) => handleContextMenu(e, blockKey)}
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

      </div>{/* end grid rows */}

      {/* Context menu */}
      {contextMenu && (
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
          <MenuItem onClick={() => { onRemove(contextMenu.blockKey); closeMenu(); }} danger>🗑 Remove</MenuItem>
        </div>
      )}

      {/* Global hover rule for delete button */}
      <style>{`
        .task-block:hover .block-del { display: flex !important; }
      `}</style>
    </div>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 14px',
        cursor: 'pointer',
        color: danger ? '#FF5252' : 'var(--dark)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-light)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  );
}
