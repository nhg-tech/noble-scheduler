import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { NOBLE_PALETTE, resolveBlockHex } from '../../data/palette';
import { getExpectedInstances, UNIT_BASIS_OPTIONS } from '../../utils/calculations';
import CreateTaskModal from '../Modals/CreateTaskModal';
import Modal, { ModalFooter, Btn } from '../Modals/Modal';

const TABS = ['Program Mix', 'Task Defaults', 'Role Config', 'Categories'];

export default function SetupOverlay({ onClose }) {
  const [tab, setTab] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);   // custom task being edited
  const [editingLibTask, setEditingLibTask] = useState(null); // library task being edited
  const {
    assumptions, setAssumptions,
    userTaskDefs, setUserTaskDefs,
    sessionTaskDefs, setSessionTaskDefs,
    userProgramDefs, setUserProgramDefs,
    userRoleDefs,
    NOBLE_PROGRAM_DEFAULTS,
    saveDefaults, resetDefaults, persistDefaultsToApi,
    getFullCatList, taskOrder, setTaskOrder,
    userCatDefs, setUserCatDefs, catOrder, setCatOrder,
    getUserDrafts, getUserPostings, saveUserDrafts, saveUserPostings,
  } = useScheduler();

  // Snapshot of role defs when overlay opened — used to detect new deletions on Save
  const initialRoleDefs = useRef(userRoleDefs);
  const importInputRef  = useRef(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Export all Setup data as a JSON backup file ───────────────────────────
  function handleExportSetup() {
    const payload = {
      version:    '1.0',
      exportedAt: new Date().toISOString(),
      noble_task_defaults:    userTaskDefs,
      noble_role_defaults:    userRoleDefs,
      noble_program_defaults: userProgramDefs,
      noble_cat_defs:         userCatDefs,
      noble_cat_order:        catOrder,
      noble_task_order:       taskOrder,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `noble-setup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import Setup data from a JSON backup file ─────────────────────────────
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('Not a valid Noble Setup backup file.');
        const keys = [
          'noble_task_defaults', 'noble_role_defaults', 'noble_program_defaults',
          'noble_cat_defs', 'noble_cat_order', 'noble_task_order',
        ];
        keys.forEach(k => {
          if (data[k] !== undefined) localStorage.setItem(k, JSON.stringify(data[k]));
        });
        alert('Setup imported successfully. The page will reload to apply the changes.');
        window.location.reload();
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported if needed
    e.target.value = '';
  }

  // Default tasks created in Setup → stored in userTaskDefs (global, survives template changes)
  function handleCreateCustom(taskData) {
    setUserTaskDefs(prev => ({ ...prev, [taskData.id]: taskData }));
    setShowCreateModal(false);
    setEditingTask(null);
  }

  function handleEditCustom(task) {
    setEditingTask(task);
    setShowCreateModal(true);
  }

  function handleDeleteTask(taskId) {
    if (!window.confirm('Remove this task from Setup? It will no longer appear in the task library or this table.')) return;
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
    // All default tasks in Setup live in userTaskDefs regardless of origin
    setUserTaskDefs(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), [field]: val },
    }));
  }

  // Bulk-save all fields edited in EditLibTaskModal, then immediately persist to API
  function handleLibTaskSave(taskId, updates) {
    const newTaskDef = { ...(userTaskDefs[taskId] || {}), ...updates };
    setUserTaskDefs(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), ...updates },
    }));
    // Persist to API with the updated task — don't wait for state to settle
    const newDefs = { ...userTaskDefs, [taskId]: newTaskDef };
    persistDefaultsToApi(newDefs, userRoleDefs, userProgramDefs, userCatDefs, catOrder, taskOrder);
  }

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(26,26,46,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 12px 60px rgba(62,42,126,0.2)',
          width: 780,
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
              sessionTaskDefs={sessionTaskDefs}
              onChange={setTaskDefault}
              onCreateTask={() => setShowCreateModal(true)}
              onEditTask={task => setEditingLibTask(task)}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {tab === 2 && <RoleConfigTab />}
          {tab === 3 && (
            <CategoriesTab
              getFullCatList={getFullCatList}
              userCatDefs={userCatDefs}
              setUserCatDefs={setUserCatDefs}
              catOrder={catOrder}
              setCatOrder={setCatOrder}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--gray-light)',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {/* Export / Import backup buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleExportSetup}
              title="Download all Setup data as a JSON backup file"
              style={{
                padding: '7px 13px', borderRadius: 7, cursor: 'pointer',
                border: '1.5px solid var(--purple-light)',
                background: 'var(--purple-pale)', color: 'var(--purple)',
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              }}
            >⬇ Export Setup</button>
            <button
              onClick={() => importInputRef.current?.click()}
              title="Restore Setup from a previously exported JSON file"
              style={{
                padding: '7px 13px', borderRadius: 7, cursor: 'pointer',
                border: '1.5px solid var(--gray-light)',
                background: 'var(--cream)', color: 'var(--dark)',
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              }}
            >⬆ Import Setup</button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
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
              onClick={() => {
                // Detect roles newly deleted during this session
                const newlyDeleted = Object.entries(userRoleDefs)
                  .filter(([id, def]) => def.deleted && !initialRoleDefs.current[id]?.deleted)
                  .map(([id]) => id);
                if (newlyDeleted.length > 0) {
                  const update = window.confirm(
                    `${newlyDeleted.length} role(s) were removed from the schedule.\n\nClick OK to also remove their scheduled tasks from all saved drafts and postings.\nClick Cancel to leave saved schedules unchanged.`
                  );
                  if (update) {
                    const purge = (store) => Object.fromEntries(
                      Object.entries(store).map(([name, state]) => [name, {
                        ...state,
                        schedule: Object.fromEntries(
                          Object.entries(state.schedule || {})
                            .filter(([key]) => !newlyDeleted.includes(key.split('|')[0]))
                        ),
                      }])
                    );
                    saveUserDrafts(purge(getUserDrafts()));
                    saveUserPostings(purge(getUserPostings()));
                  }
                }
                saveDefaults();
                persistDefaultsToApi(userTaskDefs, userRoleDefs, userProgramDefs, userCatDefs, catOrder, taskOrder);
                onClose();
              }}
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
        onSave={handleLibTaskSave}
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
const CAT_BG = { group: '#EDE8F7', suite: '#E3F2FD', meals: '#FFF8E1', fixed: '#F1F8E9', on: '#F3E5F5' };

function TaskDefaultsTab({ userTaskDefs, sessionTaskDefs, onChange, onCreateTask, onEditTask, onDeleteTask }) {
  const { getFullCatList, taskOrder, setTaskOrder, getTaskDefault, taskLibrary } = useScheduler();
  const isDraggingRef = useRef(false);
  const dragIdRef     = useRef(null);
  const dragCatRef    = useRef(null);

  const activeCats = getFullCatList().filter(c => !c.deleted);

  function getOrderedTasksForCat(catId) {
    const libTasks = taskLibrary.filter(t => {
      const effectiveCat = userTaskDefs[t.id]?.cat || t.cat;
      return effectiveCat === catId && !userTaskDefs[t.id]?.hidden;
    });
    // Also include user-created default tasks for this category (in userTaskDefs but not in taskLibrary)
    const userCreatedTasks = Object.entries(userTaskDefs)
      .filter(([id, t]) => !taskLibrary.find(lib => lib.id === id) && !t.hidden && (t.cat || '') === catId)
      .map(([id, t]) => ({ ...t, id }));
    const all = [...libTasks, ...userCreatedTasks];
    const order = taskOrder[catId] || [];
    const byId = Object.fromEntries(all.map(t => [t.id, t]));
    const ordered = order.map(id => byId[id]).filter(Boolean);
    const rest = all.filter(t => !order.includes(t.id));
    return [...ordered, ...rest];
  }

  function handleGripPointerDown(e, taskId, catId) {
    e.stopPropagation(); e.preventDefault();
    isDraggingRef.current = true;
    dragIdRef.current     = taskId;
    dragCatRef.current    = catId;
    function onUp() {
      isDraggingRef.current = false;
      dragIdRef.current = null; dragCatRef.current = null;
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointerup', onUp);
  }

  function handleRowPointerEnter(taskId, catId) {
    if (!isDraggingRef.current || !dragIdRef.current || dragCatRef.current !== catId) return;
    const draggingId = dragIdRef.current;
    if (draggingId === taskId) return;
    setTaskOrder(prev => {
      const tasks = getOrderedTasksForCat(catId);
      const ids   = tasks.map(t => t.id);
      const from  = ids.indexOf(draggingId);
      const to    = ids.indexOf(taskId);
      if (from === -1 || to === -1) return prev;
      const next = [...ids];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return { ...prev, [catId]: next };
    });
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        Set duration and color per task. Drag ⠿ to reorder tasks within a category.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--gray-light)' }}>
            <Th style={{ width: 24 }}></Th>
            <Th>Code</Th>
            <Th>Task</Th>
            <Th>Unit Basis</Th>
            <Th>Min / Unit</Th>
            <Th>Min Res / Unit</Th>
            <Th>Color</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>Count Hrs</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {activeCats.map(cat => {
            const tasks = getOrderedTasksForCat(cat.id);
            return [
              <tr key={`cat-${cat.id}`}>
                <td colSpan={9} style={{
                  padding: '6px 10px 3px', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: 'var(--purple)', background: CAT_BG[cat.id] || 'var(--gray-light)',
                }}>{cat.label}</td>
              </tr>,
              ...tasks.map(task => {
                const def      = getTaskDefault(task.id);
                const override = userTaskDefs[task.id] || {};
                const minVal   = def.unitMin ?? task.durationMin ?? 30;
                const minRes   = def.minResources;
                const colorVal = def.color ?? task.color;
                return (
                  <tr
                    key={task.id}
                    style={{ borderBottom: '1px solid var(--gray-light)' }}
                    onPointerEnter={() => handleRowPointerEnter(task.id, cat.id)}
                  >
                    <Td>
                      <div
                        onPointerDown={e => handleGripPointerDown(e, task.id, cat.id)}
                        style={{ cursor: 'grab', color: 'var(--gray)', fontSize: 14, userSelect: 'none', padding: '0 4px', lineHeight: 1 }}
                        title="Drag to reorder"
                      >⠿</div>
                    </Td>
                    <Td>
                      <code style={{
                        fontSize: 10,
                        whiteSpace: (override.code ?? task.code).length <= 10 ? 'nowrap' : 'normal',
                        wordBreak: 'break-all',
                      }}>{override.code ?? task.code}</code>
                    </Td>
                    <Td>{override.name ?? task.name}</Td>
                    <Td style={{ color: 'var(--gray)', fontSize: 11 }}>{task.unitBasis || '—'}</Td>
                    <Td>
                      <input type="number" min={1} step={1}
                        value={minVal}
                        onChange={e => onChange(task.id, 'durationMin', e.target.value ? Number(e.target.value) : undefined)}
                        style={{ ...inputStyle, width: 60, padding: '3px 6px', fontSize: 11 }}
                      />
                    </Td>
                    <Td>
                      <input type="number" min={1} step={1}
                        value={minRes ?? ''}
                        placeholder="—"
                        onChange={e => onChange(task.id, 'minResources', e.target.value ? Number(e.target.value) : undefined)}
                        style={{ ...inputStyle, width: 60, padding: '3px 6px', fontSize: 11 }}
                      />
                    </Td>
                    <Td>
                      <ColorPicker value={colorVal} onChange={hex => onChange(task.id, 'color', hex)} />
                    </Td>
                    <Td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={def.countHours}
                        onChange={e => onChange(task.id, 'countHours', e.target.checked)}
                        title={getTaskDefault(task.id).countHours === false ? 'Excluded from hours total' : 'Counts toward hours total'}
                        style={{ cursor: 'pointer', accentColor: 'var(--purple)', width: 14, height: 14 }}
                      />
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onEditTask(task)} title="Edit" style={actionBtnStyle}>✏</button>
                        <button onClick={() => onDeleteTask(task.id)} title="Delete" style={{ ...actionBtnStyle, color: 'var(--red)' }}>🗑</button>
                      </div>
                    </Td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 14 }}>
        <button onClick={onCreateTask} style={{
          padding: '8px 16px', borderRadius: 7, border: '1.5px dashed var(--purple-light)',
          background: 'transparent', color: 'var(--purple)', fontSize: 12,
          fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
        }}>+ Add New Default Task</button>
      </div>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({ getFullCatList, userCatDefs, setUserCatDefs, catOrder, setCatOrder }) {
  const [newLabel, setNewLabel] = useState('');
  const isDraggingRef = useRef(false);
  const dragIdRef     = useRef(null);

  const cats = getFullCatList(); // includes deleted ones (for restore)

  function handleLabelChange(catId, label) {
    setUserCatDefs(prev => ({ ...prev, [catId]: { ...(prev[catId] || {}), label } }));
  }

  function handleToggleDelete(catId, currentlyDeleted) {
    setUserCatDefs(prev => ({ ...prev, [catId]: { ...(prev[catId] || {}), deleted: !currentlyDeleted } }));
  }

  function handleAdd() {
    if (!newLabel.trim()) return;
    const id = `cat_${Date.now()}`;
    setUserCatDefs(prev => ({ ...prev, [id]: { label: newLabel.trim(), deleted: false } }));
    setCatOrder(prev => [...prev, id]);
    setNewLabel('');
  }

  function handleGripPointerDown(e, catId) {
    e.stopPropagation(); e.preventDefault();
    isDraggingRef.current = true;
    dragIdRef.current     = catId;
    function onUp() {
      isDraggingRef.current = false; dragIdRef.current = null;
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointerup', onUp);
  }

  function handleRowPointerEnter(catId) {
    if (!isDraggingRef.current || !dragIdRef.current || dragIdRef.current === catId) return;
    const draggingId = dragIdRef.current;
    setCatOrder(prev => {
      const from = prev.indexOf(draggingId);
      const to   = prev.indexOf(catId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        Manage task categories. Drag ⠿ to reorder. Deleting a category hides it from new task assignment — existing tasks in that category are preserved and shown as <em>[Name] – Deleted</em>.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--gray-light)' }}>
            <Th style={{ width: 24 }}></Th>
            <Th>Category Name</Th>
            <Th>Status</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {cats.map(cat => (
            <tr
              key={cat.id}
              style={{ borderBottom: '1px solid var(--gray-light)', opacity: cat.deleted ? 0.65 : 1 }}
              onPointerEnter={() => handleRowPointerEnter(cat.id)}
            >
              <Td>
                <div
                  onPointerDown={e => handleGripPointerDown(e, cat.id)}
                  style={{ cursor: 'grab', color: 'var(--gray)', fontSize: 14, userSelect: 'none', padding: '0 4px', lineHeight: 1 }}
                  title="Drag to reorder"
                >⠿</div>
              </Td>
              <Td>
                <input
                  value={userCatDefs[cat.id]?.label ?? cat.label}
                  onChange={e => handleLabelChange(cat.id, e.target.value)}
                  style={{
                    ...inputStyle, width: '100%', padding: '4px 8px', fontSize: 12,
                    textDecoration: cat.deleted ? 'line-through' : 'none',
                    color: cat.deleted ? 'var(--gray)' : 'var(--dark)',
                  }}
                />
              </Td>

              <Td>
                {cat.deleted
                  ? <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.04em' }}>DELETED</span>
                  : <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 700, letterSpacing: '0.04em' }}>ACTIVE</span>
                }
              </Td>
              <Td>
                <button
                  onClick={() => handleToggleDelete(cat.id, cat.deleted)}
                  style={{ ...actionBtnStyle, fontSize: 11, padding: '3px 8px', color: cat.deleted ? 'var(--purple)' : 'var(--red)' }}
                >
                  {cat.deleted ? 'Restore' : 'Delete'}
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New category name…"
          style={{ ...inputStyle, flex: 1, padding: '7px 10px', fontSize: 12 }}
        />
        <button
          onClick={handleAdd}
          disabled={!newLabel.trim()}
          style={{
            padding: '7px 14px', borderRadius: 7, border: 'none',
            background: newLabel.trim() ? 'var(--purple)' : 'var(--gray-light)',
            color: newLabel.trim() ? '#fff' : 'var(--gray)',
            fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            cursor: newLabel.trim() ? 'pointer' : 'default',
          }}
        >+ Add Category</button>
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

// ─── Role Config Tab helpers ──────────────────────────────────────────────────
function decToTime(decimal) {
  if (decimal == null || decimal === '') return '';
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function timeToDec(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}
function calcShiftHours(shiftStart, shiftEnd, unpaidBreak) {
  if (shiftStart == null || shiftEnd == null) return null;
  let mins = (shiftEnd - shiftStart) * 60;
  if (mins < 0) mins += 24 * 60; // overnight
  mins -= (Number(unpaidBreak) || 0);
  return Math.round(mins / 60 * 10) / 10;
}

// ─── Role Config Tab ─────────────────────────────────────────────────────────
function RoleConfigTab() {
  const {
    userRoleDefs, setUserRoleDefs,
    columnOrder,  setColumnOrder,
  } = useScheduler();

  // Build display list: all roles from DB (built-in and custom)
  const displayRoles = useMemo(() => {
    return Object.entries(userRoleDefs).map(([id, def]) => {
      const sStart = def.shiftStart  ?? 9;
      const sEnd   = def.shiftEnd    ?? 17;
      const uBreak = def.unpaidBreak ?? 0;
      const type   = def.type || 'TM';
      return {
        id, type,
        label:       def.label       || id,
        sub:         def.sub         || '',
        shiftStart:  sStart,
        shiftEnd:    sEnd,
        unpaidBreak: uBreak,
        hours:       calcShiftHours(sStart, sEnd, uBreak),
        deleted:     def.deleted ?? false,
        includeInHrs: def.includeInHrs ?? (type === 'TM' || type === 'TL'),
      };
    });
  }, [userRoleDefs]);

  function updateField(id, field, value) {
    setUserRoleDefs(prev => {
      const cur = prev[id] || {};
      const updated = { ...cur, [field]: value };
      // Auto-recalc hours when shift times or break change
      if (['shiftStart', 'shiftEnd', 'unpaidBreak'].includes(field)) {
        const sStart = field === 'shiftStart' ? value : (cur.shiftStart ?? 9);
        const sEnd   = field === 'shiftEnd'   ? value : (cur.shiftEnd   ?? 17);
        const uBreak = field === 'unpaidBreak'? value : (cur.unpaidBreak ?? 0);
        updated.hours = calcShiftHours(sStart, sEnd, uBreak);
      }
      return { ...prev, [id]: updated };
    });
  }

  function toggleDelete(id) {
    setUserRoleDefs(prev => {
      const cur = prev[id] || {};
      return { ...prev, [id]: { ...cur, deleted: !cur.deleted } };
    });
  }

  function addRole() {
    const id   = `role_${Date.now()}`;
    const sS   = 9, sE = 17, uB = 30;
    setUserRoleDefs(prev => ({
      ...prev,
      [id]: {
        label: 'New Role', sub: '', type: 'TM',
        shiftStart: sS, shiftEnd: sE, unpaidBreak: uB,
        hours: calcShiftHours(sS, sE, uB),
        custom: true, deleted: false,
      },
    }));
    setColumnOrder(prev => [...prev, id]);
  }

  const cellSt = { ...inputStyle, padding: '4px 6px', fontSize: 12 };

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        Edit role labels, shift times, and unpaid breaks. Hours auto-calculate. &ldquo;In Hrs&rdquo; controls whether a role counts toward Hours Available and Hours Scheduled in the Schedule Summary. Deleted roles are hidden from the schedule grid.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
          <thead>
            <tr style={{ background: 'var(--gray-light)' }}>
              <Th>Label</Th>
              <Th>Sub-text</Th>
              <Th>Shift Start</Th>
              <Th>Shift End</Th>
              <Th style={{ whiteSpace: 'nowrap' }}>Unpaid Brk (min)</Th>
              <Th>Hours</Th>
              <Th style={{ whiteSpace: 'nowrap' }}>In Hrs</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {displayRoles.map(role => (
              <tr
                key={role.id}
                style={{
                  borderBottom: '1px solid var(--gray-light)',
                  opacity:      role.deleted ? 0.55 : 1,
                }}
              >
                <Td>
                  <input
                    value={role.label}
                    disabled={role.deleted}
                    onChange={e => updateField(role.id, 'label', e.target.value)}
                    style={{ ...cellSt, width: 90 }}
                  />
                </Td>
                <Td>
                  <input
                    value={role.sub}
                    disabled={role.deleted}
                    onChange={e => updateField(role.id, 'sub', e.target.value)}
                    style={{ ...cellSt, width: 80 }}
                  />
                </Td>
                <Td>
                  <input
                    type="time"
                    value={decToTime(role.shiftStart)}
                    disabled={role.deleted}
                    onChange={e => updateField(role.id, 'shiftStart', timeToDec(e.target.value))}
                    style={{ ...cellSt, width: 100 }}
                  />
                </Td>
                <Td>
                  <input
                    type="time"
                    value={decToTime(role.shiftEnd)}
                    disabled={role.deleted}
                    onChange={e => updateField(role.id, 'shiftEnd', timeToDec(e.target.value))}
                    style={{ ...cellSt, width: 100 }}
                  />
                </Td>
                <Td>
                  <input
                    type="number" min={0} step={5}
                    value={role.unpaidBreak}
                    disabled={role.deleted}
                    onChange={e => updateField(role.id, 'unpaidBreak', Number(e.target.value) || 0)}
                    style={{ ...cellSt, width: 60 }}
                  />
                </Td>
                <Td>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gray)', fontSize: 12 }}>
                    {role.hours != null ? `${role.hours}h` : '—'}
                  </span>
                </Td>
                <Td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={role.includeInHrs}
                    disabled={role.deleted}
                    onChange={e => updateField(role.id, 'includeInHrs', e.target.checked)}
                    title="Include this role's hours in Schedule Summary"
                  />
                </Td>
                <Td>
                  {role.deleted
                    ? <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.04em' }}>DELETED</span>
                    : <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 700, letterSpacing: '0.04em' }}>ACTIVE</span>
                  }
                </Td>
                <Td>
                  <button
                    onClick={() => toggleDelete(role.id)}
                    style={{ ...actionBtnStyle, fontSize: 11, padding: '3px 8px', color: role.deleted ? 'var(--purple)' : 'var(--red)' }}
                  >
                    {role.deleted ? 'Restore' : 'Delete'}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14 }}>
        <button
          onClick={addRole}
          style={{
            padding: '8px 16px', borderRadius: 7, border: '1.5px dashed var(--purple-light)',
            background: 'transparent', color: 'var(--purple)', fontSize: 12,
            fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
          }}
        >+ Add Role</button>
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{
      padding: '6px 10px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--gray)',
      ...style,
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

// ─── Edit Library Task Modal ──────────────────────────────────────────────────
function EditLibTaskModal({ task, override, onSave, onClose }) {
  const { getFullCatList, getTaskDefault } = useScheduler();
  const catOptions = getFullCatList().filter(c => !c.deleted).map(c => ({ value: c.id, label: c.label }));

  const [local, setLocal] = useState({
    durationMin:       override.durationMin     ?? task.unitMin,
    minResources:      override.minResources     ?? '',
    unitBasis:         override.unitBasis        ?? task.unitBasis ?? 'Fixed',
    color:             override.color            || task.color,
    cat:               override.cat              || task.cat,
    desc:              override.desc             ?? (task.desc || ''),
    // Custom tasks also expose code + name for editing
    code:              override.code             ?? task.code,
    name:              override.name             ?? task.name,
    expectedInstances: override.expectedInstances ?? task.expectedInstances ?? 1,
    countHours:        getTaskDefault(task.id).countHours,
  });

  function handleSave() {
    onSave(task.id, {
      durationMin:       Number(local.durationMin),
      minResources:      local.minResources !== '' ? Number(local.minResources) : undefined,
      unitBasis:         local.unitBasis,
      color:             local.color,
      cat:               local.cat,
      desc:              local.desc || undefined,
      expectedInstances: local.expectedInstances !== '' ? Number(local.expectedInstances) : undefined,
      countHours:        local.countHours,
      code:              local.code.trim() || task.code,
      name:              local.name.trim() || task.name,
    });
    onClose();
  }

  return (
    <Modal title={`Edit: ${task.name}`} onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Code + Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={editLabelStyle}>Code</label>
            <input value={local.code} maxLength={12} onChange={e => setLocal(p => ({ ...p, code: e.target.value }))} style={editInputStyle} />
          </div>
          <div>
            <label style={editLabelStyle}>Category</label>
            <select
              value={local.cat}
              onChange={e => setLocal(p => ({ ...p, cat: e.target.value }))}
              style={editInputStyle}
            >
              {catOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={editLabelStyle}>Full Name</label>
          <input value={local.name} onChange={e => setLocal(p => ({ ...p, name: e.target.value }))} style={editInputStyle} />
        </div>

        <div style={{ marginBottom: 2 }}>
          <label style={editLabelStyle}>Unit Basis</label>
          <select
            value={local.unitBasis}
            onChange={e => setLocal(p => ({ ...p, unitBasis: e.target.value }))}
            style={editInputStyle}
          >
            {UNIT_BASIS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

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

        {/* Count toward hours toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={local.countHours}
            onChange={e => setLocal(p => ({ ...p, countHours: e.target.checked }))}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--purple)' }}
          />
          <span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)' }}>Count toward scheduled hours</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--gray)', marginTop: 1 }}>
              Uncheck for unpaid breaks, optional events, etc.
            </span>
          </span>
        </label>

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
