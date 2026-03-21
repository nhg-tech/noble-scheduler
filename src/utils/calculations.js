import { ROLES } from '../data/roles';
import { TASK_LIBRARY } from '../data/taskLibrary';

/**
 * Resolve expected instance count for a task given current assumptions.
 */
export function getExpectedInstances(task, socpg, selpg, scCount) {
  const roleCount = ROLES.filter(r => r.type === 'TM' || r.type === 'TL' || r.type === 'PAW').length;
  const ei = task.expectedInstances;
  if (ei === 'socpg*2') return socpg * 2;
  if (ei === 'selpg*2') return selpg * 2;
  if (ei === 'socpg')   return socpg;
  if (ei === 'selpg')   return selpg;
  if (ei === 'sc')      return scCount;
  if (ei === 'roles')   return roleCount;
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
 */
export function getSchedulingStatus(task, schedule, socpg, selpg, scCount) {
  const scheduled = countTaskInSchedule(schedule, task.code);
  const expected  = getExpectedInstances(task, socpg, selpg, scCount);
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
export function computeTaskDuration(task, derivedValues, assumptions) {
  const { suites = 0, bungalows = 0 } = derivedValues || {};
  const socpg = assumptions?.socpg || 0;
  const selpg = assumptions?.selpg || 0;
  const ub = task.unitBasis || '';
  const um = task.unitMin || (task.slots || 1) * 30;

  if (ub.startsWith('per suite/bungalow'))  return Math.max(30, um * (suites + bungalows));
  if (ub.startsWith('per suite (max 60)'))  return Math.max(30, Math.min(um * suites, 60));
  if (ub.startsWith('per suite'))           return Math.max(30, um * suites);
  if (ub.startsWith('per bungalow'))        return Math.max(30, um * Math.round(bungalows * 0.75));
  if (ub.startsWith('per SocPG'))           return Math.max(30, um * Math.max(1, socpg));
  if (ub.startsWith('per SelPG'))           return Math.max(30, um * Math.max(1, selpg));
  // fixed, per group, per play area, per employee, per shift block, custom — use unitMin
  return um;
}

/**
 * Compute full schedule summary.
 */
export function computeSummary({
  dogs, multipet, multipetCats, socpg, selpg,
  suites, cats, bungalows, scCount, schedule,
}) {
  const eligibleRoles = ROLES.filter(r => r.type === 'TM' || r.type === 'TL');
  const hrsAvail = eligibleRoles.reduce((a, r) => a + r.hours, 0);

  let schedMins = 0;
  Object.values(schedule).forEach(t => { schedMins += t.durationMin ?? (t.slots * 30); });
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
