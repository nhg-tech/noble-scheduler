import { useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';
import { NOBLE_PALETTE } from '../../data/palette';
import { useScheduler } from '../../context/SchedulerContext';
import { UNIT_BASIS_OPTIONS } from '../../utils/calculations';

/**
 * CreateTaskModal — create or edit a custom task.
 * Pass `initialData` to pre-fill for editing an existing task.
 */
export default function CreateTaskModal({ onSave, onClose, initialData }) {
  const { getFullCatList } = useScheduler();
  // Active (non-deleted) categories in user-defined order
  const cats = getFullCatList().filter(c => !c.deleted).map(c => ({ value: c.id, label: c.label }));

  const [form, setForm] = useState({
    code:              initialData?.code              || '',
    name:              initialData?.name              || '',
    cat:               initialData?.cat               || 'fixed',
    unitBasis:         initialData?.unitBasis         || 'Fixed',
    durationMin:       initialData?.durationMin       || 30,
    color:             initialData?.color             || '#3E2A7E',
    desc:              initialData?.desc              || '',
    expectedInstances: initialData?.expectedInstances || 1,
  });

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) return;
    onSave({
      id: initialData?.id || `default_${Date.now()}`,
      ...form,
      durationMin: Number(form.durationMin),
      expectedInstances: Number(form.expectedInstances),
      slots: Math.ceil(Number(form.durationMin) / 30),
      unitMin: Number(form.durationMin),
      unitBasis: form.unitBasis,
      idealStart: 'Various',
    });
  }

  const canSave = form.code.trim() && form.name.trim();

  return (
    <Modal title={initialData ? 'Edit Custom Task' : 'Create Custom Task'} onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Row>
          <Field label="Code (short)" style={{ flex: 1 }}>
            <input
              value={form.code}
              onChange={e => set('code', e.target.value)}
              placeholder="e.g. MY-TASK"
              maxLength={12}
              style={inputStyle}
            />
          </Field>
          <Field label="Category" style={{ flex: 1 }}>
            <select value={form.cat} onChange={e => set('cat', e.target.value)} style={inputStyle}>
              {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </Row>

        <Field label="Full Name">
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Task full name"
            style={inputStyle}
          />
        </Field>

        <Row>
          <Field label="Unit Basis" style={{ flex: 1 }}>
            <select value={form.unitBasis} onChange={e => set('unitBasis', e.target.value)} style={inputStyle}>
              {UNIT_BASIS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label={form.unitBasis === 'Fixed' ? 'Duration (min)' : 'Min / Unit'} style={{ flex: 1 }}>
            <input
              type="number"
              min={1}
              step={form.unitBasis === 'Fixed' ? 5 : 1}
              value={form.durationMin}
              onChange={e => set('durationMin', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Row>

        <Field label="Expected instances">
          <input
            type="number"
            min={1}
            value={form.expectedInstances}
            onChange={e => set('expectedInstances', e.target.value)}
            style={{ ...inputStyle, width: '50%' }}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.desc}
            onChange={e => set('desc', e.target.value)}
            rows={2}
            placeholder="Optional description..."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
          />
        </Field>

        <Field label="Color">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {NOBLE_PALETTE.map(p => (
              <div
                key={p.hex}
                title={p.name}
                onClick={() => set('color', p.hex)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: p.hex,
                  cursor: 'pointer',
                  border: form.color === p.hex ? '2.5px solid var(--dark)' : '2px solid transparent',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
        </Field>
      </div>

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={!canSave}>{initialData ? 'Save Changes' : 'Create Task'}</Btn>
      </ModalFooter>
    </Modal>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--gray)',
        marginBottom: 5,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12 }}>{children}</div>;
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 7,
  border: '1.5px solid var(--gray-light)',
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  color: 'var(--dark)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
