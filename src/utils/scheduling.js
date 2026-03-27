import { TIME_SLOTS, ROLES } from '../data/roles';

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

export function inShift(role, slotIdx) {
  const t = slotToHour(slotIdx);
  if (t === null) return false;
  const { shiftStart, shiftEnd } = role;
  if (shiftStart < shiftEnd) {
    // Regular (non-overnight) shift
    return t >= shiftStart && t < shiftEnd;
  }
  // Overnight shift (shiftStart > shiftEnd, e.g. 21→6.5):
  // Post-midnight extended slots (h≥24) use wrapped comparison so the shift-end
  // boundary is exact. Same-day early-morning slots (h<24) use the classic wrap.
  if (t >= 24) return (t - 24) < shiftEnd; // post-midnight: compare wrapped hour
  return t >= shiftStart || t < shiftEnd;   // pre-midnight or early-morning same-day
}

// ─── Duration helpers ───────────────────────────────────────────────────────
export function getEffectiveDuration(task, getTaskDefault) {
  if (task.resizedMins) return task.resizedMins;
  if (task.durationMin) return task.durationMin;
  if (getTaskDefault && task.code) {
    // Try to find libTask by code
    return task.slots * 30;
  }
  return task.slots * 30;
}

// ─── Conflict detection ─────────────────────────────────────────────────────
export function findTaskAtMinute(schedule, roleId, minute) {
  let found = null;
  Object.entries(schedule).forEach(([key, task]) => {
    const { roleId: rid, startMin } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = task.durationMin ?? task.slots * 30;
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
    const dur = task.durationMin ?? task.slots * 30;
    // Overlap when the two intervals intersect
    if (taskStart < startMin + durationMin && taskStart + dur > startMin) {
      if (taskStart < foundStart) { found = key; foundStart = taskStart; }
    }
  });
  return found;
}

export function findNextFreeMinute(schedule, roleId, fromMin, durationMin) {
  const role = ROLES.find(r => r.id === roleId);

  const occupied = [];
  Object.entries(schedule).forEach(([key, task]) => {
    const { roleId: rid, startMin } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = task.durationMin ?? task.slots * 30;
    occupied.push({ start: startMin, end: startMin + dur });
  });
  occupied.sort((a, b) => a.start - b.start);

  let tryMin = fromMin;
  const maxTries = occupied.length + 1;
  for (let attempt = 0; attempt <= maxTries; attempt++) {
    const conflict = occupied.find(o => o.start < tryMin + durationMin && o.end > tryMin);
    if (!conflict) {
      const trySlotIdx = minToSlotIdx(tryMin);
      if (trySlotIdx >= 0 && (!role || inShift(role, trySlotIdx))) return tryMin;
      const rounded = Math.ceil(tryMin / 30) * 30;
      if (rounded !== tryMin) { tryMin = rounded; continue; }
      return null;
    }
    tryMin = conflict.end;
  }
  return null;
}

export function freeTimeFrom(schedule, roleId, skipKey, fromMin) {
  const occupied = [];
  Object.entries(schedule).forEach(([key, task]) => {
    if (key === skipKey) return;
    const { roleId: rid, startMin } = keyToRoleAndMin(key);
    if (rid !== roleId) return;
    const dur = task.durationMin ?? task.slots * 30;
    occupied.push({ start: startMin, end: startMin + dur });
  });
  occupied.sort((a, b) => a.start - b.start);
  const blocker = occupied.find(o => o.start >= fromMin);
  return blocker ? blocker.start - fromMin : 24 * 60 - fromMin;
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
    colors,
    constituents,
    color:        colors[0],
    slots:        Math.ceil(totalDuration / 30),
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
      slots: Math.ceil(durationMin / 30),
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
