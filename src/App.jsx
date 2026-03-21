import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
  closestCenter,
} from '@dnd-kit/core';

import { useScheduler } from './context/SchedulerContext';
import {
  makeKey,
  keyToRoleAndMin,
  findTaskAtMinute,
  findOverlapInRange,
  findNextFreeMinute,
  freeTimeFrom,
  doMerge,
} from './utils/scheduling';
import { resolveBlockHex } from './data/palette';
import { computeTaskDuration } from './utils/calculations';

import Header from './components/Header/Header';
import LeftPanel from './components/LeftPanel/LeftPanel';
import GridBody from './components/Grid/GridBody';
import RightPanel from './components/RightPanel/RightPanel';

import ConflictModal from './components/Modals/ConflictModal';
import SplitModal from './components/Modals/SplitModal';
import EditModal from './components/Modals/EditModal';
import CreateTaskModal from './components/Modals/CreateTaskModal';
import SaveModal from './components/Modals/SaveModal';
import ValidationModal from './components/Modals/ValidationModal';
import ChecklistModal from './components/Modals/ChecklistModal';
import SetupOverlay from './components/Setup/SetupOverlay';

export default function App() {
  const {
    schedule, setSchedule,
    assumptions,
    scheduleLabel,
    userTaskDefs, setUserTaskDefs,
    sessionTaskDefs, setSessionTaskDefs,
    setExtraRoles, setColumnOrder,
    captureState,
    getDerivedValues,
    getUserTemplates, getUserPostings, getUserDrafts,
    saveUserTemplates, saveUserPostings, saveUserDrafts,
  } = useScheduler();

  // Modal state
  const [conflictState, setConflictState] = useState(null);
  const [splitKey, setSplitKey]           = useState(null);
  const [editKey, setEditKey]             = useState(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [createHereCtx, setCreateHereCtx] = useState(null); // { roleId, slotMin } when triggered from cell
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [saveMode, setSaveMode]           = useState(null); // 'draft'|'template'|'post'
  const [showValidate, setShowValidate]   = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showSetup, setShowSetup]         = useState(false);

  // Drag overlay label
  const [dragLabel, setDragLabel] = useState(null);

  // ─── Copy / Paste clipboard ───────────────────────────────────────────────
  // Stores a shallow copy of a task block so it can be pasted into any cell
  const [clipboard, setClipboard] = useState(null); // { task, colorHex }

  function handleCopy(blockKey) {
    const task = schedule[blockKey];
    if (!task) return;
    setClipboard({ task: { ...task }, colorHex: task.color });
  }

  function handlePasteAt(roleId, slotMin) {
    if (!clipboard) return;
    const { task, colorHex } = clipboard;
    const durationMin = task.durationMin ?? task.slots * 30;
    attemptPlaceInSchedule(schedule, null, roleId, slotMin, task, durationMin, colorHex);
  }

  // ─── dnd-kit sensors ──────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // ─── Drag start ───────────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    const data = active.data.current;
    if (data?.type === 'chip') setDragLabel(data.task.code);
    else if (data?.type === 'block') {
      const task = schedule[data.blockKey];
      setDragLabel(task?.code || data.blockKey);
    }
  }

  // ─── Drag end ─────────────────────────────────────────────────────────────
  function handleDragEnd({ active, over }) {
    setDragLabel(null);
    if (!over) return;

    const activeData = active.data.current;
    const overData   = over.data.current;

    // Dropped directly onto a visible task block — treat as a conflict at that block's position
    if (overData?.type === 'block-over' && activeData?.type === 'chip') {
      const { roleId, startMin } = overData;
      const libTask = activeData.task;
      const override = userTaskDefs[libTask.id] || {};
      const taskWithOverride = override.durationMin ? { ...libTask, unitMin: override.durationMin } : libTask;
      const durationMin = computeTaskDuration(taskWithOverride, getDerivedValues(), assumptions);
      const colorHex = resolveBlockHex(override.color || libTask.color);
      attemptPlaceInSchedule(schedule, null, roleId, startMin, libTask, durationMin, colorHex);
      return;
    }

    if (!overData || overData.type !== 'cell') return;

    const { roleId: targetRoleId, slotMin: targetSlotMin } = overData;

    // Case A: chip dragged from task library
    if (activeData.type === 'chip') {
      const libTask = activeData.task;
      const override = userTaskDefs[libTask.id] || {};
      // Merge override unitMin into task before computing duration (so variable-basis tasks still multiply correctly)
      const taskWithOverride = override.durationMin
        ? { ...libTask, unitMin: override.durationMin }
        : libTask;
      const durationMin = computeTaskDuration(taskWithOverride, getDerivedValues(), assumptions);
      const colorHex = resolveBlockHex(override.color || libTask.color);
      attemptPlaceInSchedule(schedule, null, targetRoleId, targetSlotMin, libTask, durationMin, colorHex);
      return;
    }

    // Case B: existing block moved
    if (activeData.type === 'block') {
      const blockKey = activeData.blockKey;
      const { roleId: srcRoleId, startMin: srcStartMin } = keyToRoleAndMin(blockKey);
      const task = schedule[blockKey];
      if (!task) return;

      if (srcRoleId === targetRoleId && srcStartMin === targetSlotMin) return;

      const durationMin = task.durationMin ?? task.slots * 30;
      const colorHex = resolveBlockHex(task.color);
      const withoutSelf = { ...schedule };
      delete withoutSelf[blockKey];
      attemptPlaceInSchedule(withoutSelf, blockKey, targetRoleId, targetSlotMin, task, durationMin, colorHex);
      return;
    }
  }

  // ─── Core placement logic ──────────────────────────────────────────────────
  function attemptPlaceInSchedule(baseSchedule, sourceKey, roleId, startMin, task, durationMin, colorHex) {
    const existingKey = findOverlapInRange(baseSchedule, roleId, startMin, durationMin);

    if (!existingKey) {
      // No overlap — place directly
      const newSchedule = { ...baseSchedule };
      const key = makeKey(roleId, startMin);
      newSchedule[key] = {
        name: task.name,
        code: task.code,
        color: colorHex,
        slots: Math.ceil(durationMin / 30),
        durationMin,
        notes: task.notes || task.desc || '',
      };
      setSchedule(newSchedule);
      return;
    }

    const existingTask = baseSchedule[existingKey];
    const existMergeCount = existingTask?.merged ? (existingTask.constituents?.length || 1) : 1;
    const { startMin: existStart } = keyToRoleAndMin(existingKey);
    // Free minutes = gap between drop point and the overlapping block (0 if direct overlap)
    const freeMinutes = existStart > startMin
      ? existStart - startMin
      : freeTimeFrom(baseSchedule, roleId, existingKey, startMin);

    // Always prompt on conflict — pass canMerge flag so modal can show Merge option
    setConflictState({
      baseSchedule, sourceKey, roleId, startMin, task, durationMin, colorHex,
      existingKey, existingTask, freeMinutes,
      canMerge: existMergeCount < 3,
      draggedTask: task, targetRoleId: roleId, targetStartMin: startMin,
    });
  }

  // ─── Conflict resolution ──────────────────────────────────────────────────
  function handleConflictMerge() {
    if (!conflictState) return;
    const { baseSchedule, roleId, startMin, task, durationMin, colorHex, existingKey, existingTask } = conflictState;
    const { startMin: existStart } = keyToRoleAndMin(existingKey);
    const existDur = existingTask.durationMin ?? existingTask.slots * 30;
    const existConst = existingTask.merged
      ? existingTask.constituents
      : [{ code: existingTask.code, name: existingTask.name, durationMin: existDur, color: existingTask.color }];
    const newConst = [...existConst, { code: task.code, name: task.name, durationMin, color: colorHex }];
    const codes  = newConst.map(c => c.code);
    const colors = newConst.map(c => resolveBlockHex(c.color));
    const total  = newConst.reduce((s, c) => s + c.durationMin, 0);
    setSchedule(doMerge(baseSchedule, existingKey, codes, colors, total, newConst, existStart, roleId));
    setConflictState(null);
  }

  function handleConflictFit() {
    if (!conflictState) return;
    const { baseSchedule, roleId, startMin, task, durationMin, colorHex, freeMinutes } = conflictState;
    const fitDur = Math.max(10, Math.min(durationMin, freeMinutes));
    const key = makeKey(roleId, startMin);
    setSchedule({
      ...baseSchedule,
      [key]: {
        name: task.name, code: task.code, color: colorHex,
        slots: Math.ceil(fitDur / 30), durationMin: fitDur,
        notes: task.notes || task.desc || '',
      },
    });
    setConflictState(null);
  }

  function handleConflictWaterfall() {
    if (!conflictState) return;
    const { baseSchedule, roleId, startMin, task, durationMin, colorHex } = conflictState;
    const key = makeKey(roleId, startMin);
    setSchedule({
      ...baseSchedule,
      [key]: {
        name: task.name, code: task.code, color: colorHex,
        slots: Math.ceil(durationMin / 30), durationMin,
        notes: task.notes || task.desc || '',
        overflow: true,
      },
    });
    setConflictState(null);
  }

  // ─── Block handlers ───────────────────────────────────────────────────────
  function handleEditSave(blockKey, { notes, durationMin, color }) {
    setSchedule(prev => ({
      ...prev,
      [blockKey]: {
        ...prev[blockKey],
        notes,
        durationMin,
        slots: Math.ceil(durationMin / 30),
        color: resolveBlockHex(color) || prev[blockKey].color,
      },
    }));
    setEditKey(null);
  }

  function handleRemove(blockKey) {
    setSchedule(prev => { const n = { ...prev }; delete n[blockKey]; return n; });
  }

  function handleSplitConfirm(blockKey, splitAt) {
    const task = schedule[blockKey];
    if (!task) return;
    const { roleId, startMin } = keyToRoleAndMin(blockKey);
    const newSchedule = { ...schedule };
    delete newSchedule[blockKey];

    if (task.merged && task.constituents) {
      // Split merged block back into constituents
      let cursor = startMin;
      task.constituents.forEach((c, i) => {
        const free = findNextFreeMinute(newSchedule, roleId, cursor, c.durationMin) ?? cursor;
        const key = makeKey(roleId, free);
        newSchedule[key] = {
          name: c.name, code: c.code,
          color: resolveBlockHex(c.color || task.colors?.[i]),
          slots: Math.ceil(c.durationMin / 30), durationMin: c.durationMin, notes: '',
        };
        cursor = free + c.durationMin;
      });
    } else {
      // Time-based split at splitAt minutes from start
      const totalDur = task.durationMin ?? task.slots * 30;
      const firstDur  = splitAt;
      const secondDur = totalDur - splitAt;
      const key1 = makeKey(roleId, startMin);
      newSchedule[key1] = {
        ...task, durationMin: firstDur, slots: Math.ceil(firstDur / 30),
      };
      const key2 = makeKey(roleId, startMin + firstDur);
      newSchedule[key2] = {
        ...task, durationMin: secondDur, slots: Math.ceil(secondDur / 30),
      };
    }

    setSchedule(newSchedule);
    setSplitKey(null);
  }

  function handleResize(blockKey, newMins) {
    setSchedule(prev => ({
      ...prev,
      [blockKey]: { ...prev[blockKey], durationMin: newMins, slots: Math.ceil(newMins / 30), resizedMins: newMins },
    }));
  }

  // ─── Save handlers ────────────────────────────────────────────────────────
  function handleSaveConfirm(name) {
    const state = captureState();
    if (saveMode === 'draft') {
      const existing = getUserDrafts();
      saveUserDrafts({ ...existing, [name]: state });
    } else if (saveMode === 'template') {
      const existing = getUserTemplates();
      saveUserTemplates({ ...existing, [name]: state });
    } else if (saveMode === 'post') {
      const existing = getUserPostings();
      saveUserPostings({ ...existing, [name]: state });
    }
    setSaveMode(null);
  }

  function handleCreateCustom(taskData) {
    // Custom tasks live only in the current session — they are NOT added to the
    // persistent userTaskDefs library. They are saved/restored with schedule drafts.
    setSessionTaskDefs(prev => ({ ...prev, [taskData.id]: taskData }));
    // If triggered from a cell right-click, immediately place the task there
    if (createHereCtx) {
      const { roleId, slotMin } = createHereCtx;
      const durationMin = taskData.durationMin ?? 30;
      const colorHex = resolveBlockHex(taskData.color);
      attemptPlaceInSchedule(schedule, null, roleId, slotMin, taskData, durationMin, colorHex);
      setCreateHereCtx(null);
    }
    setShowCreate(false);
  }

  function handleAddColumnSave(label, sub) {
    const id = `custom_${Date.now()}`;
    setExtraRoles(prev => [...prev, {
      id, label: label.trim(), sub: (sub || 'TM').trim(),
      type: 'TM', shiftStart: 5, shiftEnd: 22, hours: 8, custom: true,
    }]);
    setColumnOrder(prev => [...prev, id]);
    setShowAddColumn(false);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'var(--cream)',
    }}>
      <Header
        onSetup={() => setShowSetup(true)}
        onSaveDraft={() => setSaveMode('draft')}
        onSaveTemplate={() => setSaveMode('template')}
        onPostSchedule={() => setSaveMode('post')}
        onValidate={() => setShowValidate(true)}
        onChecklist={() => setShowChecklist(true)}
        onPrint={() => window.print()}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const pointer = pointerWithin(args);
          return pointer.length > 0 ? pointer : closestCenter(args);
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <LeftPanel />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <GridBody
              schedule={schedule}
              onEdit={setEditKey}
              onRemove={handleRemove}
              onSplit={setSplitKey}
              onResize={handleResize}
              onCopy={handleCopy}
              onPasteAt={handlePasteAt}
              hasClipboard={!!clipboard}
              onCreateHere={(roleId, slotMin) => { setCreateHereCtx({ roleId, slotMin }); setShowCreate(true); }}
              onAddColumn={() => setShowAddColumn(true)}
            />
          </div>

          <RightPanel onCreateCustom={() => setShowCreate(true)} />
        </div>

        <DragOverlay>
          {dragLabel && (
            <div style={{
              padding: '6px 12px', borderRadius: 6,
              background: 'var(--purple)', color: '#fff',
              fontSize: 12, fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
              boxShadow: '0 4px 16px rgba(62,42,126,0.3)',
              pointerEvents: 'none', opacity: 0.9,
            }}>
              {dragLabel}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      {conflictState && (
        <ConflictModal
          conflict={conflictState}
          onMerge={handleConflictMerge}
          onFit={handleConflictFit}
          onWaterfall={handleConflictWaterfall}
          onCancel={() => setConflictState(null)}
        />
      )}
      {splitKey && (
        <SplitModal
          blockKey={splitKey} task={schedule[splitKey]}
          onConfirm={(key, splitAt) => handleSplitConfirm(key, splitAt)} onClose={() => setSplitKey(null)}
        />
      )}
      {editKey && (
        <EditModal
          blockKey={editKey} task={schedule[editKey]}
          onSave={handleEditSave} onClose={() => setEditKey(null)}
        />
      )}
      {showCreate && (
        <CreateTaskModal onSave={handleCreateCustom} onClose={() => setShowCreate(false)} />
      )}
      {saveMode && (
        <SaveModal
          mode={saveMode}
          existingName={saveMode === 'template' ? scheduleLabel : null}
          onSave={handleSaveConfirm}
          onClose={() => setSaveMode(null)}
        />
      )}
      {showValidate && <ValidationModal onClose={() => setShowValidate(false)} />}
      {showChecklist && <ChecklistModal onClose={() => setShowChecklist(false)} />}
      {showSetup && <SetupOverlay onClose={() => setShowSetup(false)} />}
      {showAddColumn && (
        <AddColumnModal
          onSave={handleAddColumnSave}
          onClose={() => setShowAddColumn(false)}
        />
      )}
    </div>
  );
}

// ─── Add Column Modal ─────────────────────────────────────────────────────────
import Modal, { ModalFooter, Btn } from './components/Modals/Modal';
function AddColumnModal({ onSave, onClose }) {
  const [label, setLabel] = useState('');
  const [sub, setSub]     = useState('');
  return (
    <Modal title="Add Column" onClose={onClose}>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={labelStyle}>
          Column Label
          <input
            value={label} onChange={e => setLabel(e.target.value)} maxLength={12} autoFocus
            placeholder="e.g. SOC 3"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && label.trim() && onSave(label, sub)}
          />
        </label>
        <label style={labelStyle}>
          Sub-text
          <input
            value={sub} onChange={e => setSub(e.target.value)} maxLength={18}
            placeholder="e.g. TM  (defaults to TM)"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && label.trim() && onSave(label, sub)}
          />
        </label>
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={() => onSave(label, sub)} disabled={!label.trim()}>Add Column</Btn>
      </ModalFooter>
    </Modal>
  );
}

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, fontWeight: 600, color: 'var(--gray)',
  fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.03em', textTransform: 'uppercase',
};
const inputStyle = {
  padding: '8px 10px', border: '1px solid var(--gray-light)',
  borderRadius: 6, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
