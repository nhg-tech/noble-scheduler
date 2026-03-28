/**
 * Noble Scheduler — scheduling.js unit tests
 * Run: npm test
 *
 * TIME_SLOTS runs h=5..30 (5am → 6:30am next day), 2 slots per hour.
 * Slot index formula: (h - 5) * 2 + (min === 30 ? 1 : 0)
 *   e.g. 9:00am  → (9-5)*2     = 8
 *        9:30am  → (9-5)*2 + 1 = 9
 *        midnight (h=24) → (24-5)*2 = 38
 *        1:00am ext (h=25) → (25-5)*2 = 40
 */

import {
  makeKey,
  keyToRoleAndMin,
  slotStartMin,
  minToSlotIdx,
  slotToHour,
  inShift,
  getEffectiveDuration,
  findTaskAtMinute,
  findOverlapInRange,
  findNextFreeMinute,
  freeTimeFrom,
  formatMin,
  formatShiftTime,
  placeBlock,
  doMerge,
} from '../utils/scheduling';

// ─── helpers ──────────────────────────────────────────────────────────────────
/** Return the TIME_SLOTS index for a given hour + minute. */
function slotFor(h, m = 0) {
  return (h - 5) * 2 + (m === 30 ? 1 : 0);
}

const ROLE_DAY   = { id: 'GM',  shiftStart: 6.5, shiftEnd: 15 };   // 6:30am–3pm
const ROLE_ON    = { id: 'ON',  shiftStart: 21,  shiftEnd: 6.5 };  // overnight 9pm–6:30am


// ─── makeKey / keyToRoleAndMin ────────────────────────────────────────────────
describe('makeKey', () => {
  it('produces "roleId|startMin" string', () => {
    expect(makeKey('GM', 420)).toBe('GM|420');
  });
  it('works with 0 start minute', () => {
    expect(makeKey('MR', 0)).toBe('MR|0');
  });
});

describe('keyToRoleAndMin', () => {
  it('parses back to roleId and numeric startMin', () => {
    expect(keyToRoleAndMin('GM|420')).toEqual({ roleId: 'GM', startMin: 420 });
  });
  it('round-trips with makeKey', () => {
    const key = makeKey('TL AM', 510);
    expect(keyToRoleAndMin(key)).toEqual({ roleId: 'TL AM', startMin: 510 });
  });
  it('startMin is always a number, not a string', () => {
    const { startMin } = keyToRoleAndMin('PAW|870');
    expect(typeof startMin).toBe('number');
  });
});

// ─── slotStartMin ─────────────────────────────────────────────────────────────
describe('slotStartMin', () => {
  it('slot 0 (5:00am) → 300 minutes', () => {
    expect(slotStartMin(0)).toBe(300);
  });
  it('slot 1 (5:30am) → 330 minutes', () => {
    expect(slotStartMin(1)).toBe(330);
  });
  it('9:00am slot → 540 minutes', () => {
    expect(slotStartMin(slotFor(9))).toBe(540);
  });
  it('midnight slot (h=24) → 1440 minutes', () => {
    expect(slotStartMin(slotFor(24))).toBe(1440);
  });
  it('1:00am extended (h=25) → 1500 minutes', () => {
    expect(slotStartMin(slotFor(25))).toBe(1500);
  });
  it('returns null for out-of-range index', () => {
    expect(slotStartMin(999)).toBeNull();
  });
  it('returns null for negative index', () => {
    expect(slotStartMin(-1)).toBeNull();
  });
});

// ─── minToSlotIdx ─────────────────────────────────────────────────────────────
describe('minToSlotIdx', () => {
  it('300 min → slot 0 (5:00am)', () => {
    expect(minToSlotIdx(300)).toBe(0);
  });
  it('540 min → correct 9:00am slot', () => {
    expect(minToSlotIdx(540)).toBe(slotFor(9));
  });
  it('780 min → 1:00pm slot', () => {
    expect(minToSlotIdx(780)).toBe(slotFor(13));
  });
  it('1440 min (midnight) → h=24 slot', () => {
    expect(minToSlotIdx(1440)).toBe(slotFor(24));
  });
  it('returns -1 for a minute not on a slot boundary', () => {
    expect(minToSlotIdx(541)).toBe(-1);
  });
});

