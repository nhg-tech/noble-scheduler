import { useState } from 'react';
import { flushSync } from 'react-dom';
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
import { useAuth } from './context/AuthContext';
import {
  keyToRoleAndMin,
  getBlockDurationMin,
} from './utils/scheduling';
import { resolveBlockHex, resolveBlockText } from './data/palette';
import { computeTaskDuration } from './utils/calculations';
import {
  editBlockSchedule,
  fitConflictSchedule,
  mergeConflictSchedule,
  removeBlockSchedule,
  resolvePlacement,
  resizeBlockSchedule,
  splitBlockSchedule,
  waterfallConflictSchedule,
} from './domain/scheduleMutations';
import { ACTIONS, RESOURCES, canViewAnySetup } from './permissions';

import Header from './components/Header/Header';
import LeftPanel from './components/LeftPanel/LeftPanel';
import GridBody from './components/Grid/GridBody';
import RightPanel from './components/RightPanel/RightPanel';

import PrintModal from './components/Print/PrintModal';
import PrintLayout from './components/Print/PrintLayout';

import ConflictModal from './components/Modals/ConflictModal';
import SplitModal from './components/Modals/SplitModal';
import EditModal from './components/Modals/EditModal';
import CreateTaskModal from './components/Modals/CreateTaskModal';
import SaveModal from './components/Modals/SaveModal';
import ValidationModal from './components/Modals/ValidationModal';
import ChecklistModal from './components/Modals/ChecklistModal';
import SetupOverlay from './components/Setup/SetupOverlay';

