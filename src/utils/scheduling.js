import { TIME_SLOTS } from '../data/roles';

export const GRID_SLOT_MINUTES = 15;
const LEGACY_SLOT_MINUTES = 30;

// ─── Key helpers ───────────────────────────────────────────────────────────
export function makeKey(roleId, startMin) {
  return `${roleId}|${startMin}`;
}

export function keyToRoleAndMin(key) {
  const [roleId, startMin] = key.split('|');
  return { roleId, startMin: parseInt(startMin) };
}

// ─── Time slot helpers ──────────────────────────────────────────────────────
export function slotStartMin(slotIdx) {
  const s = TIME_SLOTS[slotIdx];
  return s ? s.hour * 60 + s.min : null;
}

export function minToSlotIdx(totalMin) {
  const hour = Math.floor(totalMin / 60);
  const min  = totalMin % 60;
  return TIME_SLOTS.findIndex(s => s.hour === hour && s.min === min);
}

export function slotToHour(idx) {
  const s = TIME_SLOTS[idx];
  return s ? s.hour + s.min / 60 : null;
}

export function minutesToGridSlots(durationMin) {
  return Math.ceil(Number(durationMin) / GRID_SLOT_MINUTES);
}

export function roundUpToGridMinute(totalMin) {
  return Math.ceil(totalMin / GRID_SLOT_MINUTES) * GRID_SLOT_MINUTES;
}

export function legacySlotsToMinutes(slots = 1) {
  return Number(slots) * LEGACY_SLOT_MINUTES;
}

export function isOvernightShift(role) {
  return !!role && role.shiftStart > role.shiftEnd;
}

export function getGridEndMinute() {
  const lastSlotStart = slotStartMin(TIME_SLOTS.length - 1);
  return lastSlotStart == null ? 24 * 60 : lastSlotStart + GRID_SLOT_MINUTES;
}

export function normalizeMinuteForShift(role, minute) {
  if (!role) return minute;
  if (!isOvernightShift(role)) return minute;
  const shiftStartMin = role.shiftStart * 60;
  return minute < 1440 && minute < shiftStartMin ? minute + 1440 : minute;
}

export function getShiftEndMinute(role, referenceMinute = null) {
  if (!role) return getGridEndMinute();
  const shiftEndMin = role.shiftEnd * 60;
  if (!isOvernightShift(role)) return shiftEndMin;
  const normalizedReference = referenceMinute == null
    ? role.shiftStart * 60
    : normalizeMinuteForShift(role, referenceMinute);
  return normalizedReference >= 1440 ? shiftEndMin + 1440 : shiftEndMin;
}

export function isMinuteInShift(role, minute) {
  if (!role) return true;
  const normalizedMinute = normalizeMinuteForShift(role, minute);
  const shiftStartMin = role.shiftStart * 60;
  const shiftEndMin = getShiftEndMinute(role, minute);
  return normalizedMinute >= shiftStartMin && normalizedMinute < shiftEndMin;
}

export function inShift(role, slotIdx) {
  const minute = slotStartMin(slotIdx);
  if (minute === null) return false;
  return isMinuteInShift(role, minute);
}

// ─── Duration helpers ───────────────────────────────────────────────────────
export function getEffectiveDuration(task, getTaskDefault) {
  if (task.resizedMins) return task.resizedMins;
  if (task.durationMin) return task.durationMin;
  return legacySlotsToMinutes(task.slots);
}

export function getBlockDurationMin(task) {
  if (!task) return 0;
  return task.resizedMins ?? task.durationMin ?? legacySlotsToMinutes(task.slots);
}

// ─── Conflict detection ─────────────────────────────────────────────────────
export function findTaskAtMinute(schedule, roleId, minute) {
  let found = null;
  Object.entries(schedule).forEach(([key, task]) => {
    const { roleId: rid, startMin } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = getBlockDurationMin(task);
    if (minute >= startMin && minute < startMin + dur) found = key;
  });
  return found;
}

