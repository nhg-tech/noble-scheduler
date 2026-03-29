import { ROLES } from '../data/roles';
import { TASK_LIBRARY } from '../data/taskLibrary';

/**
 * Resolve expected instance count for a task given current assumptions.
 * allRoleCount — optional total employee column count (built-in + extra columns added by user).
 * When provided, tasks with expectedInstances:'roles' or the sentinel value 99 resolve
 * to this dynamic count rather than the static ROLES array length.
 */
export function getExpectedInstances(task, socpg, selpg, scCount, allRoleCount) {
  const defaultRoleCount = ROLES.filter(r => r.type === 'TM' || r.type === 'TL' || r.type === 'PAW').length;
  const roleCount = allRoleCount ?? defaultRoleCount;
  const ei = task.expectedInstances;
  if (ei === 'socpg*2') return socpg * 2;
  if (ei === 'selpg*2') return selpg * 2;
  if (ei === 'socpg')   return socpg;
  if (ei === 'selpg')   return selpg;
  if (ei === 'sc')      return scCount;
  if (ei === 'roles')   return roleCount;
  if (ei === 99)        return roleCount; // 99 = sentinel meaning "one per employee column"
  return typeof ei === 'number' ? ei : 1;
}

/**
 * Count how many times a task code appears in the schedule (including merged blocks).
 */
// Match by unique taskId when available; fall back to code for older saved blocks
// that pre-date taskId storage. This prevents collisions between tasks that share
// a display code or whose code is a prefix of another task's code.
export function countTaskInSchedule(schedule, taskId, taskCode) {
  let count = 0;
  Object.values(schedule).forEach(t => {
    if (t.merged) {
      if (t.taskIds && t.taskIds.length > 0) {
        count += t.taskIds.filter(id => id === taskId).length;
      } else if (t.codes) {
        count += t.codes.filter(c => c === taskCode).length;
      }
    } else {
      count += t.taskId ? (t.taskId === taskId ? 1 : 0) : (t.code === taskCode ? 1 : 0);
    }
  });
  return count;
}

/**
 * Get scheduling status for a task chip.
 * allRoleCount  — optional total employee column count for dynamic 'roles'/99 resolution.
 * userTaskDefs  — optional user overrides; when supplied, minResources overrides expectedInstances.
 */
export function getSchedulingStatus(task, schedule, socpg, selpg, scCount, allRoleCount, userTaskDefs) {
  const scheduled     = countTaskInSchedule(schedule, task.id, task.code);
  const expectedLib   = getExpectedInstances(task, socpg, selpg, scCount, allRoleCount);
  const override      = userTaskDefs?.[task.id];
  const overrideMin   = override?.minResources === 99 ? allRoleCount : override?.minResources;
  const expected      = overrideMin != null ? overrideMin : expectedLib;
  return {
    scheduled,
    expected,
    done:    scheduled >= expected,
    partial: scheduled > 0 && scheduled < expected,
  };
}

/**
 * Compute the appropriate total duration (minutes) for a task based on its
 * unitBasis and the current derived values / assumptions.
 * Returns unitMin directly for fixed or per-instance tasks.
 */
// Canonical Unit Basis labels — used in task library, SetupOverlay dropdown, and here.
export const UNIT_BASIS_OPTIONS = [
  'Fixed',
  'Total Dogs',
  'Dog Rooms',
  '# SocPGs',
  '# SelPGs',
  '# SCs',
  'Cats',
  'Cat Rooms',
  'Total Rooms',
  'Per Employee',
];