// ─── slotToHour ───────────────────────────────────────────────────────────────
describe('slotToHour', () => {
  it('slot 0 → 5.0', () => {
    expect(slotToHour(0)).toBe(5);
  });
  it('slot 1 (5:30am) → 5.5', () => {
    expect(slotToHour(1)).toBe(5.5);
  });
  it('9:30am slot → 9.5', () => {
    expect(slotToHour(slotFor(9, 30))).toBe(9.5);
  });
  it('midnight slot (h=24) → 24.0', () => {
    expect(slotToHour(slotFor(24))).toBe(24);
  });
  it('1:00am extended (h=25) → 25.0', () => {
    expect(slotToHour(slotFor(25))).toBe(25);
  });
  it('returns null for out-of-range index', () => {
    expect(slotToHour(999)).toBeNull();
  });
});

// ─── inShift ──────────────────────────────────────────────────────────────────
describe('inShift — regular (day) shift', () => {
  it('slot at shiftStart is inside shift', () => {
    // ROLE_DAY: 6:30am–3pm → shiftStart=6.5
    expect(inShift(ROLE_DAY, slotFor(6, 30))).toBe(true);
  });
  it('slot mid-shift is inside', () => {
    expect(inShift(ROLE_DAY, slotFor(10))).toBe(true);
  });
  it('slot at shiftEnd is outside shift (exclusive end)', () => {
    expect(inShift(ROLE_DAY, slotFor(15))).toBe(false);
  });
  it('slot before shiftStart is outside', () => {
    expect(inShift(ROLE_DAY, slotFor(5))).toBe(false);
  });
  it('slot after shiftEnd is outside', () => {
    expect(inShift(ROLE_DAY, slotFor(16))).toBe(false);
  });
  it('returns false for null slot (index out of range)', () => {
    expect(inShift(ROLE_DAY, 999)).toBe(false);
  });
});

describe('inShift — overnight shift (9pm–6:30am)', () => {
  it('slot at shiftStart (9:00pm) is inside', () => {
    expect(inShift(ROLE_ON, slotFor(21))).toBe(true);
  });
  it('slot at 11:00pm is inside', () => {
    expect(inShift(ROLE_ON, slotFor(23))).toBe(true);
  });
  it('midnight extended slot (h=24) is inside', () => {
    expect(inShift(ROLE_ON, slotFor(24))).toBe(true);
  });
  it('1:00am extended slot (h=25) is inside', () => {
    expect(inShift(ROLE_ON, slotFor(25))).toBe(true);
  });
  it('6:00am extended slot (h=30) is inside', () => {
    expect(inShift(ROLE_ON, slotFor(30))).toBe(true);
  });
  it('6:30am extended slot (h=30.5→ slot at 30:30) is outside (shiftEnd=6.5)', () => {
    // h=30, min=30 → slotToHour = 30.5 → (30.5-24)=6.5 which is NOT < 6.5
    expect(inShift(ROLE_ON, slotFor(30, 30))).toBe(false);
  });
  it('early-morning same-day 5:00am (h=5) is inside (< shiftEnd 6.5)', () => {
    expect(inShift(ROLE_ON, slotFor(5))).toBe(true);
  });
  it('early-morning same-day 6:00am (h=6) is inside (< 6.5)', () => {
    expect(inShift(ROLE_ON, slotFor(6))).toBe(true);
  });
  it('7:00am same-day is outside overnight shift', () => {
    expect(inShift(ROLE_ON, slotFor(7))).toBe(false);
  });
  it('slot at 8:00am is outside overnight shift', () => {
    expect(inShift(ROLE_ON, slotFor(8))).toBe(false);
  });
});

// ─── getEffectiveDuration ─────────────────────────────────────────────────────
describe('getEffectiveDuration', () => {
  it('returns resizedMins first if present', () => {
    expect(getEffectiveDuration({ resizedMins: 90, durationMin: 60, slots: 1 })).toBe(90);
  });
  it('falls back to durationMin when no resizedMins', () => {
    expect(getEffectiveDuration({ durationMin: 60, slots: 1 })).toBe(60);
  });
  it('falls back to slots * 30 when no durationMin', () => {
    expect(getEffectiveDuration({ slots: 3 })).toBe(90);
  });
});

