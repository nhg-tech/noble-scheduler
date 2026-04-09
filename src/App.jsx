import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { apiSchedules, apiStaffing } from './api';
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
import { buildAssignmentWarnings } from './utils/staffingWarnings';

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
import SaveChooserModal from './components/Modals/SaveChooserModal';
import ValidationModal from './components/Modals/ValidationModal';
import ChecklistModal from './components/Modals/ChecklistModal';
import StaffingModal from './components/Modals/StaffingModal';
import VersionHistoryModal from './components/Modals/VersionHistoryModal';
import AssignmentWarningModal from './components/Modals/AssignmentWarningModal';
import StaffingReviewModal from './components/Modals/StaffingReviewModal';
import SetupOverlay from './components/Setup/SetupOverlay';

function getColumnsWithTasks(schedule) {
  return [...new Set(Object.keys(schedule).map((key) => key.split('|')[0]))];
}

export default function App() {
  const { can, logout } = useAuth();
  const {
    schedule, setSchedule,
    assumptions,
    scheduleLabel, setScheduleLabel,
    currentLoadedEntity, setCurrentLoadedEntity,
    userTaskDefs, sessionTaskDefs, setSessionTaskDefs,
    employeeAssignments, setEmployeeAssignments,
    setExtraRoles, setColumnOrder, restoreColumn,
    extraRoles,
    captureState,
    getDerivedValues,
    getEffectiveRoles, getDeletedRoles,
    getUserTemplates, getMasterTemplates, getUserPostings, getUserDrafts,
    applyState,
    saveUserPostings,
    apiSaveTemplate, apiSaveSchedule,
    skillsData,
    staffData,
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
  const canUseWorkflowTools = canEditCurrentSchedule || canPublishSchedules;
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
  const [showSaveChooser, setShowSaveChooser] = useState(false);
  const [saveMode, setSaveMode]           = useState(null); // 'draft'|'template'|'post'
  const [showValidate, setShowValidate]   = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showSetup, setShowSetup]         = useState(false);
  const [showStaffing, setShowStaffing]   = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPrint, setShowPrint]         = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [publishReviewState, setPublishReviewState] = useState(null);
  const [printOpts, setPrintOpts]         = useState({ paperSize: 'legal', inclSummary: true, inclAssumptions: true, excludedCols: [] });
  const [saveError, setSaveError]         = useState(null);
  const captureStateRef = useRef(captureState);
  const currentSnapshot = useMemo(() => JSON.stringify(captureState()), [captureState]);
  const [savedSnapshot, setSavedSnapshot] = useState(currentSnapshot);
  const hasUnsavedChanges = currentSnapshot !== savedSnapshot;

  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  const syncSavedSnapshot = useCallback(() => {
    window.requestAnimationFrame(() => {
      setSavedSnapshot(JSON.stringify(captureStateRef.current()));
    });
  }, []);

  const confirmIfUnsaved = useCallback((message = 'You have unsaved changes. Continue without saving?') => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function applyEmployeeAssignment(roleId, person) {
    setEmployeeAssignments(prev => ({
      ...prev,
      [roleId]: {
        staffId: person.id,
        employeeCode: person.employeeCode,
        firstName: person.firstName,
        lastName: person.lastName,
        role: person.role,
      },
    }));
  }

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
    } else if (data?.type === 'staff') {
      const fullName = `${data.staff.firstName || ''} ${data.staff.lastName || ''}`.trim() || 'Employee';
      setDragLabel(fullName);
      setDragMeta({ color: 'var(--purple-pale)', textColor: 'var(--purple)', isBlock: false });
    } else if (data?.type === 'block') {
      const task = schedule[data.blockKey];
      const colorHex = resolveBlockHex(task?.color || 'block-group');
      setDragLabel(task?.code || data.blockKey);
      setDragMeta({ color: colorHex, textColor: resolveBlockText(colorHex), isBlock: true });
    }
  }

  // ─── Drag end ─────────────────────────────────────────────────────────────
  async function handleDragEnd({ active, over }) {
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

    if (activeData?.type === 'staff' && overData?.type === 'staff-column') {
      const person = activeData.staff;
      const role = roleConfigs.find((entry) => entry.id === overData.roleId);
      try {
        const [availabilityRecords, exceptions] = await Promise.all([
          assumptions.date
            ? apiStaffing.getAvailability({
                staffId: person.id,
                startDate: assumptions.date,
                endDate: assumptions.date,
              })
            : Promise.resolve([]),
          apiStaffing.getExceptions({ staffId: person.id }),
        ]);
        const warnings = buildAssignmentWarnings({
          schedule,
          role,
          roleId: overData.roleId,
          person,
          taskDefs: userTaskDefs,
          skills: skillsData,
          availabilityRecords,
          exceptions,
          scheduleDate: assumptions.date,
        });
        if (warnings.length > 0) {
          setPendingAssignment({
            roleId: overData.roleId,
            roleLabel: role?.label || overData.roleId,
            person,
            warnings,
          });
        } else {
          applyEmployeeAssignment(overData.roleId, person);
        }
      } catch (err) {
        setSaveError(err.message || 'Failed to evaluate staffing warnings.');
      }
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
    setSchedule(prev => resizeBlockSchedule(prev, blockKey, newMins, roleConfigs));
  }

  async function buildPublishReview() {
    const columnsWithTasks = getColumnsWithTasks(schedule);
    const unassignedColumns = columnsWithTasks
      .filter((roleId) => !employeeAssignments[roleId])
      .map((roleId) => ({
        roleId,
        label: roleConfigs.find((role) => role.id === roleId)?.label || roleId,
      }));

    const uniqueStaffIds = [...new Set(
      columnsWithTasks
        .map((roleId) => employeeAssignments[roleId]?.staffId)
        .filter(Boolean)
    )];

    const staffingLookup = new Map();
    await Promise.all(uniqueStaffIds.map(async (staffId) => {
      const [availabilityRecords, exceptions] = await Promise.all([
        apiStaffing.getAvailability({
          staffId,
          startDate: assumptions.date,
          endDate: assumptions.date,
        }),
        apiStaffing.getExceptions({ staffId }),
      ]);
      staffingLookup.set(staffId, { availabilityRecords, exceptions });
    }));

    const assignmentIssues = columnsWithTasks.reduce((issues, roleId) => {
      const assignment = employeeAssignments[roleId];
      if (!assignment?.staffId) return issues;

      const person = staffData.find((entry) => String(entry.id) === String(assignment.staffId));
      const role = roleConfigs.find((entry) => entry.id === roleId);
      const roleLabel = role?.label || roleId;

      if (!person) {
        issues.push({
          roleId,
          roleLabel,
          employeeName: `${assignment.firstName || ''} ${assignment.lastName || ''}`.trim() || 'Assigned employee',
          warnings: [{
            type: 'staff',
            severity: 'strong',
            title: 'Assigned employee record missing',
            message: 'This schedule still references an employee who is no longer in the active staff list.',
          }],
        });
        return issues;
      }

      const staffingData = staffingLookup.get(person.id) || { availabilityRecords: [], exceptions: [] };
      const warnings = buildAssignmentWarnings({
        schedule,
        role,
        roleId,
        person,
        taskDefs: userTaskDefs,
        skills: skillsData,
        availabilityRecords: staffingData.availabilityRecords,
        exceptions: staffingData.exceptions,
        scheduleDate: assumptions.date,
      });

      if (warnings.length > 0) {
        issues.push({
          roleId,
          roleLabel,
          employeeName: `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Assigned employee',
          warnings,
        });
      }
      return issues;
    }, []);

    return {
      scheduleDate: assumptions.date,
      columnsWithTasks,
      assignedColumns: columnsWithTasks.filter((roleId) => !!employeeAssignments[roleId]),
      unassignedColumns,
      assignmentIssues,
      warningCount: assignmentIssues.reduce((count, issue) => count + issue.warnings.length, 0),
    };
  }

  async function handlePostScheduleClick() {
    setSaveError(null);
    if (!assumptions.date) {
      setSaveError('Select a schedule date before publishing a schedule.');
      return;
    }
    if (!canPublishSchedules) {
      setSaveError('You do not have permission to publish schedules.');
      return;
    }
    setPublishReviewState({ isLoading: true, review: null });
    try {
      const review = await buildPublishReview();
      setPublishReviewState({ isLoading: false, review });
    } catch (err) {
      setPublishReviewState(null);
      setSaveError(err.message || 'Failed to prepare the staffing review.');
    }
  }

  // ─── Save handlers ────────────────────────────────────────────────────────
  async function handleSaveConfirm(name, tplType) {
    const state = captureState();
    setSaveError(null);
    try {
      if (saveMode === 'draft') {
        if (!assumptions.date) throw new Error('Select a schedule date before saving a draft.');
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
        setSavedSnapshot(JSON.stringify(state));
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
        setSavedSnapshot(JSON.stringify(state));
      } else if (saveMode === 'post') {
        if (!assumptions.date) throw new Error('Select a schedule date before publishing a schedule.');
        if (!canPublishSchedules) throw new Error('You do not have permission to publish schedules.');
        const result = await apiSaveSchedule(
          name,
          state,
          'posted',
          currentLoadedEntity?.kind === 'schedule' && currentLoadedEntity?.status === 'posted'
            ? currentLoadedEntity
            : null
        );
        setCurrentLoadedEntity({
          kind: 'schedule',
          status: 'posted',
          id: result.id,
          name,
          versionNumber: result.version_number ?? result.versionNumber ?? 1,
          rootScheduleId: result.root_schedule_id ?? result.rootScheduleId ?? result.id,
        });
        setScheduleLabel(name);
        setSavedSnapshot(JSON.stringify(state));
      }
      setSaveMode(null);
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    }
  }

  async function handleRestorePublishedVersion(restored) {
    const full = await apiSchedules.getOne(restored.id);
    const postings = await apiSchedules.getPostings();
    saveUserPostings(postings);
    applyState(full);
    setCurrentLoadedEntity({
      kind: 'schedule',
      status: 'posted',
      id: full.id,
      name: full.name,
      versionNumber: full.versionNumber,
      rootScheduleId: full.rootScheduleId,
    });
    setScheduleLabel(full.name);
    setSavedSnapshot(JSON.stringify(full));
    setShowVersionHistory(false);
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

  function handleEditCustomTask(taskData) {
    if (!canEditCurrentSchedule || !editKey) return;
    const editedTask = schedule[editKey];
    if (!editedTask?.taskId) return;

    const normalizedColor = resolveBlockHex(taskData.color);
    const updatedTask = {
      ...taskData,
      color: normalizedColor,
      durationMin: Number(taskData.durationMin),
      unitMin: Number(taskData.durationMin),
      slots: Math.ceil(Number(taskData.durationMin) / 30),
    };

    setSessionTaskDefs((prev) => ({
      ...prev,
      [updatedTask.id]: updatedTask,
    }));

    setSchedule((prev) => {
      const next = { ...prev };
      Object.entries(prev).forEach(([key, block]) => {
        if (block.taskId !== updatedTask.id) return;
        next[key] = {
          ...block,
          name: updatedTask.name,
          code: updatedTask.code,
          color: normalizedColor,
          durationMin: updatedTask.durationMin,
          slots: Math.ceil(updatedTask.durationMin / 30),
        };
      });
      return next;
    });

    setEditKey(null);
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
      styleEl.textContent = `@page { size: ${size} landscape; margin: 0.2in; }`;

    window.print();
  }

  // Restore a session-hidden column — removes from hiddenColumns (transient state)
  function handleRestoreColumn(roleId) {
    restoreColumn(roleId);
    setShowAddColumn(false);
  }

  const editTask = editKey ? schedule[editKey] : null;
  const editTaskId = editTask?.taskId;
  const isEditingSessionCustomTask = !!(editTaskId && sessionTaskDefs[editTaskId] && !userTaskDefs[editTaskId]);
  const customEditInitialData = isEditingSessionCustomTask
    ? { ...sessionTaskDefs[editTaskId] }
    : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'var(--cream)',
    }}>
      <Header
        onSetup={() => canViewSetupPanel && setShowSetup(true)}
        onStaffing={() => canUseWorkflowTools && setShowStaffing(true)}
        onSave={() => (canCreateDraft || canSaveAnyTemplate) && setShowSaveChooser(true)}
        onPostSchedule={handlePostScheduleClick}
        onVersionHistory={() => isViewingPostedSchedule && setShowVersionHistory(true)}
        onValidate={() => setShowValidate(true)}
        onChecklist={() => setShowChecklist(true)}
        onPrint={() => setShowPrint(true)}
        canViewSetup={canViewSetupPanel}
        canViewStaffing={canUseWorkflowTools}
        canSave={canCreateDraft || canSaveAnyTemplate}
        canPostSchedule={canPublishSchedules}
        canViewVersionHistory={isViewingPostedSchedule}
        canValidate={canUseWorkflowTools}
        canChecklist={canUseWorkflowTools}
        canEditSchedule={canEditCurrentSchedule}
        onLogout={() => {
          if (!confirmIfUnsaved('You have unsaved changes. Sign out anyway?')) return;
          logout();
        }}
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
          <LeftPanel
            onBeforeReplaceSchedule={() => confirmIfUnsaved('You have unsaved changes. Load another schedule anyway?')}
            onAfterStateLoaded={syncSavedSnapshot}
          />

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
              employeeAssignments={employeeAssignments}
              onClearEmployeeAssignment={(roleId) => {
                setEmployeeAssignments(prev => {
                  const next = { ...prev };
                  delete next[roleId];
                  return next;
                });
              }}
              isReadOnly={!canEditCurrentSchedule}
            />
          </div>

          {canEditCurrentSchedule && <RightPanel onCreateCustom={() => setShowCreate(true)} />}
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
      {editKey && !isEditingSessionCustomTask && (
        <EditModal
          blockKey={editKey} task={schedule[editKey]}
          onSave={handleEditSave} onClose={() => setEditKey(null)}
        />
      )}
      {(showCreate || isEditingSessionCustomTask) && (
        <CreateTaskModal
          initialData={showCreate ? undefined : customEditInitialData}
          onSave={showCreate ? handleCreateCustom : handleEditCustomTask}
          onClose={() => {
            if (showCreate) setShowCreate(false);
            if (isEditingSessionCustomTask) setEditKey(null);
          }}
        />
      )}
        {saveMode && (
          <SaveModal
            mode={saveMode}
            scheduleDate={assumptions.date || ''}
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
      {showSaveChooser && (
        <SaveChooserModal
          canSaveDraft={canCreateDraft}
          canSaveTemplate={canSaveAnyTemplate}
          onChoose={(mode) => {
            setShowSaveChooser(false);
            setSaveMode(mode);
          }}
          onClose={() => setShowSaveChooser(false)}
        />
      )}
      {showValidate && <ValidationModal onClose={() => setShowValidate(false)} />}
      {showChecklist && <ChecklistModal onClose={() => setShowChecklist(false)} />}
      {showSetup && canViewSetupPanel && <SetupOverlay onClose={() => setShowSetup(false)} />}
      {showStaffing && canUseWorkflowTools && (
        <StaffingModal
          scheduleDate={assumptions.date}
          staffData={staffData}
          onClose={() => setShowStaffing(false)}
        />
      )}
      {showVersionHistory && isViewingPostedSchedule && currentLoadedEntity?.id && (
        <VersionHistoryModal
          scheduleId={currentLoadedEntity.id}
          scheduleName={currentLoadedEntity.name}
          onRestored={handleRestorePublishedVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
      {publishReviewState && (
        <StaffingReviewModal
          review={publishReviewState.review}
          isLoading={publishReviewState.isLoading}
          onClose={() => setPublishReviewState(null)}
          onContinue={() => {
            setPublishReviewState(null);
            setSaveMode('post');
          }}
        />
      )}
      {showPrint && (
        <PrintModal
          onPrint={handlePrint}
          onClose={() => setShowPrint(false)}
        />
      )}
      {pendingAssignment && (
        <AssignmentWarningModal
          employeeName={`${pendingAssignment.person.firstName || ''} ${pendingAssignment.person.lastName || ''}`.trim()}
          columnLabel={pendingAssignment.roleLabel}
          warnings={pendingAssignment.warnings}
          onConfirm={() => {
            applyEmployeeAssignment(pendingAssignment.roleId, pendingAssignment.person);
            setPendingAssignment(null);
          }}
          onClose={() => setPendingAssignment(null)}
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
