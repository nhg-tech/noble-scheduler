import { useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';
import { keyToRoleAndMin, formatMin } from '../../utils/scheduling';
import { NOBLE_PALETTE, resolveBlockHex } from '../../data/palette';

/**
 * EditModal — edit a placed task block's notes, duration, color.
 */
export default function EditModal({ blockKey, task, onSave, onClose }) {
  const [notes, setNotes]       = useState(task?.notes || '');
  const [duration, setDuration] = useState(task?.durationMin ?? (task?.slots * 30) ?? 30);
  const [color, setColor]       = useState(task?.color || '');

  if (!blockKey || !task) return null;
  const { startMin } = keyToRoleAndMin(blockKey);

  function handleSave() {
    onSave(blockKey, { notes, durationMin: Number(duration), color });
  }

  return (
    <Modal title="Edit Task Block" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Task</label>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>
            {task.name || task.code}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
            {formatMin(startMin)}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Duration (minutes)</label>
          <input
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={e => setDuration(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
            placeholder="Optional notes..."
          />
        </div>

        <div>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {NOBLE_PALETTE.map(p => (
              <div
                key={p.hex}
                title={p.name}
                onClick={() => setColor(p.hex)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: p.hex,
                  cursor: 'pointer',
                  border: resolveBlockHex(color) === p.hex ? '2.5px solid var(--dark)' : '2px solid transparent',
                  boxSizing: 'border-box',
                  transition: 'transform 0.1s',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handleSave} variant="primary">Save</Btn>
      </ModalFooter>
    </Modal>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--gray)',
  marginBottom: 5,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 7,
  border: '1.5px solid var(--gray-light)',
  fontSize: 13,
  fontFamily: "'DM Mono', monospace",
  color: 'var(--dark)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
