import Modal, { ModalFooter, Btn } from './Modal';
import { useScheduler } from '../../context/SchedulerContext';
import { TASK_LIBRARY } from '../../data/taskLibrary';
import { getSchedulingStatus } from '../../utils/calculations';
import { keyToRoleAndMin, formatMin } from '../../utils/scheduling';
import { ROLES } from '../../data/roles';

export default function ValidationModal({ onClose }) {
  const { schedule, assumptions, getDerivedValues, userTaskDefs } = useScheduler();
  const { scCount } = getDerivedValues();
  const { socpg, selpg } = assumptions;

  // Check 1: Missing or under-scheduled tasks
  const taskIssues = TASK_LIBRARY
    .map(task => {
      const { scheduled, expected, done } = getSchedulingStatus(task, schedule, socpg, selpg, scCount, undefined, userTaskDefs);
      if (!done) return { task, scheduled, expected };
      return null;
    })
    .filter(Boolean);

  // Check 2: Overlapping blocks per role
  const overlapIssues = [];
  ROLES.forEach(role => {
    const blocks = Object.entries(schedule)
      .filter(([key]) => keyToRoleAndMin(key).roleId === role.id)
      .map(([key, task]) => {
        const { startMin } = keyToRoleAndMin(key);
        const dur = task.durationMin ?? task.slots * 30;
        return { key, task, startMin, endMin: startMin + dur };
      })
      .sort((a, b) => a.startMin - b.startMin);

    for (let i = 0; i < blocks.length - 1; i++) {
      if (blocks[i].endMin > blocks[i + 1].startMin) {
        overlapIssues.push({
          roleLabel: role.label,
          a: blocks[i],
          b: blocks[i + 1],
        });
      }
    }
  });

  // Check 3: Overflow blocks
  const overflowBlocks = Object.entries(schedule)
    .filter(([, t]) => t.overflow)
    .map(([key, t]) => {
      const { roleId, startMin } = keyToRoleAndMin(key);
      const role = ROLES.find(r => r.id === roleId);
      return { roleLabel: role?.label || roleId, code: t.code, startMin };
    });

  const totalIssues = taskIssues.length + overlapIssues.length + overflowBlocks.length;
  const isValid = totalIssues === 0;

  return (
    <Modal title="Schedule Validation" onClose={onClose} width={500}>
      {isValid ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#4CAF50' }}>Schedule looks good!</div>
          <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 6 }}>
            All required tasks are scheduled and no conflicts detected.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SummaryBar count={totalIssues} />

          {taskIssues.length > 0 && (
            <Section title={`Missing / Under-scheduled Tasks (${taskIssues.length})`} color="#FF9800">
              {taskIssues.map(({ task, scheduled, expected }) => (
                <Issue key={task.id} icon="⚠️">
                  <strong>{task.code}</strong> — {task.name}: {scheduled}/{expected} scheduled
                </Issue>
              ))}
            </Section>
          )}

          {overlapIssues.length > 0 && (
            <Section title={`Overlapping Blocks (${overlapIssues.length})`} color="#FF5252">
              {overlapIssues.map((o, i) => (
                <Issue key={i} icon="⛔">
                  <strong>{o.roleLabel}</strong>: {o.a.task.code} ({formatMin(o.a.startMin)}–{formatMin(o.a.endMin)})
                  {' '}overlaps {o.b.task.code} ({formatMin(o.b.startMin)})
                </Issue>
              ))}
            </Section>
          )}

          {overflowBlocks.length > 0 && (
            <Section title={`Overflow Blocks (${overflowBlocks.length})`} color="#FF5252">
              {overflowBlocks.map((o, i) => (
                <Issue key={i} icon="🔴">
                  <strong>{o.roleLabel}</strong>: {o.code} at {formatMin(o.startMin)} overflows shift
                </Issue>
              ))}
            </Section>
          )}
        </div>
      )}

      <ModalFooter>
        <Btn onClick={onClose} variant="primary">Close</Btn>
      </ModalFooter>
    </Modal>
  );
}

function SummaryBar({ count }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(255,82,82,0.08)',
      borderRadius: 7,
      border: '1px solid rgba(255,82,82,0.2)',
      fontSize: 13,
      fontWeight: 700,
      color: '#FF5252',
    }}>
      {count} issue{count !== 1 ? 's' : ''} found
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function Issue({ icon, children }) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      fontSize: 12,
      padding: '6px 10px',
      background: 'var(--gray-light)',
      borderRadius: 6,
      alignItems: 'flex-start',
      lineHeight: 1.4,
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}
