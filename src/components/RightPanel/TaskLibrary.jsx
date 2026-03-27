import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TASK_LIBRARY } from '../../data/taskLibrary';
import { useScheduler } from '../../context/SchedulerContext';
import { getSchedulingStatus } from '../../utils/calculations';
import { resolveBlockHex, resolveBlockText } from '../../data/palette';
import { ROLES } from '../../data/roles';

export default function TaskLibrary({ onCreateCustom }) {
  const [filter, setFilter] = useState('pending'); // 'pending' | 'all'
  // undefined entries treated as true — so any new/future category is expanded by default
  const [expanded, setExpanded] = useState({});
  const { schedule, assumptions, getDerivedValues, userTaskDefs, sessionTaskDefs,
          extraRoles, getFullCatList, taskOrder, skippedTasks, toggleSkipTask } = useScheduler();
  const { scCount, totalRooms } = getDerivedValues();
  const { socpg, selpg } = assumptions;

  // Total employee columns = built-in TM/TL/PAW roles + any extra columns added by user
  const baseRoleCount = ROLES.filter(r => r.type === 'TM' || r.type === 'TL' || r.type === 'PAW').length;
  const totalRoleCount = baseRoleCount + (extraRoles?.length || 0);

  // Full cat list for label lookup; active-only for display
  const fullCatList = getFullCatList();
  const activeCats  = fullCatList.filter(c => !c.deleted);
  const catLabelMap = Object.fromEntries(fullCatList.map(c => [c.id, c.deleted ? `${c.label} – Deleted` : c.label]));

  // undefined = expanded (true by default); explicit false = collapsed
  function isCatExpanded(catId) { return expanded[catId] !== false; }

  function toggleCat(catId) {
    setExpanded(prev => ({ ...prev, [catId]: !isCatExpanded(catId) }));
  }

  function toggleAll() {
    const anyCollapsed = activeCats.some(c => expanded[c.id] === false);
    if (anyCollapsed) {
      // expand all
      setExpanded({});
    } else {
      // collapse all
      const all = {};
      activeCats.forEach(c => { all[c.id] = false; });
      setExpanded(all);
    }
  }

  // Build ordered task list per category
  function getOrderedTasksForCat(catId) {
    const libTasks = TASK_LIBRARY.filter(t => {
      const effectiveCat = userTaskDefs[t.id]?.cat || t.cat;
      return effectiveCat === catId && !userTaskDefs[t.id]?.hidden;
    });
    // Custom tasks come from session only — not the persistent library
    const customTasks = Object.values(sessionTaskDefs).filter(t => (t.cat || '') === catId);
    const all = [...libTasks, ...customTasks];
    const order = taskOrder[catId] || [];
    const byId = Object.fromEntries(all.map(t => [t.id, t]));
    const ordered = order.map(id => byId[id]).filter(Boolean);
    const rest = all.filter(t => !order.includes(t.id));
    return [...ordered, ...rest];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--gray-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 15, fontWeight: 700,
            color: 'var(--purple)', letterSpacing: '0.02em',
          }}>Task Library</div>
          <button
            onClick={toggleAll}
            title={activeCats.some(c => expanded[c.id] === false) ? 'Expand all' : 'Collapse all'}
            style={{
              background: 'none', border: '1px solid var(--gray-light)', borderRadius: 4,
              cursor: 'pointer', padding: '2px 6px', fontSize: 11, color: 'var(--gray)',
              lineHeight: 1, fontFamily: "'DM Sans', sans-serif",
            }}
          >{activeCats.some(c => expanded[c.id] === false) ? '⊞' : '⊟'}</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['pending', 'all', 'skipped'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                padding: '4px 0',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                background: filter === f ? 'var(--purple)' : 'var(--gray-light)',
                color: filter === f ? '#fff' : 'var(--gray)',
                transition: 'all 0.15s',
              }}
            >
              {f === 'pending' ? 'Pending' : f === 'all' ? 'All Tasks' : 'Skipped'}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {activeCats.map(cat => {
          const allTasks = getOrderedTasksForCat(cat.id);
          const visibleTasks = filter === 'pending'
            ? allTasks.filter(t => {
                if (skippedTasks.has(t.id)) return false;
                const { done } = getSchedulingStatus(t, schedule, socpg, selpg, scCount, totalRoleCount, userTaskDefs);
                return !done;
              })
            : filter === 'skipped'
            ? allTasks.filter(t => skippedTasks.has(t.id))
            : allTasks;

          if (visibleTasks.length === 0) return null;

          return (
            <div key={cat.id}>
              <div
                onClick={() => toggleCat(cat.id)}
                style={{
                  padding: '5px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: 'var(--gray-light)',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--gray)',
                }}>{cat.label}</span>
                <span style={{ fontSize: 10, color: 'var(--gray)' }}>
                  {isCatExpanded(cat.id) ? '▲' : '▼'}
                </span>
              </div>

              {isCatExpanded(cat.id) && visibleTasks.map(task => (
                <TaskChip
                  key={task.id}
                  task={task}
                  schedule={schedule}
                  socpg={socpg}
                  selpg={selpg}
                  scCount={scCount}
                  userTaskDefs={userTaskDefs}
                  totalRoleCount={totalRoleCount}
                  filter={filter}
                  skippedTasks={skippedTasks}
                  toggleSkipTask={toggleSkipTask}
                />
              ))}
            </div>
          );
        })}

        {/* Create custom task */}
        <div style={{ padding: '10px 14px' }}>
          <button
            onClick={onCreateCustom}
            style={{
              width: '100%',
              padding: '7px',
              borderRadius: 6,
              border: '1.5px dashed var(--purple-light)',
              background: 'transparent',
              color: 'var(--purple)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--purple-pale)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            + Custom Task
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskChip({ task, schedule, socpg, selpg, scCount, userTaskDefs, totalRoleCount, filter, skippedTasks, toggleSkipTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${task.id}`,
    data: { type: 'chip', task },
  });

  const { scheduled, expected, done, partial } = getSchedulingStatus(task, schedule, socpg, selpg, scCount, totalRoleCount, userTaskDefs);
  const override = userTaskDefs[task.id];
  // Chip color uses the user's Task Defaults override color if set, otherwise the library default
  const bgHex = resolveBlockHex(override?.color || task.color);
  const textCol = resolveBlockText(bgHex);

  let statusDot = null;
  if (done) statusDot = '#4CAF50';
  else if (partial) statusDot = '#FF9800';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        margin: '3px 14px',
        padding: '6px 10px',
        borderRadius: 6,
        background: bgHex,
        color: textCol,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : done ? 0.55 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'opacity 0.15s',
        userSelect: 'none',
      }}
    >
      {statusDot && (
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: statusDot,
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.5)',
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'DM Mono', monospace",
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{override?.code || task.code}</div>
        <div style={{
          fontSize: 9,
          opacity: 0.8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{task.name}</div>
      </div>
      <div style={{
        fontSize: 9,
        fontFamily: "'DM Mono', monospace",
        opacity: 0.75,
        flexShrink: 0,
      }}>
        {scheduled}/{expected}
      </div>
      {filter !== 'skipped' ? (
        <button
          onClick={e => { e.stopPropagation(); toggleSkipTask(task.id); }}
          title="Mark as Not Needed"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: 'inherit', opacity: 0.6,
            fontSize: 13, padding: '0 2px', lineHeight: 1,
          }}
        >✕</button>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); toggleSkipTask(task.id); }}
          title="Mark as Needed"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: 'inherit', opacity: 0.6,
            fontSize: 11, padding: '0 2px', lineHeight: 1,
          }}
        >↩</button>
      )}
    </div>
  );
}
