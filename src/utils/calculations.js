/**
 * Resolve expected instance count for a task given current assumptions.
 * allRoleCount — total employee column count (built-in + extra columns added by user).
 */
export function getExpectedInstances(task, socpg, selpg, scCount, allRoleCount) {
  const roleCount = allRoleCount ?? 0;
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
 * Returns true if a task has relevant work to do given current assumptions.
 * Tasks whose Unit Basis is tied to an assumption (e.g. # SelPGs) are irrelevant
 * when that assumption is 0 — they should be hidden from the Pending list.
 */
export function isTaskRelevant(task, assumptions, scCount) {
  const ub = task.unitBasis || '';
  switch (ub) {
    case '# SelPGs':   return (assumptions?.selpg ?? 0) > 0;
    case '# SocPGs':   return (assumptions?.socpg ?? 0) > 0;
    case 'Total Dogs':
    case 'Dog Rooms':  return (assumptions?.dogs  ?? 0) > 0;
    case '# SCs':      return (scCount ?? 0) > 0;
    default:           return true; // Fixed, Per Employee, Cat Rooms, Cats, Total Rooms — always relevant
  }
}

/**
 * Get scheduling status for a task chip.
 * Counter is driven solely by Min Res/Unit (minResources), defaulting to 1.
 * expectedInstances has no influence on the counter — visibility is handled
 * separately via isTaskRelevant().
 */
export function getSchedulingStatus(task, schedule, socpg, selpg, scCount, allRoleCount, userTaskDefs) {
  const scheduled   = countTaskInSchedule(schedule, task.id, task.code);
  const override    = userTaskDefs?.[task.id];
  const overrideMin = override?.minResources === 99 ? allRoleCount : override?.minResources;
  const expected    = overrideMin ?? 1; // Min Res/Unit is the sole driver; default 1 if not set
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
 * Compute span metrics for a single role column.
 * Returns { startMin, endMin, nonCountedMins } or null if the role has no tasks.
 * This is the single source of truth — GridHeader's purple bar and ScheduleSummary
 * both call this function so they are guaranteed to stay in sync.
 *
 * @param {string}   roleId
 * @param {object}   schedule
 * @param {array}    taskLibrary
 * @param {function} getTaskDefault
 * @param {array}    [roles]  — optional; when provided, overnight roles are detected
 *                             from role config (shiftStart > shiftEnd) rather than
 *                             inferred from task positions. This prevents out-of-shift
 *                             tasks (dropped on grayed-out same-day cells) from
 *                             corrupting the displayed span.
 */
export function computeRoleSpan(roleId, schedule, taskLibrary, getTaskDefault, roles) {
  // Collect raw entries first so we can detect cross-midnight shifts before computing span.
  const entries = [];
  Object.entries(schedule).forEach(([key, task]) => {
    const rid      = key.split('|')[0];
    const startMin = Number(key.split('|')[1]);
    if (rid !== roleId) return;
    const dur     = Number(task.durationMin ?? (task.slots * 30));
    const libTask = taskLibrary?.find(t => t.code === task.code || t.id === task.taskId);
    const counts  = libTask && getTaskDefault ? (getTaskDefault(libTask.id)?.countHours !== false) : true;
    entries.push({ startMin, dur, counts });
  });
  if (entries.length === 0) return null;

  // Overnight cross-midnight detection.
  // Preferred: use role config when available — shiftStart > shiftEnd means overnight.
  // Fallback: infer from task positions (hasMorning + hasEvening).
  const role = roles?.find(r => r.id === roleId);
  const isOvernightRole = role ? (role.shiftStart > role.shiftEnd) : false;
  const hasMorning = entries.some(e => e.startMin <  6 * 60);
  const hasEvening = entries.some(e => e.startMin >= 18 * 60);
  const crossMidnight = isOvernightRole || (hasMorning && hasEvening);

  // Normalization boundary: for overnight roles use shiftStart (e.g. 9 pm = 1260 min);
  // for the task-position fallback path use noon (720 min) as before.
  // Any same-day startMin below this boundary is treated as next-day by adding 1440,
  // so out-of-shift tasks dropped in the daytime gray area don't skew the span.
  // Post-midnight tasks (startMin >= 1440) are already in next-day encoding — leave them.
  const normBoundary = isOvernightRole ? (role.shiftStart * 60) : (12 * 60);

  let minStart = Infinity, maxEnd = -Infinity, nonCountedMins = 0;
  entries.forEach(({ startMin, dur, counts }) => {
    const adj = (crossMidnight && startMin < 1440 && startMin < normBoundary)
      ? startMin + 1440
      : startMin;
    minStart = Math.min(minStart, adj);
    maxEnd   = Math.max(maxEnd, adj + dur);
    if (!counts) nonCountedMins += dur;
  });
  return { startMin: minStart, endMin: maxEnd, nonCountedMins };
}

/**
 * Sum span-based scheduled minutes across all eligible roles.
 * Eligible = includeInHrs !== false.
 * Used by computeSummary — the single authoritative span total.
 */
export function computeAllSpanMins(roles, schedule, taskLibrary, getTaskDefault) {
  let total = 0;
  (roles || []).forEach(role => {
    if (role.includeInHrs === false) return;
    // Pass the full roles array so computeRoleSpan can use role config for overnight detection.
    const span = computeRoleSpan(role.id, schedule, taskLibrary, getTaskDefault, roles);
    if (span) total += (span.endMin - span.startMin) - span.nonCountedMins;
  });
  return total;
}

/**
 * Compute full schedule summary.
 * countingSchedule — subset of schedule blocks that count toward hours
 *   (excludes breaks, optional events, etc. where countHours === false).
 * getTaskDefault — required; used by computeAllSpanMins to identify non-counting blocks.
 */
export function computeSummary({
  dogs, multipet, multipetCats, socpg, selpg,
  suites, cats, bungalows, scCount, schedule, countingSchedule, effectiveRoles,
  taskLibrary, userTaskDefs, sessionTaskDefs, skippedTasks, roleCount, derivedValues, assumptions,
  getTaskDefault,
}) {
  const rolesForHours = effectiveRoles ?? [];
  const eligibleRoles = rolesForHours.filter(r => r.includeInHrs !== false && (r.type === 'TM' || r.type === 'TL'));
  const hrsAvail = eligibleRoles.reduce((a, r) => a + (r.hours ?? 0), 0);

  // Span-based scheduled minutes — single source of truth via computeAllSpanMins.
  // This matches the purple bar totals shown in GridHeader exactly.
  const schedMins = computeAllSpanMins(rolesForHours, schedule, taskLibrary, getTaskDefault);
  const schedHrs  = schedMins / 60;

  // Open mins = gap within the scheduled span not covered by counted task blocks
  const countedTaskMins = Object.values(countingSchedule ?? schedule ?? {})
    .reduce((acc, t) => acc + Number(t.durationMin ?? (t.slots * 30)), 0);
  const openMins  = schedMins - countedTaskMins;
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
      // Exclude tasks where count_hours = false — they don't represent productive work time
      const countHours = override.countHours ?? task.countHours ?? true;
      if (!countHours) return;
      // Resolve effective unit min (custom tasks use durationMin)
      const effectiveUnitMin   = override.durationMin ?? task.durationMin ?? task.unitMin;
      const effectiveUnitBasis = override.unitBasis   ?? task.unitBasis   ?? 'Fixed';
      const mergedTask = { ...task, unitMin: effectiveUnitMin, unitBasis: effectiveUnitBasis };
      const duration     = computeTaskDuration(mergedTask, derivedValues, assumptions);
      const instancesLib = getExpectedInstances(task, assumptions?.socpg, assumptions?.selpg, derivedValues?.scCount ?? scCount, roleCount ?? 0);
      const overrideMin  = override.minResources === 99 ? (roleCount ?? 0) : override.minResources;
      const instances    = overrideMin ?? 1; // Min Res/Unit is the sole driver; default 1
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