// Find the first task in roleId that overlaps the range [startMin, startMin+durationMin)
export function findOverlapInRange(schedule, roleId, startMin, durationMin) {
  let found = null;
  let foundStart = Infinity;
  Object.entries(schedule).forEach(([key, task]) => {
    const { roleId: rid, startMin: taskStart } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = getBlockDurationMin(task);
    // Overlap when the two intervals intersect
    if (taskStart < startMin + durationMin && taskStart + dur > startMin) {
      if (taskStart < foundStart) { found = key; foundStart = taskStart; }
    }
  });
  return found;
}

export function findNextFreeMinute(schedule, roleId, fromMin, durationMin, roles = []) {
  const role = roles.find(r => r.id === roleId);

  const occupied = [];
  Object.entries(schedule).forEach(([key, task]) => {
    const { roleId: rid, startMin } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = getBlockDurationMin(task);
    occupied.push({ start: startMin, end: startMin + dur });
  });
  occupied.sort((a, b) => a.start - b.start);

  let tryMin = fromMin;
  const maxTries = occupied.length + 1;
  for (let attempt = 0; attempt <= maxTries; attempt++) {
    const conflict = occupied.find(o => o.start < tryMin + durationMin && o.end > tryMin);
    if (!conflict) {
      const trySlotIdx = minToSlotIdx(tryMin);
      if (trySlotIdx >= 0 && isMinuteInShift(role, tryMin)) return tryMin;
      const rounded = roundUpToGridMinute(tryMin);
      if (rounded !== tryMin) { tryMin = rounded; continue; }
      return null;
    }
    tryMin = conflict.end;
  }
  return null;
}

export function freeTimeFrom(schedule, roleId, skipKey, fromMin, roles = []) {
  const role = roles.find(r => r.id === roleId);
  const occupied = [];
  Object.entries(schedule).forEach(([key, task]) => {
    if (key === skipKey) return;
    const { roleId: rid, startMin } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = getBlockDurationMin(task);
    occupied.push({ start: startMin, end: startMin + dur });
  });
  occupied.sort((a, b) => a.start - b.start);
  const blocker = occupied.find(o => o.start >= fromMin);
  if (blocker) return blocker.start - fromMin;
  const endMinute = role ? getShiftEndMinute(role, fromMin) : getGridEndMinute();
  return Math.max(0, endMinute - fromMin);
}

// ─── Merge helpers ──────────────────────────────────────────────────────────
export function doMerge(schedule, existingKey, codes, colors, totalDuration, constituents, startMin, roleId) {
  const newSchedule = { ...schedule };
  delete newSchedule[existingKey];
  const newKey = makeKey(roleId, startMin);
  newSchedule[newKey] = {
    name:         codes.join(' + '),
    code:         codes.join('+'),
    codes,
    taskIds:      constituents.map(c => c.taskId).filter(Boolean),
    colors,
    constituents,
    color:        colors[0],
    slots:        minutesToGridSlots(totalDuration),
    durationMin:  totalDuration,
    notes:        constituents.map(c => c.name).join(' + '),
    merged:       true,
  };
  return newSchedule;
}

// ─── Place block ─────────────────────────────────────────────────────────────
export function placeBlock(schedule, roleId, startMin, task, durationMin, hexColor) {
  const key = makeKey(roleId, startMin);
  return {
    ...schedule,
    [key]: {
      name: task.name,
      code: task.code,
      color: hexColor,
      slots: minutesToGridSlots(durationMin),
      durationMin,
      notes: task.desc || '',
    },
  };
}

// ─── Formatting ─────────────────────────────────────────────────────────────
export function formatMin(totalMin) {
  const hRaw = Math.floor(totalMin / 60), m = totalMin % 60;
  const h = hRaw % 24; // wrap post-midnight hours (e.g. 25 → 1, 24 → 0)
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

export function formatShiftTime(decimalHour) {
  const hRaw = Math.floor(decimalHour);
  const h    = hRaw % 24; // wrap post-midnight (e.g. 25.5 → h=1, 24 → 0)
  const m    = Math.round((decimalHour % 1) * 60);
  const ampm = h < 12 ? 'a' : 'p';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${m > 0 ? ':' + m.toString().padStart(2, '0') : ''}${ampm}`;
}
