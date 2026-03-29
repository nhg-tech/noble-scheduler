/**
 * Noble Scheduler — calculations.js unit tests
 * Run: npm test
 */

import {
  getExpectedInstances,
  countTaskInSchedule,
  getSchedulingStatus,
  computeTaskDuration,
  computeSummary,
  UNIT_BASIS_OPTIONS,
} from '../utils/calculations';

// ─── UNIT_BASIS_OPTIONS ───────────────────────────────────────────────────────
describe('UNIT_BASIS_OPTIONS', () => {
  it('contains exactly 10 canonical options', () => {
    expect(UNIT_BASIS_OPTIONS).toHaveLength(10);
  });
  it('starts with Fixed', () => {
    expect(UNIT_BASIS_OPTIONS[0]).toBe('Fixed');
  });
  it('includes all expected basis types', () => {
    const expected = ['Fixed','Total Dogs','Dog Rooms','# SocPGs','# SelPGs',
                      '# SCs','Cats','Cat Rooms','Total Rooms','Per Employee'];
    expected.forEach(opt => expect(UNIT_BASIS_OPTIONS).toContain(opt));
  });
});

// ─── getExpectedInstances ─────────────────────────────────────────────────────
describe('getExpectedInstances', () => {
  it('resolves "socpg" to the socpg assumption', () => {
    expect(getExpectedInstances({ expectedInstances: 'socpg' }, 2, 1, 8, 10)).toBe(2);
  });
  it('resolves "socpg*2" to double socpg', () => {
    expect(getExpectedInstances({ expectedInstances: 'socpg*2' }, 3, 1, 8, 10)).toBe(6);
  });
  it('resolves "selpg" to selpg assumption', () => {
    expect(getExpectedInstances({ expectedInstances: 'selpg' }, 2, 1, 8, 10)).toBe(1);
  });
  it('resolves "selpg*2" to double selpg', () => {
    expect(getExpectedInstances({ expectedInstances: 'selpg*2' }, 2, 2, 8, 10)).toBe(4);
  });
  it('resolves "sc" to scCount', () => {
    expect(getExpectedInstances({ expectedInstances: 'sc' }, 2, 1, 8, 10)).toBe(8);
  });
  it('resolves "roles" to allRoleCount', () => {
    expect(getExpectedInstances({ expectedInstances: 'roles' }, 2, 1, 8, 10)).toBe(10);
  });
  it('resolves sentinel 99 to allRoleCount', () => {
    expect(getExpectedInstances({ expectedInstances: 99 }, 2, 1, 8, 10)).toBe(10);
  });
  it('resolves a plain number', () => {
    expect(getExpectedInstances({ expectedInstances: 3 }, 2, 1, 8, 10)).toBe(3);
  });
  it('defaults to 1 when expectedInstances is undefined', () => {
    expect(getExpectedInstances({}, 2, 1, 8, 10)).toBe(1);
  });
  it('uses default role count when allRoleCount not provided', () => {
    // Falls back to ROLES.filter(TM/TL/PAW) count from roles.js
    const count = getExpectedInstances({ expectedInstances: 'roles' }, 2, 1, 8);
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });
});

// ─── countTaskInSchedule ──────────────────────────────────────────────────────
describe('countTaskInSchedule', () => {
  // Legacy blocks (no taskId) — fall back to code matching
  it('counts a legacy block by code fallback', () => {
    const sched = { 'GM|540': { code: 'BRK-30' } };
    expect(countTaskInSchedule(sched, 'BRK30', 'BRK-30')).toBe(1);
  });
  it('counts multiple legacy instances across roles', () => {
    const sched = {
      'GM|540':  { code: 'BRK-30' },
      'MR|540':  { code: 'BRK-30' },
      'PAW|540': { code: 'HUD' },
    };
    expect(countTaskInSchedule(sched, 'BRK30', 'BRK-30')).toBe(2);
  });
  it('returns 0 when task not scheduled (legacy)', () => {
    const sched = { 'GM|540': { code: 'HUD' } };
    expect(countTaskInSchedule(sched, 'BRK30', 'BRK-30')).toBe(0);
  });
  it('counts a task inside a legacy merged block (codes array fallback)', () => {
    const sched = {
      'GM|540': { merged: true, codes: ['BRK-30', 'LUN'] },
    };
    expect(countTaskInSchedule(sched, 'BRK30', 'BRK-30')).toBe(1);
    expect(countTaskInSchedule(sched, 'LUN',   'LUN'  )).toBe(1);
  });
  it('returns 0 for empty schedule', () => {
    expect(countTaskInSchedule({}, 'BRK30', 'BRK-30')).toBe(0);
  });

  // Modern blocks (with taskId) — match by id, ignore code
  it('counts by taskId and ignores code when taskId present', () => {
    const sched = {
      'GM|540': { code: 'ON-WT', taskId: 'ON_WT' },
      'MR|540': { code: 'ON',    taskId: 'ON'    },  // different task, same-ish code prefix
    };
    expect(countTaskInSchedule(sched, 'ON_WT', 'ON-WT')).toBe(1);  // only the ON_WT block
    expect(countTaskInSchedule(sched, 'ON',    'ON'   )).toBe(1);  // only the ON block
  });
  it('does not match ON-WT block when searching for ON task', () => {
    const sched = { 'TL_PM|1260': { code: 'ON-WT', taskId: 'ON_WT' } };
    expect(countTaskInSchedule(sched, 'ON', 'ON')).toBe(0);
  });
  it('counts by taskIds array in modern merged blocks', () => {
    const sched = {
      'GM|540': { merged: true, taskIds: ['ON_WT', 'ON'], codes: ['ON-WT', 'ON'] },
    };
    expect(countTaskInSchedule(sched, 'ON_WT', 'ON-WT')).toBe(1);
    expect(countTaskInSchedule(sched, 'ON',    'ON'   )).toBe(1);
    expect(countTaskInSchedule(sched, 'BRK30', 'BRK-30')).toBe(0);
  });
});

