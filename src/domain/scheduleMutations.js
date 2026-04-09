import { resolveBlockHex } from '../data/palette.js';
import {
  doMerge,
  findNextFreeMinute,
  findOverlapInRange,
  freeTimeFrom,
  getBlockDurationMin,
  keyToRoleAndMin,
  makeKey,
  minutesToGridSlots,
} from '../utils/scheduling.js';

export function createScheduledBlock(task, durationMin, colorHex, extra = {}) {
  return {
    name: task.name,
    code: task.code,
    color: colorHex,
    slots: minutesToGridSlots(durationMin),
    durationMin,
    notes: task.notes || task.desc || '',
    ...(task.id ? { taskId: task.id } : {}),
    ...extra,
  };
}

function clearConflictFlags(block) {
  return {
    ...block,
    overflow: false,
    overlap: false,
  };
}

export function resolvePlacement({
  baseSchedule,
  sourceKey = null,
  roleId,
  startMin,
  task,
  durationMin,
  colorHex,
  roleConfigs,
}) {
  const existingKey = findOverlapInRange(baseSchedule, roleId, startMin, durationMin);

  if (!existingKey) {
    const nextSchedule = { ...baseSchedule };
    nextSchedule[makeKey(roleId, startMin)] = createScheduledBlock(task, durationMin, colorHex);
    return { type: 'placed', schedule: nextSchedule };
  }

  const existingTask = baseSchedule[existingKey];
  const existMergeCount = existingTask?.merged ? (existingTask.constituents?.length || 1) : 1;
  const { startMin: existStart } = keyToRoleAndMin(existingKey);
  const existDur = getBlockDurationMin(existingTask);
  const existEnd = existStart + existDur;

  let autoStart;
  let availableMin;
  if (existStart > startMin) {
    autoStart = startMin;
    availableMin = existStart - startMin;
  } else {
    autoStart = existEnd;
    availableMin = freeTimeFrom(baseSchedule, roleId, existingKey, existEnd, roleConfigs);
  }

  if (availableMin >= durationMin) {
    const nextSchedule = { ...baseSchedule };
    if (sourceKey) delete nextSchedule[sourceKey];
    nextSchedule[makeKey(roleId, autoStart)] = createScheduledBlock(task, durationMin, colorHex);
    return { type: 'placed', schedule: nextSchedule };
  }

  const freeMinutes = existStart > startMin
    ? existStart - startMin
    : freeTimeFrom(baseSchedule, roleId, existingKey, startMin, roleConfigs);

  return {
    type: 'conflict',
    conflictState: {
      baseSchedule,
      sourceKey,
      roleId,
      startMin,
      task,
      durationMin,
      colorHex,
      existingKey,
      existingTask,
      freeMinutes,
      canMerge: existMergeCount < 3,
      draggedTask: task,
      targetRoleId: roleId,
      targetStartMin: startMin,
    },
  };
}

export function mergeConflictSchedule(conflictState) {
  const {
    baseSchedule,
    roleId,
    task,
    durationMin,
    colorHex,
    existingKey,
    existingTask,
  } = conflictState;
  const { startMin: existStart } = keyToRoleAndMin(existingKey);
  const existDur = getBlockDurationMin(existingTask);
  const existConst = existingTask.merged
    ? existingTask.constituents
    : [{ code: existingTask.code, taskId: existingTask.taskId, name: existingTask.name, durationMin: existDur, color: existingTask.color }];
  const newConst = [...existConst, { code: task.code, taskId: task.id, name: task.name, durationMin, color: colorHex }];
  const codes = newConst.map((c) => c.code);
  const colors = newConst.map((c) => resolveBlockHex(c.color));
  const total = newConst.reduce((sum, c) => sum + c.durationMin, 0);
  return doMerge(baseSchedule, existingKey, codes, colors, total, newConst, existStart, roleId);
}

export function fitConflictSchedule(conflictState) {
  const { baseSchedule, roleId, startMin, task, durationMin, colorHex, freeMinutes } = conflictState;
  const fitDur = Math.max(10, Math.min(durationMin, freeMinutes));
  return {
    ...baseSchedule,
    [makeKey(roleId, startMin)]: createScheduledBlock(task, fitDur, colorHex),
  };
}

export function waterfallConflictSchedule(conflictState) {
  const { baseSchedule, roleId, startMin, task, durationMin, colorHex } = conflictState;
  return {
    ...baseSchedule,
    [makeKey(roleId, startMin)]: createScheduledBlock(task, durationMin, colorHex, { overflow: true }),
  };
}

export function editBlockSchedule(schedule, blockKey, { notes, durationMin, color }) {
  return {
    ...schedule,
    [blockKey]: {
      ...clearConflictFlags(schedule[blockKey]),
      notes,
      durationMin,
      slots: minutesToGridSlots(durationMin),
      color: resolveBlockHex(color) || schedule[blockKey].color,
    },
  };
}

export function removeBlockSchedule(schedule, blockKey) {
  const nextSchedule = { ...schedule };
  delete nextSchedule[blockKey];
  return nextSchedule;
}

export function splitBlockSchedule(schedule, blockKey, splitAt, roleConfigs) {
  const task = schedule[blockKey];
  if (!task) return schedule;

  const { roleId, startMin } = keyToRoleAndMin(blockKey);
  const nextSchedule = { ...schedule };
  delete nextSchedule[blockKey];

  if (task.merged && task.constituents) {
    let cursor = startMin;
    task.constituents.forEach((c, index) => {
      const free = findNextFreeMinute(nextSchedule, roleId, cursor, c.durationMin, roleConfigs) ?? cursor;
      nextSchedule[makeKey(roleId, free)] = {
        name: c.name,
        code: c.code,
        color: resolveBlockHex(c.color || task.colors?.[index]),
        slots: minutesToGridSlots(c.durationMin),
        durationMin: c.durationMin,
        notes: '',
        overflow: false,
        overlap: false,
      };
      cursor = free + c.durationMin;
    });
    return nextSchedule;
  }

  const totalDur = getBlockDurationMin(task);
  const firstDur = splitAt;
  const secondDur = totalDur - splitAt;
  nextSchedule[makeKey(roleId, startMin)] = {
    ...clearConflictFlags(task),
    durationMin: firstDur,
    slots: minutesToGridSlots(firstDur),
  };
  const naturalSplit = startMin + firstDur;
  const freeStart = findNextFreeMinute(nextSchedule, roleId, naturalSplit, secondDur, roleConfigs) ?? naturalSplit;
  nextSchedule[makeKey(roleId, freeStart)] = {
    ...clearConflictFlags(task),
    durationMin: secondDur,
    slots: minutesToGridSlots(secondDur),
  };
  return nextSchedule;
}

export function resizeBlockSchedule(schedule, blockKey, newMins) {
  return {
    ...schedule,
    [blockKey]: {
      ...clearConflictFlags(schedule[blockKey]),
      durationMin: newMins,
      slots: minutesToGridSlots(newMins),
      resizedMins: newMins,
    },
  };
}
