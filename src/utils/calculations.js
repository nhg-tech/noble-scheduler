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
export function countTaskInSchedule(schedule, code) {
  let count = 0;
  Object.values(schedule).forEach(t => {
    if (t.merged && t.codes) {
      count += t.codes.filter(c => c === code || c.startsWith(code)).length;
    } else if (t.code === code || (t.code && t.code.startsWith(code))) {
      count++;
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
  const scheduled     = countTaskInSchedule(schedule, task.code);
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
  const um    = task.unitMin || (task.slots || 1) * 30;

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
}) {
  // Use effectiveRoles (from Role Config) if provided, otherwise fall back to raw ROLES
  const rolesForHours = effectiveRoles ?? ROLES;
  const eligibleRoles = rolesForHours.filter(r => r.type === 'TM' || r.type === 'TL');
  const hrsAvail = eligibleRoles.reduce((a, r) => a + (r.hours ?? 0), 0);

  const hrsSource = countingSchedule ?? schedule;
  let schedMins = 0;
  Object.values(hrsSource).forEach(t => { schedMins += t.durationMin ?? (t.slots * 30); });
  const schedHrs  = schedMins / 60;
  const openMins  = (hrsAvail * 60) - schedMins;
  const openSlots = Math.round(openMins / 30);

  // Time required estimate
  const brftDin  = suites * 3 * 2;
  const lun      = Math.min(suites * 1, 60);
  const hk       = suites * 3;
  const pfSuites = Math.round(scCount * (1 - multipet / 100));
  const sc1sc4   = pfSuites * 5 * 2;
  const sc2sc3   = pfSuites * 15 * 2;
  const cats_t   = Math.round(bungalows * 0.75) * 10;
  const socPb    = socpg * 20 * 2;
  const selPb    = selpg * 15 * 2;
  const fixed    = 30 + 60 + 60 + 60 + 30 + 30;
  const socPg    = socpg * 150 * 2;
  const selPg    = selpg * 60 * 2;
  const tuck     = suites * 2;
  const reqMins  = brftDin + lun + hk + sc1sc4 + sc2sc3 + cats_t + socPb + selPb + fixed + socPg + selPg + tuck;
  const reqHrs   = reqMins / 60;

  const delta = schedMins - reqMins;

  const missing = ['SC4', 'MB'].filter(code =>
    !Object.values(schedule).some(t =>
      t.code === code || (t.code && t.code.startsWith(code))
    )
  );

  return {
    hrsAvail,
    schedHrs,
    schedMins,
    openSlots,
    openMins,
    reqHrs,
    reqMins,
    delta,
    missing,
    taskCount: Object.values(schedule).length,
  };
}
