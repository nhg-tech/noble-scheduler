import { useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';
import { TASK_LIBRARY, CAT_LABELS, CAT_ORDER } from '../../data/taskLibrary';
import { useScheduler } from '../../context/SchedulerContext';
import { getSchedulingStatus } from '../../utils/calculations';
import { keyToRoleAndMin, formatMin } from '../../utils/scheduling';
import { ROLES } from '../../data/roles';

export default function ChecklistModal({ onClose }) {
  const { schedule, assumptions } = useScheduler();
  const [checked, setChecked] = useState({});

  function toggle(key) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Group placed blocks by role
  const blocksByRole = {};
  ROLES.forEach(r => { blocksByRole[r.id] = []; });
  Object.entries(schedule).forEach(([key, task]) => {
    const { roleId, startMin } = keyToRoleAndMin(key);
    if (blocksByRole[roleId]) {
      blocksByRole[roleId].push({ key, task, startMin });
    }
  });

  return (
    <Modal title="Daily Checklist" onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {ROLES.map(role => {
          const blocks = blocksByRole[role.id] || [];
          if (blocks.length === 0) return null;
          const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);

          return (
            <div key={role.id}>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--purple)',
                borderBottom: '1px solid var(--gray-light)',
                paddingBottom: 6,
                marginBottom: 8,
              }}>
                {role.label} — {role.sub}
              </div>

              {sorted.map(({ key, task, startMin }) => {
                const dur = task.durationMin ?? task.slots * 30;
                const isChecked = !!checked[key];
                const codes = task.merged ? task.codes : [task.code];

                return (
                  <div
                    key={key}
                    onClick={() => toggle(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '5px 0',
                      cursor: 'pointer',
                      opacity: isChecked ? 0.5 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: '2px solid var(--purple)',
                      background: isChecked ? 'var(--purple)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                      {isChecked && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--dark)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}>
                        {codes.join(' + ')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                        {formatMin(startMin)} · {dur} min
                        {task.notes ? ` · ${task.notes}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <ModalFooter>
        <Btn onClick={() => setChecked({})} variant="secondary">Reset</Btn>
        <Btn onClick={onClose} variant="primary">Close</Btn>
      </ModalFooter>
    </Modal>
  );
}