export default function App() {
  const { can } = useAuth();
  const {
    schedule, setSchedule,
    assumptions,
    scheduleLabel, setScheduleLabel,
    currentLoadedEntity, setCurrentLoadedEntity,
    userTaskDefs, setSessionTaskDefs,
    setExtraRoles, setColumnOrder, restoreColumn,
    extraRoles,
    captureState,
    getDerivedValues,
    getEffectiveRoles, getDeletedRoles,
    getUserTemplates, getMasterTemplates, getUserPostings, getUserDrafts,
    apiSaveTemplate, apiSaveSchedule,
  } = useScheduler();

  const roleConfigs = [...getEffectiveRoles(), ...getDeletedRoles(), ...extraRoles];
  const masterTemplateNames = Object.keys(getMasterTemplates());
  const userTemplateNames = Object.keys(getUserTemplates());
  const draftNames = Object.keys(getUserDrafts());
  const postingNames = Object.keys(getUserPostings());

  const loadedTemplateName = currentLoadedEntity?.kind === 'template'
    ? currentLoadedEntity.name
    : masterTemplateNames.includes(scheduleLabel)
      ? scheduleLabel
      : userTemplateNames.includes(scheduleLabel)
        ? scheduleLabel
        : null;

  const loadedTemplateScope = currentLoadedEntity?.kind === 'template'
    ? currentLoadedEntity.scope
    : masterTemplateNames.includes(scheduleLabel)
      ? 'master'
      : userTemplateNames.includes(scheduleLabel)
        ? 'user'
        : null;

  const loadedDraftName = currentLoadedEntity?.kind === 'schedule' && currentLoadedEntity?.status === 'draft'
    ? currentLoadedEntity.name
    : draftNames.includes(scheduleLabel)
      ? scheduleLabel
      : null;

  const loadedPostingName = currentLoadedEntity?.kind === 'schedule' && currentLoadedEntity?.status === 'posted'
    ? currentLoadedEntity.name
    : postingNames.includes(scheduleLabel)
      ? scheduleLabel
      : null;

  const canViewSetupPanel = canViewAnySetup(can);
  const canCreateDraft = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.CREATE);
  const canEditDailySchedules = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.EDIT);
  const canCreateUserTemplate = can(RESOURCES.USER_TEMPLATES, ACTIONS.CREATE);
  const canCreateMasterTemplate = can(RESOURCES.MASTER_TEMPLATES, ACTIONS.CREATE);
  const canPublishSchedules = can(RESOURCES.PUBLISHED_SCHEDULES, ACTIONS.PUBLISH);
  const canEditPublishedSchedules = can(RESOURCES.PUBLISHED_SCHEDULES, ACTIONS.EDIT);

  const isViewingPostedSchedule = currentLoadedEntity?.kind === 'schedule' && currentLoadedEntity?.status === 'posted';
  const canEditCurrentSchedule = isViewingPostedSchedule ? canEditPublishedSchedules : canEditDailySchedules;
  const canSaveAnyTemplate = canCreateUserTemplate || canCreateMasterTemplate;
  const allowedTemplateTypes = [
    ...(canCreateMasterTemplate ? ['master'] : []),
    ...(canCreateUserTemplate ? ['my'] : []),
  ];

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
  const [showPrint, setShowPrint]         = useState(false);
  const [printOpts, setPrintOpts]         = useState({ paperSize: 'legal', inclSummary: true, inclAssumptions: true, excludedCols: [] });
  const [saveError, setSaveError]         = useState(null);

  // Drag overlay label + meta
  const [dragLabel, setDragLabel] = useState(null);
  const [dragMeta,  setDragMeta]  = useState(null); // { color, textColor, isBlock }

  // ─── Copy / Paste clipboard ───────────────────────────────────────────────
  // Stores a shallow copy of a task block so it can be pasted into any cell
  const [clipboard, setClipboard] = useState(null); // { task, colorHex }

  function handleCopy(blockKey) {
    if (!canEditCurrentSchedule) return;
    const task = schedule[blockKey];
    if (!task) return;
    setClipboard({ task: { ...task }, colorHex: task.color });
  }

  function handlePasteAt(roleId, slotMin) {
    if (!canEditCurrentSchedule) return;
    if (!clipboard) return;
    const { task, colorHex } = clipboard;
    const durationMin = getBlockDurationMin(task);
    attemptPlaceInSchedule(schedule, null, roleId, slotMin, task, durationMin, colorHex);
  }

  // ─── dnd-kit sensors ──────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // ─── Drag start ───────────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    if (!canEditCurrentSchedule) return;
    const data = active.data.current;
    if (data?.type === 'chip') {
      const override = userTaskDefs[data.task.id] || {};
      const colorHex = resolveBlockHex(override.color || data.task.color);
      setDragLabel(data.task.code);
      setDragMeta({ color: colorHex, textColor: resolveBlockText(colorHex), isBlock: false });
    } else if (data?.type === 'block') {
      const task = schedule[data.blockKey];
      const colorHex = resolveBlockHex(task?.color || 'block-group');
      setDragLabel(task?.code || data.blockKey);
      setDragMeta({ color: colorHex, textColor: resolveBlockText(colorHex), isBlock: true });
    }
  }

  // ─── Drag end ─────────────────────────────────────────────────────────────
  function handleDragEnd({ active, over }) {
    if (!canEditCurrentSchedule) return;
    setDragLabel(null);
    setDragMeta(null);
    if (!over) return;

    const activeData = active.data.current;
    const overData   = over.data.current;

    // Dropped directly onto a visible task block — treat as a conflict at that block's position
    if (overData?.type === 'block-over' && activeData?.type === 'chip') {
      const { roleId, startMin } = overData;
      const libTask = activeData.task;
      const override = userTaskDefs[libTask.id] || {};
      const taskWithOverride = override.durationMin ? { ...libTask, unitMin: Number(override.durationMin) } : libTask;
      const durationMin = Number(computeTaskDuration(taskWithOverride, getDerivedValues(), assumptions));
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
        ? { ...libTask, unitMin: Number(override.durationMin) }
        : libTask;
      const durationMin = Number(computeTaskDuration(taskWithOverride, getDerivedValues(), assumptions));
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

      const durationMin = getBlockDurationMin(task);
      const colorHex = resolveBlockHex(task.color);
      const withoutSelf = { ...schedule };
      delete withoutSelf[blockKey];
      attemptPlaceInSchedule(withoutSelf, blockKey, targetRoleId, targetSlotMin, task, durationMin, colorHex);
      return;
    }
  }

  // ─── Core placement logic ──────────────────────────────────────────────────
  function attemptPlaceInSchedule(baseSchedule, sourceKey, roleId, startMin, task, durationMin, colorHex) {
    const result = resolvePlacement({
      baseSchedule,
      sourceKey,
      roleId,
      startMin,
      task,
      durationMin,
      colorHex,
      roleConfigs,
    });
    if (result.type === 'placed') {
      setSchedule(result.schedule);
      return;
    }
    setConflictState(result.conflictState);
  }

  // ─── Conflict resolution ──────────────────────────────────────────────────
  function handleConflictMerge() {
    if (!canEditCurrentSchedule) return;
    if (!conflictState) return;
    setSchedule(mergeConflictSchedule(conflictState));
    setConflictState(null);
  }

  function handleConflictFit() {
    if (!canEditCurrentSchedule) return;
    if (!conflictState) return;
    setSchedule(fitConflictSchedule(conflictState));
    setConflictState(null);
  }

  function handleConflictWaterfall() {
    if (!canEditCurrentSchedule) return;
    if (!conflictState) return;
    setSchedule(waterfallConflictSchedule(conflictState));
    setConflictState(null);
  }

  // ─── Block handlers ───────────────────────────────────────────────────────
  function handleEditSave(blockKey, { notes, durationMin, color }) {
    if (!canEditCurrentSchedule) return;
    setSchedule(prev => editBlockSchedule(prev, blockKey, { notes, durationMin, color }));
    setEditKey(null);
  }

  function handleRemove(blockKey) {
    if (!canEditCurrentSchedule) return;
    setSchedule(prev => removeBlockSchedule(prev, blockKey));
  }

  function handleSplitConfirm(blockKey, splitAt) {
    if (!canEditCurrentSchedule) return;
    setSchedule(prev => splitBlockSchedule(prev, blockKey, splitAt, roleConfigs));
    setSplitKey(null);
  }

  function handleResize(blockKey, newMins) {
    if (!canEditCurrentSchedule) return;
    setSchedule(prev => resizeBlockSchedule(prev, blockKey, newMins));
  }

  // ─── Save handlers ────────────────────────────────────────────────────────
  async function handleSaveConfirm(name, tplType) {
    const state = captureState();
    setSaveError(null);
    try {
      if (saveMode === 'draft') {
        if (!canCreateDraft) throw new Error('You do not have permission to save drafts.');
        const result = await apiSaveSchedule(
          name,
          state,
          'draft',
          currentLoadedEntity?.kind === 'schedule' && currentLoadedEntity?.status === 'draft'
            ? currentLoadedEntity
            : null
        );
        setCurrentLoadedEntity({ kind: 'schedule', status: 'draft', id: result.id, name });
        setScheduleLabel(name);
      } else if (saveMode === 'template') {
        if (tplType === 'master' && !canCreateMasterTemplate) {
          throw new Error('You do not have permission to save master templates.');
        }
        if (tplType !== 'master' && !canCreateUserTemplate) {
          throw new Error('You do not have permission to save personal templates.');
        }
        const type = tplType === 'master' ? 'master' : 'user';
        const result = await apiSaveTemplate(name, state, type);
        setCurrentLoadedEntity({ kind: 'template', scope: type, id: result.id, name });
        setScheduleLabel(name);
      } else if (saveMode === 'post') {
        if (!canPublishSchedules) throw new Error('You do not have permission to publish schedules.');
        const result = await apiSaveSchedule(
          name,
          state,
          'posted',
          currentLoadedEntity?.kind === 'schedule' && currentLoadedEntity?.status === 'posted'
            ? currentLoadedEntity
            : null
        );
        setCurrentLoadedEntity({ kind: 'schedule', status: 'posted', id: result.id, name });
        setScheduleLabel(name);
      }
      setSaveMode(null);
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    }
  }

  function handleCreateCustom(taskData) {
    if (!canEditCurrentSchedule) return;
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
    if (!canEditCurrentSchedule) return;
    const id = `custom_${Date.now()}`;
    setExtraRoles(prev => [...prev, {
      id, label: label.trim(), sub: (sub || 'TM').trim(),
      type: 'TM', shiftStart: 5, shiftEnd: 22, hours: 8, custom: true,
    }]);
    setColumnOrder(prev => [...prev, id]);
    setShowAddColumn(false);
  }

  // ─── Print ────────────────────────────────────────────────────────────────
  function handlePrint(opts) {
    // flushSync ensures React synchronously re-renders PrintLayout with the new opts
    // before window.print() reads the DOM.
    flushSync(() => setPrintOpts(opts));

    // Inject @page rule with the selected paper size (landscape)
    let styleEl = document.getElementById('noble-print-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'noble-print-style';
      document.head.appendChild(styleEl);
    }
    const size = opts.paperSize === 'letter' ? 'letter' : 'legal';
    styleEl.textContent = `@page { size: ${size} landscape; margin: 0.4in; }`;

    window.print();
  }

  // Restore a session-hidden column — removes from hiddenColumns (transient state)
  function handleRestoreColumn(roleId) {
    restoreColumn(roleId);
    setShowAddColumn(false);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'var(--cream)',
    }}>
      <Header
        onSetup={() => canViewSetupPanel && setShowSetup(true)}
        onSaveDraft={() => canCreateDraft && setSaveMode('draft')}
        onSaveTemplate={() => canSaveAnyTemplate && setSaveMode('template')}
        onPostSchedule={() => canPublishSchedules && setSaveMode('post')}
        onValidate={() => setShowValidate(true)}
        onChecklist={() => setShowChecklist(true)}
        onPrint={() => setShowPrint(true)}
        canViewSetup={canViewSetupPanel}
        canSaveDraft={canCreateDraft}
        canSaveTemplate={canSaveAnyTemplate}
        canPostSchedule={canPublishSchedules}
        canEditSchedule={canEditCurrentSchedule}
      />
      {saveError && (
        <div style={{
          padding: '10px 16px',
          background: '#FDECEC',
          borderBottom: '1px solid #F5C2C7',
          color: '#7F1D1D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
          flexShrink: 0,
        }}>
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#7F1D1D',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

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
              isReadOnly={!canEditCurrentSchedule}
            />
          </div>

          <RightPanel onCreateCustom={() => setShowCreate(true)} />
        </div>

        <DragOverlay dropAnimation={null}>
          {dragLabel && dragMeta && (
            <div style={{
              padding: '5px 10px', borderRadius: 6,
              background: dragMeta.color,
              color: dragMeta.textColor,
              fontSize: 11, fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              pointerEvents: 'none', opacity: 0.92,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
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
            existingName={
              saveMode === 'template'
              ? loadedTemplateName
              : saveMode === 'draft'
                ? loadedDraftName
                : saveMode === 'post'
                  ? loadedPostingName
                  : null
          }
          existingScope={
            saveMode === 'template'
              ? loadedTemplateScope
              : saveMode === 'draft' && loadedDraftName
                ? 'draft'
                : saveMode === 'post' && loadedPostingName
                  ? 'posted'
                  : null
          }
          initialTemplateType={
            saveMode === 'template'
              ? (loadedTemplateScope === 'user' ? 'my' : loadedTemplateScope)
              : null
          }
          existingNames={
            saveMode === 'template'
              ? {
                  master: masterTemplateNames,
                  my: userTemplateNames,
                }
              : saveMode === 'draft'
                ? draftNames
                : postingNames
          }
          allowedTemplateTypes={allowedTemplateTypes}
          onSave={handleSaveConfirm}
          onClose={() => setSaveMode(null)}
        />
      )}
      {showValidate && <ValidationModal onClose={() => setShowValidate(false)} />}
      {showChecklist && <ChecklistModal onClose={() => setShowChecklist(false)} />}
      {showSetup && canViewSetupPanel && <SetupOverlay onClose={() => setShowSetup(false)} />}
      {showPrint && (
        <PrintModal
          onPrint={handlePrint}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Always in DOM so @media print can reveal it */}
      <PrintLayout opts={printOpts} />

      {showAddColumn && (
        <AddColumnModal
          onSave={handleAddColumnSave}
          onRestore={handleRestoreColumn}
          onClose={() => setShowAddColumn(false)}
        />
      )}
    </div>
  );
}

// ─── Add Column Modal ─────────────────────────────────────────────────────────
import Modal, { ModalFooter, Btn } from './components/Modals/Modal';
function AddColumnModal({ onSave, onRestore, onClose }) {
  const { getEffectiveRoles, hiddenColumns } = useScheduler();
  const [label, setLabel] = useState('');
  const [sub, setSub]     = useState('');

  // Built-in / Role Config roles that are session-hidden (can be restored)
  const hiddenRoles = getEffectiveRoles().filter(r => hiddenColumns.has(r.id));

  return (
    <Modal title="Add Column" onClose={onClose}>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Restore section — only shown when columns are hidden */}
        {hiddenRoles.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Restore hidden column
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hiddenRoles.map(r => (
                <button
                  key={r.id}
                  onClick={() => onRestore(r.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 6,
                    border: '1.5px solid var(--purple-light)',
                    background: 'var(--purple-pale)',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12, fontWeight: 600, color: 'var(--purple)',
                    lineHeight: 1.3,
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--purple)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--purple-pale)'; e.currentTarget.style.color = 'var(--purple)'; }}
                >
                  <div>{r.label}</div>
                  {r.sub && <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{r.sub}</div>}
                </button>
              ))}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--gray-light)', margin: '12px 0 0' }} />
          </div>
        )}

        {/* New column form */}
        <label style={labelStyle}>
          New Column Label
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