export function computeTaskDuration(task, derivedValues, assumptions) {
  const { suites = 0, bungalows = 0, scCount = 0, cats = 0, totalRooms = 0 } = derivedValues || {};
  const socpg = assumptions?.socpg || 0;
  const selpg = assumptions?.selpg || 0;
  const dogs  = assumptions?.dogs  || 0;
  const ub    = task.unitBasis || '';
  const um    = Number(task.unitMin) || (task.slots || 1) * 30;

  switch (ub) {
    case 'Total Dogs':   return um * dogs;
    case 'Dog Rooms':    return um * suites;
    case '# SocPGs':     return um * Math.max(1, socpg);
    case '# SelPGs':     return um * Math.max(1, selpg);
    case '# SCs':        return um * scCount;
    case 'Cats':         return um * cats;
    case 'Cat Rooms':    return um * bungalows;
    case 'Total Rooms':  return um * totalRooms;
    case 'Per Employee': return um;   // fixed per drop; chip counter uses employee count
    default:             return um;   // 'Fixed' + any unrecognised legacy values
  }
}

/**
 * Compute full schedule summary.
 * countingSchedule — optional subset of schedule blocks that count toward hours
 *   (excludes breaks, optional events, etc. where countHours === false).
 *   When omitted, all blocks in schedule count.
 */
export function computeSummary({
  dogs, multipet, multipetCats, socpg, selpg,
  suites, cats, bungalows, scCount, schedule, countingSchedule, effectiveRoles,
  taskLibrary, userTaskDefs, sessionTaskDefs, skippedTasks, roleCount, derivedValues, assumptions,
  schedMinsOverride,
}) {
  // Use effectiveRoles (from Role Config) if provided, otherwise fall back to raw ROLES
  const rolesForHours = effectiveRoles ?? ROLES;
  const eligibleRoles = rolesForHours.filter(r => r.includeInHrs !== false && (r.type === 'TM' || r.type === 'TL'));
  const hrsAvail = eligibleRoles.reduce((a, r) => a + (r.hours ?? 0), 0);

  // If a span-based pre-computed value is provided (from the caller), use it;
  // otherwise fall back to summing counted task durations.
  let schedMins;
  if (schedMinsOverride !== undefined) {
    schedMins = schedMinsOverride;
  } else {
    const hrsSource = countingSchedule ?? schedule;
    schedMins = 0;
    Object.values(hrsSource).forEach(t => { schedMins += Number(t.durationMin ?? (t.slots * 30)); });
  }
  const schedHrs  = schedMins / 60;
  const openMins  = (hrsAvail * 60) - schedMins;
  const openSlots = Math.round(openMins / 30);

  // Est. time required — driven by task library
  let reqMins = 0;
  if (taskLibrary) {
    const allTasks = [
      ...taskLibrary,
      ...Object.values(sessionTaskDefs || {}),
      // User-created default tasks: in userTaskDefs but not in taskLibrary or sessionTaskDefs
      ...Object.entries(userTaskDefs || {})
        .filter(([id, t]) => !taskLibrary.find(lib => lib.id === id) && !sessionTaskDefs?.[id] && !t.hidden)
        .map(([, t]) => t),
    ];
    allTasks.forEach(task => {
      if (skippedTasks?.has(task.id)) return;
      const override = userTaskDefs?.[task.id] || {};
      if (override.hidden) return;
      // Resolve effective unit min (custom tasks use durationMin)
      const effectiveUnitMin   = override.durationMin ?? task.durationMin ?? task.unitMin;
      const effectiveUnitBasis = override.unitBasis   ?? task.unitBasis   ?? 'Fixed';
      const mergedTask = { ...task, unitMin: effectiveUnitMin, unitBasis: effectiveUnitBasis };
      const duration     = computeTaskDuration(mergedTask, derivedValues, assumptions);
      const instancesLib = getExpectedInstances(task, assumptions?.socpg, assumptions?.selpg, derivedValues?.scCount ?? scCount, roleCount ?? 0);
      const overrideMin  = override.minResources === 99 ? (roleCount ?? 0) : override.minResources;
      const instances    = overrideMin != null ? overrideMin : instancesLib;
      if (duration > 0 && instances > 0) reqMins += duration * instances;
    });
  }
  const reqHrs = reqMins / 60;

  const delta = schedMins - reqMins;

  return {
    hrsAvail,
    schedHrs,
    schedMins,
    openSlots,
    openMins,
    reqHrs,
    reqMins,
    delta,
    missing: [],
    taskCount: Object.values(schedule).length,
  };
}