// ─── getSchedulingStatus ──────────────────────────────────────────────────────
describe('getSchedulingStatus', () => {
  it('done=true when scheduled >= expected', () => {
    const task = { code: 'HUD', id: 'hud', expectedInstances: 2 };
    const sched = {
      'GM|540': { code: 'HUD' },
      'MR|540': { code: 'HUD' },
    };
    const s = getSchedulingStatus(task, sched, 2, 1, 8, 10);
    expect(s.done).toBe(true);
    expect(s.scheduled).toBe(2);
  });
  it('partial=true when 0 < scheduled < expected', () => {
    const task = { code: 'HUD', id: 'hud', expectedInstances: 2 };
    const sched = { 'GM|540': { code: 'HUD' } };
    const s = getSchedulingStatus(task, sched, 2, 1, 8, 10);
    expect(s.partial).toBe(true);
    expect(s.done).toBe(false);
  });
  it('done=false, partial=false when nothing scheduled', () => {
    const task = { code: 'HUD', id: 'hud', expectedInstances: 2 };
    const s = getSchedulingStatus(task, {}, 2, 1, 8, 10);
    expect(s.done).toBe(false);
    expect(s.partial).toBe(false);
    expect(s.scheduled).toBe(0);
  });
  it('minResources override takes priority over library expectedInstances', () => {
    const task = { code: 'PGM', id: 'pgm', expectedInstances: 'socpg*2' };
    // socpg=2 → library says 4, but minResources override says 1
    const userTaskDefs = { pgm: { minResources: 1 } };
    const sched = { 'GM|540': { code: 'PGM' } };
    const s = getSchedulingStatus(task, sched, 2, 1, 8, 10, userTaskDefs);
    expect(s.expected).toBe(1);
    expect(s.done).toBe(true);
  });
  it('minResources=99 resolves to allRoleCount', () => {
    const task = { code: 'HUD', id: 'hud', expectedInstances: 1 };
    const userTaskDefs = { hud: { minResources: 99 } };
    const s = getSchedulingStatus(task, {}, 2, 1, 8, 5, userTaskDefs);
    expect(s.expected).toBe(5);
  });
});

// ─── computeTaskDuration ──────────────────────────────────────────────────────
describe('computeTaskDuration', () => {
  const derived = { suites: 34, bungalows: 5, scCount: 8, cats: 6, totalRooms: 39 };
  const assumptions = { socpg: 2, selpg: 1, dogs: 40 };

  it('Fixed — returns unitMin as-is', () => {
    expect(computeTaskDuration({ unitBasis: 'Fixed', unitMin: 60 }, derived, assumptions)).toBe(60);
  });
  it('Total Dogs — unitMin × dogs', () => {
    expect(computeTaskDuration({ unitBasis: 'Total Dogs', unitMin: 1 }, derived, assumptions)).toBe(40);
  });
  it('Dog Rooms — unitMin × suites', () => {
    expect(computeTaskDuration({ unitBasis: 'Dog Rooms', unitMin: 2 }, derived, assumptions)).toBe(68);
  });
  it('# SocPGs — unitMin × max(1, socpg)', () => {
    expect(computeTaskDuration({ unitBasis: '# SocPGs', unitMin: 60 }, derived, assumptions)).toBe(120);
  });
  it('# SocPGs — uses at least 1 even when socpg=0', () => {
    expect(computeTaskDuration({ unitBasis: '# SocPGs', unitMin: 60 }, derived, { socpg: 0, selpg: 0, dogs: 0 })).toBe(60);
  });
  it('# SelPGs — unitMin × max(1, selpg)', () => {
    expect(computeTaskDuration({ unitBasis: '# SelPGs', unitMin: 30 }, derived, assumptions)).toBe(30);
  });
  it('# SCs — unitMin × scCount', () => {
    expect(computeTaskDuration({ unitBasis: '# SCs', unitMin: 10 }, derived, assumptions)).toBe(80);
  });
  it('Cats — unitMin × cats', () => {
    expect(computeTaskDuration({ unitBasis: 'Cats', unitMin: 5 }, derived, assumptions)).toBe(30);
  });
  it('Cat Rooms — unitMin × bungalows', () => {
    expect(computeTaskDuration({ unitBasis: 'Cat Rooms', unitMin: 15 }, derived, assumptions)).toBe(75);
  });
  it('Total Rooms — unitMin × totalRooms', () => {
    expect(computeTaskDuration({ unitBasis: 'Total Rooms', unitMin: 1 }, derived, assumptions)).toBe(39);
  });
  it('Per Employee — returns unitMin directly', () => {
    expect(computeTaskDuration({ unitBasis: 'Per Employee', unitMin: 45 }, derived, assumptions)).toBe(45);
  });
  it('unknown unitBasis falls back to unitMin', () => {
    expect(computeTaskDuration({ unitBasis: 'Legacy Value', unitMin: 30 }, derived, assumptions)).toBe(30);
  });
  it('uses slots*30 when unitMin is absent', () => {
    expect(computeTaskDuration({ unitBasis: 'Fixed', slots: 2 }, derived, assumptions)).toBe(60);
  });
  it('handles null derivedValues gracefully', () => {
    expect(computeTaskDuration({ unitBasis: 'Fixed', unitMin: 30 }, null, assumptions)).toBe(30);
  });
  it('handles null assumptions gracefully', () => {
    expect(computeTaskDuration({ unitBasis: '# SocPGs', unitMin: 60 }, derived, null)).toBe(60);
  });
});

