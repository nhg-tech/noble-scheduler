import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TASK_LIBRARY, CAT_LABELS, CAT_ORDER } from '../../data/taskLibrary';
import { useScheduler } from '../../context/SchedulerContext';
import { getSchedulingStatus } from '../../utils/calculations';
import { resolveBlockHex, resolveBlockText } from '../../data/palette';

export default function TaskLibrary({ onCreateCustom }) {
  const [filter, setFilter] = useState('pending'); // 'pending' | 'all'
  const [expanded, setExpanded] = useState({ group: true, suite: true, meals: true, fixed: true, on: true });
  const { schedule, assumptions, getDerivedValues, userTaskDefs } = useScheduler();
  const { scCount } = getDerivedValues();
  const { socpg, selpg } = assumptions;

  function toggleCat(cat) {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  const tasksByCat = {};
  CAT_ORDER.forEach(cat => { tasksByCat[cat] = []; });
  TASK_LIBRARY.forEach(task => {
    if (tasksByCat[task.cat] && !userTaskDefs[task.id]?.hidden) tasksByCat[task.cat].push(task);
  });
  // Include custom tasks from userTaskDefs
  Object.values(userTaskDefs).forEach(task => {
    if (task.custom && tasksByCat[task.cat]) tasksByCat[task.cat].push(task);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--gray-light)' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--purple)',
          marginBottom: 8,
          letterSpacing: '0.02em',
        }}>Task Library</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['pending', 'all'].map(f => (
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
              {f === 'pending' ? 'Pending' : 'All Tasks'}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {CAT_ORDER.map(cat => {
          const tasks = tasksByCat[cat] || [];
          const visibleTasks = filter === 'pending'
            ? tasks.filter(t => {
                const { done } = getSchedulingStatus(t, schedule, socpg, selpg, scCount);
                return !done;
              })
            : tasks;

          if (visibleTasks.length === 0) return null;

          return (
            <div key={cat}>
              <div
                onClick={() => toggleCat(cat)}
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
                }}>{CAT_LABELS[cat]}</span>
                <span style={{ fontSize: 10, color: 'var(--gray)' }}>
                  {expanded[cat] ? '▲' : '▼'}
                </span>
              </div>

              {expanded[cat] && visibleTasks.map(task => (
                <TaskChip
                  key={task.id}
                  task={task}
                  schedule={schedule}
                  socpg={socpg}
                  selpg={selpg}
                  scCount={scCount}
                  userTaskDefs={userTaskDefs}
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

function TaskChip({ task, schedule, socpg, selpg, scCount, userTaskDefs }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${task.id}`,
    data: { type: 'chip', task },
  });

  const { scheduled, expected: expectedDefault, done, partial } = getSchedulingStatus(task, schedule, socpg, selpg, scCount);
  const override = userTaskDefs[task.id];
  const expected = override?.minResources != null ? override.minResources : expectedDefault;
  const bgHex = resolveBlockHex(task.color);
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
        }}>{task.code}</div>
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
    </div>
  );
}
