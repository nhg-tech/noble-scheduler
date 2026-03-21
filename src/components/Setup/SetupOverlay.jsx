import { useState } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { TASK_LIBRARY, CAT_LABELS, CAT_ORDER } from '../../data/taskLibrary';
import { ROLES } from '../../data/roles';
import { NOBLE_PALETTE, resolveBlockHex } from '../../data/palette';
import { getExpectedInstances } from '../../utils/calculations';
import CreateTaskModal from '../Modals/CreateTaskModal';
import Modal, { ModalFooter, Btn } from '../Modals/Modal';

const TABS = ['Program Mix', 'Task Defaults', 'Role Config'];

export default function SetupOverlay({ onClose }) {
  const [tab, setTab] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);   // custom task being edited
  const [editingLibTask, setEditingLibTask] = useState(null); // library task being edited
  const {
    assumptions, setAssumptions,
    userTaskDefs, setUserTaskDefs,
    userProgramDefs, setUserProgramDefs,
    NOBLE_PROGRAM_DEFAULTS,
    saveDefaults, resetDefaults,
  } = useScheduler();

  function handleCreateCustom(taskData) {
    setUserTaskDefs(prev => ({ ...prev, [taskData.id]: taskData }));
    setShowCreateModal(false);
    setEditingTask(null);
  }

  function handleEditCustom(task) {
    setEditingTask(task);
    setShowCreateModal(true);
  }

  function handleDeleteCustom(taskId) {
    if (!window.confirm('Delete this custom task?')) return;
    setUserTaskDefs(prev => {
      const updated = { ...prev };
      delete updated[taskId];
      return updated;
    });
  }

  function handleDeleteLibTask(taskId) {
    if (!window.confirm('Hide this task from the schedule? It will be removed from the Task Library and this table. Use "Reset to defaults" to restore all hidden tasks.')) return;
    setUserTaskDefs(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), hidden: true },
    }));
  }

  function setAssumptionField(field, val) {
    setAssumptions(prev => ({ ...prev, [field]: Number(val) }));
  }

  function setProgramPct(field, val) {
    setUserProgramDefs(prev => ({ ...prev, [field]: Number(val) }));
  }

  function setTaskDefault(taskId, field, val) {
    setUserTaskDefs(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), [field]: val },
    }));
  }

  return (
    <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(26,26,46,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 12px 60px rgba(62,42,126,0.2)',
        width: 720,
        maxWidth: '96vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--gray-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--purple)',
          }}>Setup & Defaults</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray)' }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--gray-light)',
          padding: '0 24px',
          flexShrink: 0,
        }}>
          {TABS.map((t, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                color: tab === i ? 'var(--purple)' : 'var(--gray)',
                borderBottom: tab === i ? '2px solid var(--purple)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >{t}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {tab === 0 && (
            <ProgramMixTab
              assumptions={assumptions}
              onAssumption={setAssumptionField}
              userProgramDefs={userProgramDefs}
              defaults={NOBLE_PROGRAM_DEFAULTS}
              onPct={setProgramPct}
            />
          )}
          {tab === 1 && (
            <TaskDefaultsTab
              userTaskDefs={userTaskDefs}
              onChange={setTaskDefault}
              onCreateCustom={() => setShowCreateModal(true)}
              onEditCustom={handleEditCustom}
              onDeleteCustom={handleDeleteCustom}
              onEditLibTask={task => setEditingLibTask(task)}
              onDeleteLibTask={handleDeleteLibTask}
            />
          )}

          {tab === 2 && <RoleConfigTab />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--gray-light)',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <button
            onClick={resetDefaults}
            style={{
              padding: '8px 16px',
              borderRadius: 7,
              border: '1px solid var(--gray-light)',
              background: 'none',
              color: 'var(--gray)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >Reset to defaults</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--gray-light)',
                color: 'var(--dark)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >Cancel</button>
            <button
              onClick={() => { saveDefaults(); onClose(); }}
              style={{
                padding: '8px 18px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--purple)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >Save Defaults</button>
          </div>
        </div>
      </div>
    </div>

    {showCreateModal && (
      <CreateTaskModal
        initialData={editingTask}
        onSave={handleCreateCustom}
        onClose={() => { setShowCreateModal(false); setEditingTask(null); }}
      />
    )}
    {editingLibTask && (
      <EditLibTaskModal
        task={editingLibTask}
        override={userTaskDefs[editingLibTask.id] || {}}
        onChange={setTaskDefault}
        onClose={() => setEditingLibTask(null)}
      />
    )}
    </>
  );
}

// ─── Program Mix Tab ──────────────────────────────────────────────────────────
function ProgramMixTab({ assumptions, onAssumption, userProgramDefs, defaults, onPct }) {
  const pct = { ...defaults, ...userProgramDefs };

  const assumptionFields = [
    { key: 'socpg', label: 'Social Play Groups', unit: 'groups' },
    { key: 'selpg', label: 'Select Play Groups',  unit: 'groups' },
    { key: 'dogs',  label: 'Total Dogs',           unit: '' },
  ];

  const pctFields = [
    { key: 'social',      label: 'Social %',      unit: '%' },
    { key: 'select',      label: 'Select %',      unit: '%' },
    { key: 'pf',          label: 'P/F %',          unit: '%' },
    { key: 'multipet',    label: 'Multipet Dogs',  unit: '%' },
    { key: 'cats',        label: 'Cats %',          unit: '%' },
    { key: 'multipetCats',label: 'Multipet Cats',  unit: '%' },
  ];

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        These values drive task count calculations and schedule summaries.
      </p>

      <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--gray)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Today's Actuals
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
        {assumptionFields.map(f => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min={0}
                value={assumptions[f.key] ?? 0}
                onChange={e => onAssumption(f.key, e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              {f.unit && <span style={{ fontSize: 12, color: 'var(--gray)', flexShrink: 0 }}>{f.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--gray)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Program Mix % Defaults
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
        {pctFields.map(f => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={pct[f.key] ?? 0}
                onChange={e => onPct(f.key, e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              {f.unit && <span style={{ fontSize: 12, color: 'var(--gray)', flexShrink: 0 }}>{f.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Task Defaults Tab ───────────────────────────────────────────────────────
function TaskDefaultsTab({ userTaskDefs, onChange, onCreateCustom, onEditCustom, onDeleteCustom, onEditLibTask, onDeleteLibTask }) {
  const catColors = { group: '#EDE8F7', suite: '#E3F2FD', meals: '#FFF8E1', fixed: '#F1F8E9', on: '#F3E5F5' };

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        Set duration and color per task.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--gray-light)' }}>
            <Th>Code</Th>
            <Th>Task</Th>
            <Th>Unit Basis</Th>
            <Th>Min / Unit</Th>
            <Th>Min Res / Unit</Th>
            <Th>Color</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {CAT_ORDER.map(cat => {
            const customTasksForCat = Object.values(userTaskDefs).filter(t => t.custom && t.cat === cat);
            return [
              <tr key={`cat-${cat}`}>
                <td colSpan={7} style={{
                  padding: '6px 10px 3px',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: 'var(--purple)',
                  background: catColors[cat] || 'var(--gray-light)',
                }}>
                  {CAT_LABELS[cat]}
                </td>
              </tr>,
              ...TASK_LIBRARY.filter(t => t.cat === cat && !userTaskDefs[t.id]?.hidden).map(task => {
                const override = userTaskDefs[task.id] || {};
                const isOverridden = override.durationMin != null;
                const effectiveMin = override.durationMin ?? task.unitMin;
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--gray-light)' }}>
                    <Td><code style={{ fontSize: 10 }}>{task.code}</code></Td>
                    <Td>{task.name}</Td>
                    <Td style={{ color: 'var(--gray)', fontSize: 11 }}>{task.unitBasis}</Td>
                    <Td>
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        value={effectiveMin}
                        onChange={e => onChange(task.id, 'durationMin', e.target.value ? Number(e.target.value) : undefined)}
                        style={{
                          ...inputStyle,
                          width: 60, padding: '3px 6px', fontSize: 11,
                        }}
                      />
                    </Td>
                    <Td>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={override.minResources ?? ''}
                        placeholder="—"
                        onChange={e => onChange(task.id, 'minResources', e.target.value ? Number(e.target.value) : undefined)}
                        style={{
                          ...inputStyle,
                          width: 60, padding: '3px 6px', fontSize: 11,
                          borderColor: override.minResources != null ? 'var(--gold-dark)' : 'var(--gray-light)',
                          background: override.minResources != null ? 'var(--gold-light)' : '#fff',
                        }}
                      />
                    </Td>
                    <Td>
                      <ColorPicker
                        value={override.color || task.color}
                        onChange={hex => onChange(task.id, 'color', hex)}
                      />
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => onEditLibTask(task)}
                          title="Edit task"
                          style={actionBtnStyle}
                        >✏</button>
                        <button
                          onClick={() => onDeleteLibTask(task.id)}
                          title="Delete customizations"
                          style={{ ...actionBtnStyle, color: 'var(--red)' }}
                        >🗑</button>
                      </div>
                    </Td>
                  </tr>
                );
              }),
              ...customTasksForCat.map(task => (
                <tr key={task.id} style={{ borderBottom: '1px solid var(--gray-light)', background: '#F8F5FF' }}>
                  <Td>
                    <code style={{ fontSize: 10 }}>{task.code}</code>
                    <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--purple)', fontWeight: 700, opacity: 0.7 }}>custom</span>
                  </Td>
                  <Td>{task.name}</Td>
                  <Td style={{ color: 'var(--gray)', fontSize: 11 }}>{task.unitBasis}</Td>
                  <Td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={task.durationMin ?? 30}
                      onChange={e => onChange(task.id, 'durationMin', e.target.value ? Number(e.target.value) : undefined)}
                      style={{ ...inputStyle, width: 60, padding: '3px 6px', fontSize: 11 }}
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={task.minResources ?? ''}
                      placeholder="—"
                      onChange={e => onChange(task.id, 'minResources', e.target.value ? Number(e.target.value) : undefined)}
                      style={{
                        ...inputStyle,
                        width: 60, padding: '3px 6px', fontSize: 11,
                        borderColor: task.minResources != null ? 'var(--gold-dark)' : 'var(--gray-light)',
                        background: task.minResources != null ? 'var(--gold-light)' : '#fff',
                      }}
                    />
                  </Td>
                  <Td>
                    <ColorPicker
                      value={task.color}
                      onChange={hex => onChange(task.id, 'color', hex)}
                    />
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => onEditCustom(task)}
                        title="Edit task"
                        style={actionBtnStyle}
                      >✏</button>
                      <button
                        onClick={() => onDeleteCustom(task.id)}
                        title="Delete task"
                        style={{ ...actionBtnStyle, color: 'var(--red)' }}
                      >🗑</button>
                    </div>
                  </Td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 14 }}>
        <button
          onClick={onCreateCustom}
          style={{
            padding: '8px 16px',
            borderRadius: 7,
            border: '1.5px dashed var(--purple-light)',
            background: 'transparent',
            color: 'var(--purple)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >+ Add New Default Task</button>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const hex = resolveBlockHex(value);
  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: hex,
          cursor: 'pointer',
          border: '1.5px solid var(--gray-light)',
        }}
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: 26,
          right: 0,
          zIndex: 200,
          background: '#fff',
          border: '1px solid var(--gray-light)',
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          width: 160,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {NOBLE_PALETTE.map(p => (
            <div
              key={p.hex}
              title={p.name}
              onClick={() => { onChange(p.hex); setOpen(false); }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: p.hex,
                cursor: 'pointer',
                border: hex === p.hex ? '2px solid var(--dark)' : '1px solid transparent',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Role Config Tab ─────────────────────────────────────────────────────────
function RoleConfigTab() {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        Role shift times are set by management. Contact your GM to change role configurations.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--gray-light)' }}>
            <Th>Role</Th>
            <Th>Type</Th>
            <Th>Shift Start</Th>
            <Th>Shift End</Th>
            <Th>Hours</Th>
          </tr>
        </thead>
        <tbody>
          {ROLES.map(role => (
            <tr key={role.id} style={{ borderBottom: '1px solid var(--gray-light)' }}>
              <Td><strong>{role.label}</strong> — {role.sub}</Td>
              <Td>{role.type}</Td>
              <Td style={{ fontFamily: "'DM Mono', monospace" }}>{role.shiftStart}:00</Td>
              <Td style={{ fontFamily: "'DM Mono', monospace" }}>{role.shiftEnd}:00</Td>
              <Td style={{ fontFamily: "'DM Mono', monospace" }}>{role.hours}h</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return (
    <th style={{
      padding: '6px 10px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--gray)',
    }}>{children}</th>
  );
}

function Td({ children, style }) {
  return (
    <td style={{ padding: '6px 10px', ...style }}>
      {children}
    </td>
  );
}

const CAT_OPTIONS = [
  { value: 'group', label: 'Play Groups' },
  { value: 'suite', label: 'Suite Care' },
  { value: 'meals', label: 'Meals' },
  { value: 'fixed', label: 'Fixed Tasks' },
  { value: 'on',    label: 'Overnight' },
];

// ─── Edit Library Task Modal ──────────────────────────────────────────────────
function EditLibTaskModal({ task, override, onChange, onClose }) {
  const [local, setLocal] = useState({
    durationMin:       override.durationMin     ?? task.unitMin,
    minResources:      override.minResources     ?? '',
    color:             override.color            || task.color,
    cat:               override.cat              || task.cat,
    desc:              override.desc             ?? (task.desc || ''),
    // Custom tasks also expose code + name for editing
    code:              override.code             ?? task.code,
    name:              override.name             ?? task.name,
    expectedInstances: override.expectedInstances ?? task.expectedInstances ?? 1,
  });

  const isCustom = !!task.custom;

  function handleSave() {
    onChange(task.id, 'durationMin',       Number(local.durationMin));
    onChange(task.id, 'minResources',      local.minResources !== '' ? Number(local.minResources) : undefined);
    onChange(task.id, 'color',             local.color);
    onChange(task.id, 'cat',               local.cat);
    onChange(task.id, 'desc',              local.desc || undefined);
    onChange(task.id, 'expectedInstances', local.expectedInstances !== '' ? Number(local.expectedInstances) : undefined);
    if (isCustom) {
      onChange(task.id, 'code', local.code.trim() || task.code);
      onChange(task.id, 'name', local.name.trim() || task.name);
    }
    onClose();
  }

  return (
    <Modal title={`Edit: ${task.name}`} onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Code + Name — editable for custom tasks, read-only for library tasks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={editLabelStyle}>Code</label>
            {isCustom
              ? <input value={local.code} maxLength={12} onChange={e => setLocal(p => ({ ...p, code: e.target.value }))} style={editInputStyle} />
              : <div style={{ ...editInputStyle, background: 'var(--gray-light)', color: 'var(--gray)', cursor: 'default' }}>{task.code}</div>
            }
          </div>
          <div>
            <label style={editLabelStyle}>Category</label>
            <select
              value={local.cat}
              onChange={e => setLocal(p => ({ ...p, cat: e.target.value }))}
              style={editInputStyle}
            >
              {CAT_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {isCustom && (
          <div>
            <label style={editLabelStyle}>Full Name</label>
            <input value={local.name} onChange={e => setLocal(p => ({ ...p, name: e.target.value }))} style={editInputStyle} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={editLabelStyle}>Min / Unit</label>
            <input
              type="number" min={1}
              value={local.durationMin}
              onChange={e => setLocal(p => ({ ...p, durationMin: e.target.value }))}
              style={editInputStyle}
            />
          </div>
          <div>
            <label style={editLabelStyle}>Min Res / Unit <span style={{ fontWeight: 400, textTransform: 'none' }}>(99 = all roles)</span></label>
            <input
              type="number" min={1}
              value={local.minResources}
              placeholder="—"
              onChange={e => setLocal(p => ({ ...p, minResources: e.target.value }))}
              style={editInputStyle}
            />
          </div>
        </div>

        <div>
          <label style={editLabelStyle}>Expected Instances</label>
          <input
            type="number" min={1}
            value={local.expectedInstances}
            onChange={e => setLocal(p => ({ ...p, expectedInstances: e.target.value }))}
            style={editInputStyle}
          />
        </div>

        <div>
          <label style={editLabelStyle}>Description</label>
          <textarea
            rows={2}
            value={local.desc}
            onChange={e => setLocal(p => ({ ...p, desc: e.target.value }))}
            placeholder="Optional description…"
            style={{ ...editInputStyle, resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>

        <div>
          <label style={editLabelStyle}>Color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {NOBLE_PALETTE.map(p => (
              <div
                key={p.hex}
                title={p.name}
                onClick={() => setLocal(prev => ({ ...prev, color: p.hex }))}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: p.hex, cursor: 'pointer',
                  border: resolveBlockHex(local.color) === p.hex ? '2.5px solid var(--dark)' : '1px solid transparent',
                  boxSizing: 'border-box',
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

const editLabelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--gray)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase',
};

const editInputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1.5px solid var(--gray-light)', fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", color: 'var(--dark)',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--gray)',
  marginBottom: 4,
  letterSpacing: '0.04em',
};

const actionBtnStyle = {
  padding: '2px 5px',
  borderRadius: 4,
  border: '1px solid var(--gray-light)',
  background: 'none',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
  color: 'var(--gray)',
};

const inputStyle = {
  padding: '7px 10px',
  borderRadius: 6,
  border: '1.5px solid var(--gray-light)',
  fontSize: 12,
  fontFamily: "'DM Mono', monospace",
  color: 'var(--dark)',
  outline: 'none',
  boxSizing: 'border-box',
};