// ─── findTaskAtMinute ─────────────────────────────────────────────────────────
describe('findTaskAtMinute', () => {
  const sched = {
    'GM|540': { durationMin: 60, slots: 2 },   // 9:00–10:00am
    'MR|600': { durationMin: 90, slots: 3 },   // 10:00–11:30am
  };

  it('finds task whose range contains the minute', () => {
    expect(findTaskAtMinute(sched, 'GM', 570)).toBe('GM|540');
  });
  it('finds task at its exact start minute', () => {
    expect(findTaskAtMinute(sched, 'GM', 540)).toBe('GM|540');
  });
  it('returns null at the task end minute (exclusive)', () => {
    expect(findTaskAtMinute(sched, 'GM', 600)).toBeNull();
  });
  it('returns null for wrong role', () => {
    expect(findTaskAtMinute(sched, 'PAW', 570)).toBeNull();
  });
  it('returns null when nothing scheduled at that minute', () => {
    expect(findTaskAtMinute(sched, 'GM', 500)).toBeNull();
  });
  it('handles slots fallback when durationMin absent', () => {
    const s = { 'GM|540': { slots: 2 } };
    expect(findTaskAtMinute(s, 'GM', 559)).toBe('GM|540');
  });
});

// ─── findOverlapInRange ───────────────────────────────────────────────────────
describe('findOverlapInRange', () => {
  const sched = {
    'GM|540': { durationMin: 60 },   // 9:00–10:00
    'GM|660': { durationMin: 60 },   // 11:00–12:00
  };

  it('detects full overlap', () => {
    expect(findOverlapInRange(sched, 'GM', 540, 60)).toBe('GM|540');
  });
  it('detects partial overlap from the left', () => {
    expect(findOverlapInRange(sched, 'GM', 510, 60)).toBe('GM|540');
  });
  it('detects partial overlap from the right', () => {
    expect(findOverlapInRange(sched, 'GM', 570, 60)).toBe('GM|540');
  });
  it('no overlap in gap between tasks', () => {
    expect(findOverlapInRange(sched, 'GM', 600, 60)).toBeNull();
  });
  it('no overlap for different role', () => {
    expect(findOverlapInRange(sched, 'MR', 540, 60)).toBeNull();
  });
  it('placement adjacent to end does not conflict', () => {
    // task ends at 600, new task starts at 600 → no overlap
    expect(findOverlapInRange(sched, 'GM', 600, 30)).toBeNull();
  });
});

// ─── findNextFreeMinute ───────────────────────────────────────────────────────
describe('findNextFreeMinute', () => {
  it('returns fromMin when schedule is empty', () => {
    const slot = minToSlotIdx(540);
    expect(findNextFreeMinute({}, 'GM', 540, 60)).toBe(540);
  });
  it('skips occupied block and returns next free slot', () => {
    const sched = { 'GM|540': { durationMin: 60 } };
    // 9:00–10:00 occupied → next free at 600
    expect(findNextFreeMinute(sched, 'GM', 540, 60)).toBe(600);
  });
  it('skips multiple consecutive occupied blocks', () => {
    const sched = {
      'GM|540': { durationMin: 60 },  // 9:00–10:00
      'GM|600': { durationMin: 60 },  // 10:00–11:00
    };
    expect(findNextFreeMinute(sched, 'GM', 540, 60)).toBe(660);
  });
});

// ─── freeTimeFrom ─────────────────────────────────────────────────────────────
describe('freeTimeFrom', () => {
  it('returns time until next task', () => {
    const sched = { 'GM|540': { durationMin: 60 }, 'GM|660': { durationMin: 60 } };
    // From 540, skipping the task at 540, next blocker starts at 660 → 660-540=120
    expect(freeTimeFrom(sched, 'GM', 'GM|540', 540)).toBe(120);
  });
  it('returns large value when nothing follows', () => {
    const sched = { 'GM|540': { durationMin: 60 } };
    expect(freeTimeFrom(sched, 'GM', 'GM|540', 600)).toBeGreaterThan(0);
  });
  it('correctly skips the skipKey task', () => {
    const sched = {
      'GM|540': { durationMin: 60 },
      'GM|600': { durationMin: 60 },
    };
    // Skipping GM|540, from minute 540 — next blocker is GM|600 → 600-540=60
    expect(freeTimeFrom(sched, 'GM', 'GM|540', 540)).toBe(60);
  });
});