// ─── computeSummary ───────────────────────────────────────────────────────────
describe('computeSummary', () => {
  const effectiveRoles = [
    { id: 'GM',  type: 'GM',  hours: 8.5, includeInHrs: false },
    { id: 'TM1', type: 'TM',  hours: 7.5, includeInHrs: true  },
    { id: 'TM2', type: 'TM',  hours: 7.5, includeInHrs: true  },
    { id: 'TL',  type: 'TL',  hours: 8,   includeInHrs: true  },
  ];

  const schedule = {
    'TM1|540': { durationMin: 60 },
    'TM1|660': { durationMin: 90 },
    'TM2|540': { durationMin: 60 },
  };

  const baseArgs = {
    schedule,
    effectiveRoles,
    skippedTasks: new Set(),
    taskLibrary: [],
    derivedValues: { suites: 34, bungalows: 5, scCount: 8, cats: 6, totalRooms: 39 },
    assumptions: { socpg: 2, selpg: 1, dogs: 40 },
    roleCount: 4,
  };

  it('hrsAvail = sum of includeInHrs roles only', () => {
    const { hrsAvail } = computeSummary(baseArgs);
    // TM1(7.5) + TM2(7.5) + TL(8) = 23  (GM excluded)
    expect(hrsAvail).toBe(23);
  });
  it('schedHrs = total scheduled minutes / 60', () => {
    const { schedHrs, schedMins } = computeSummary(baseArgs);
    expect(schedMins).toBe(210);  // 60+90+60
    expect(schedHrs).toBe(3.5);
  });
  it('openSlots = (hrsAvail*60 - schedMins) / 30', () => {
    const { openSlots } = computeSummary(baseArgs);
    // (23*60 - 210) / 30 = (1380-210)/30 = 1170/30 = 39
    expect(openSlots).toBe(39);
  });
  it('taskCount = number of schedule entries', () => {
    const { taskCount } = computeSummary(baseArgs);
    expect(taskCount).toBe(3);
  });
  it('reqHrs=0 when taskLibrary is empty', () => {
    const { reqHrs } = computeSummary(baseArgs);
    expect(reqHrs).toBe(0);
  });
  it('skipped tasks are excluded from reqMins', () => {
    const task = { id: 'brk', code: 'BRK-30', unitBasis: 'Fixed', unitMin: 30,
                   expectedInstances: 2, unitMin: 30 };
    const args = { ...baseArgs, taskLibrary: [task], skippedTasks: new Set(['brk']) };
    const { reqMins } = computeSummary(args);
    expect(reqMins).toBe(0);
  });
  it('reqMins includes fixed tasks from library', () => {
    const task = { id: 'hud', code: 'HUD', unitBasis: 'Fixed', unitMin: 30,
                   expectedInstances: 2 };
    const args = { ...baseArgs, taskLibrary: [task] };
    const { reqMins } = computeSummary(args);
    // 30 min × 2 instances = 60
    expect(reqMins).toBe(60);
  });
  it('delta = schedMins - reqMins', () => {
    const task = { id: 'hud', code: 'HUD', unitBasis: 'Fixed', unitMin: 30,
                   expectedInstances: 2 };
    const args = { ...baseArgs, taskLibrary: [task] };
    const { delta, schedMins, reqMins } = computeSummary(args);
    expect(delta).toBe(schedMins - reqMins);
  });
});