// ─── formatMin ────────────────────────────────────────────────────────────────
describe('formatMin', () => {
  it('formats AM time correctly', () => {
    expect(formatMin(540)).toBe('9:00am');
  });
  it('formats PM time correctly', () => {
    expect(formatMin(780)).toBe('1:00pm');
  });
  it('formats noon correctly', () => {
    expect(formatMin(720)).toBe('12:00pm');
  });
  it('formats midnight (0 min) as 12:00am', () => {
    expect(formatMin(0)).toBe('12:00am');
  });
  it('wraps post-midnight h=25 (1am) correctly', () => {
    expect(formatMin(1500)).toBe('1:00am');  // 1500/60=25, 25%24=1
  });
  it('wraps h=24 (midnight extended) correctly', () => {
    expect(formatMin(1440)).toBe('12:00am'); // 1440/60=24, 24%24=0 → 12am
  });
  it('formats half-hour correctly', () => {
    expect(formatMin(570)).toBe('9:30am');
  });
  it('formats 11:30pm correctly', () => {
    expect(formatMin(1410)).toBe('11:30pm');
  });
});

// ─── formatShiftTime ──────────────────────────────────────────────────────────
describe('formatShiftTime', () => {
  it('formats whole hour AM', () => {
    expect(formatShiftTime(9)).toBe('9a');
  });
  it('formats fractional hour AM (6.5 → 6:30a)', () => {
    expect(formatShiftTime(6.5)).toBe('6:30a');
  });
  it('formats whole hour PM', () => {
    expect(formatShiftTime(15)).toBe('3p');
  });
  it('formats 1:30pm', () => {
    expect(formatShiftTime(13.5)).toBe('1:30p');
  });
  it('wraps post-midnight 25 → 1a', () => {
    expect(formatShiftTime(25)).toBe('1a');
  });
  it('wraps h=24 → 12a (midnight)', () => {
    expect(formatShiftTime(24)).toBe('12a');
  });
  it('formats 9:30pm (21.5)', () => {
    expect(formatShiftTime(21.5)).toBe('9:30p');
  });
});

// ─── placeBlock ───────────────────────────────────────────────────────────────
describe('placeBlock', () => {
  const task = { name: 'GM Round', code: 'GM-RND', desc: 'Morning round' };

  it('adds a new key to the schedule', () => {
    const result = placeBlock({}, 'GM', 540, task, 60, '#3E2A7E');
    expect(result).toHaveProperty('GM|540');
  });
  it('preserves existing schedule entries', () => {
    const existing = { 'MR|600': { name: 'Other' } };
    const result = placeBlock(existing, 'GM', 540, task, 60, '#3E2A7E');
    expect(result).toHaveProperty('MR|600');
  });
  it('stores correct durationMin and slots', () => {
    const result = placeBlock({}, 'GM', 540, task, 90, '#fff');
    expect(result['GM|540'].durationMin).toBe(90);
    expect(result['GM|540'].slots).toBe(3);
  });
  it('stores correct color', () => {
    const result = placeBlock({}, 'GM', 540, task, 60, '#FF5733');
    expect(result['GM|540'].color).toBe('#FF5733');
  });
});

// ─── doMerge ──────────────────────────────────────────────────────────────────
describe('doMerge', () => {
  const existing = {
    'GM|540': { name: 'Task A', code: 'A', durationMin: 60 },
    'GM|600': { name: 'Task B', code: 'B', durationMin: 30 },
  };

  it('removes the existingKey and places merged block at new startMin', () => {
    // Merge starts at 510 (earlier than existing 540) — old key is deleted, new key created
    const result = doMerge(existing, 'GM|540', ['A', 'B'], ['#f00', '#0f0'], 90,
      [{ name: 'Task A' }, { name: 'Task B' }], 510, 'GM');
    expect(result).not.toHaveProperty('GM|540');
    expect(result).toHaveProperty('GM|510');
  });
  it('adds a merged block at the given startMin', () => {
    const result = doMerge(existing, 'GM|540', ['A', 'B'], ['#f00', '#0f0'], 90,
      [{ name: 'Task A' }, { name: 'Task B' }], 510, 'GM');
    expect(result).toHaveProperty('GM|510');
    expect(result['GM|510'].merged).toBe(true);
  });
  it('merged block has combined codes', () => {
    const result = doMerge(existing, 'GM|540', ['A', 'B'], ['#f00', '#0f0'], 90,
      [{ name: 'Task A' }, { name: 'Task B' }], 510, 'GM');
    expect(result['GM|510'].codes).toEqual(['A', 'B']);
  });
  it('preserves other schedule entries', () => {
    const result = doMerge(existing, 'GM|540', ['A', 'B'], ['#f00', '#0f0'], 90,
      [{ name: 'Task A' }, { name: 'Task B' }], 510, 'GM');
    expect(result).toHaveProperty('GM|600');
  });
});
