import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ROLES } from '../data/roles';
import { TASK_LIBRARY } from '../data/taskLibrary';
import { resolveBlockHex } from '../data/palette';
import { makeKey, keyToRoleAndMin } from '../utils/scheduling';

// ─── localStorage keys ───────────────────────────────────────────────────────
const LS_TASKS    = 'noble_task_defaults';
const LS_ROLES    = 'noble_role_defaults';
const LS_PROGRAMS = 'noble_program_defaults';
const LS_TEMPLATES = 'noble_user_templates';
const LS_POSTINGS  = 'noble_user_postings';
const LS_DRAFTS    = 'noble_drafts';
const LS_EXTRA_ROLES = 'noble_extra_roles';
const LS_COL_ORDER   = 'noble_column_order';

const NOBLE_PROGRAM_DEFAULTS = { social: 65, select: 20, pf: 15, cats: 20, multipet: 15, multipetCats: 15 };

// Build Noble baseline defaults from task library and roles
const NOBLE_TASK_DEFAULTS = {};
TASK_LIBRARY.forEach(t => {
  NOBLE_TASK_DEFAULTS[t.id] = {
    slots: t.slots, unitMin: t.unitMin ?? null,
    unitBasis: t.unitBasis ?? '', idealStart: t.idealStart ?? '',
    color: t.color ?? 'block-group',
  };
});
const NOBLE_ROLE_DEFAULTS = {};
ROLES.forEach(r => {
  NOBLE_ROLE_DEFAULTS[r.id] = {
    shiftStart:   r.shiftStart,
    shiftEnd:     r.shiftEnd,
    hours:        r.hours,
    includeInHrs: r.type === 'TM' || r.type === 'TL',
  };
});

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage full */ }
}

const SchedulerContext = createContext(null);

export function SchedulerProvider({ children }) {
  const [schedule,       setSchedule]       = useState({});
  const [assumptions,    setAssumptions]    = useState({
    dogs: 65, socpg: 2, selpg: 2,
    roomsActual: null, roomsUserEdited: false,
    scActual: null, scUserEdited: false,
    catsActual: null, catsUserEdited: false,
    catRoomsActual: null, catRoomsUserEdited: false,
    date: new Date().toISOString().split('T')[0],
  });
  const [userTaskDefs,   setUserTaskDefs]   = useState(() => loadLS(LS_TASKS, {}));
  const [userRoleDefs,   setUserRoleDefs]   = useState(() => loadLS(LS_ROLES, {}));
  const [userProgramDefs,setUserProgramDefs]= useState(() => loadLS(LS_PROGRAMS, {}));
  const [extraRoles,     setExtraRoles]     = useState(() => loadLS(LS_EXTRA_ROLES, []));
  const [columnOrder,    setColumnOrder]    = useState(() => loadLS(LS_COL_ORDER, ROLES.map(r => r.id)));
  const [scheduleLabel,  setScheduleLabel]  = useState('Template 1 — 2 SocPGs + 2 SelPGs');

  // Persist user defaults on change
  useEffect(() => { saveLS(LS_TASKS,       userTaskDefs);    }, [userTaskDefs]);
  useEffect(() => { saveLS(LS_ROLES,       userRoleDefs);    }, [userRoleDefs]);
  useEffect(() => { saveLS(LS_PROGRAMS,    userProgramDefs); }, [userProgramDefs]);
  useEffect(() => { saveLS(LS_EXTRA_ROLES, extraRoles);      }, [extraRoles]);
  useEffect(() => { saveLS(LS_COL_ORDER,   columnOrder);     }, [columnOrder]);

  // ─── Getters ─────────────────────────────────────────────────────────────
  const getTaskDefault = useCallback((taskId) => {
    const base = NOBLE_TASK_DEFAULTS[taskId] || {};
    const user = userTaskDefs[taskId] || {};
    return {
      slots:      user.slots      ?? base.slots,
      unitMin:    user.unitMin    ?? base.unitMin,
      unitBasis:  user.unitBasis  ?? base.unitBasis,
      idealStart: user.idealStart ?? base.idealStart,
      color:      user.color      ?? base.color,
    };
  }, [userTaskDefs]);

  const getRoleConfig = useCallback((roleId) => {
    const base = NOBLE_ROLE_DEFAULTS[roleId] || {};
    const user = userRoleDefs[roleId] || {};
    return {
      shiftStart:   user.shiftStart   ?? base.shiftStart,
      shiftEnd:     user.shiftEnd     ?? base.shiftEnd,
      hours:        user.hours        ?? base.hours,
      includeInHrs: user.includeInHrs ?? base.includeInHrs,
    };
  }, [userRoleDefs]);

  const getProgramPct = useCallback(() => ({
    social:      userProgramDefs.social      ?? NOBLE_PROGRAM_DEFAULTS.social,
    select:      userProgramDefs.select      ?? NOBLE_PROGRAM_DEFAULTS.select,
    pf:          userProgramDefs.pf          ?? NOBLE_PROGRAM_DEFAULTS.pf,
    cats:        userProgramDefs.cats        ?? NOBLE_PROGRAM_DEFAULTS.cats,
    multipet:    userProgramDefs.multipet    ?? NOBLE_PROGRAM_DEFAULTS.multipet,
    multipetCats:userProgramDefs.multipetCats?? NOBLE_PROGRAM_DEFAULTS.multipetCats,
  }), [userProgramDefs]);

  // ─── Derived assumption values ────────────────────────────────────────────
  const getDerivedValues = useCallback(() => {
    const pct    = getProgramPct();
    const dogs   = assumptions.dogs || 0;

    const estRooms   = Math.round(dogs * (1 - pct.multipet / 100));
    const suites     = assumptions.roomsUserEdited
      ? (assumptions.roomsActual ?? estRooms)
      : estRooms;

    const estCats    = Math.round(dogs * pct.cats / 100);
    const cats       = assumptions.catsUserEdited
      ? (assumptions.catsActual ?? estCats)
      : estCats;

    const estBung    = Math.max(1, Math.round(cats / (1 + pct.multipetCats / 100)));
    const bungalows  = assumptions.catRoomsUserEdited
      ? (assumptions.catRoomsActual ?? estBung)
      : estBung;

    const estSC      = Math.max(1, Math.round(dogs * pct.pf / 100));
    const scCount    = assumptions.scUserEdited
      ? (assumptions.scActual ?? estSC)
      : estSC;

    return { suites, cats, bungalows, scCount, estRooms, estCats, estBung, estSC, pct };
  }, [assumptions, getProgramPct]);

  // ─── Load template ────────────────────────────────────────────────────────
  const loadTemplate = useCallback((tpl) => {
    let newSchedule = {};
    const add = (roleId, hour, min, taskId, overrideSlots) => {
      const t = TASK_LIBRARY.find(x => x.id === taskId);
      if (!t) return;
      const startMin    = hour * 60 + min;
      const def         = getTaskDefault(t.id);
      const durationMin = overrideSlots ? overrideSlots * 30 : (def.unitMin ?? t.slots * 30);
      const hexColor    = resolveBlockHex(def.color ?? t.color);
      const key         = makeKey(roleId, startMin);
      newSchedule[key]  = { name: t.name, code: t.code, color: hexColor,
        slots: Math.ceil(durationMin / 30), durationMin, notes: t.desc };
    };

    const labels = {
      t1:      'Template 1 — 2 SocPGs + 2 SelPGs (GM+MR)',
      t2:      'Template 2 — 2 SocPGs only (GM+MR)',
      t1_noMR: 'Template 3 — 2 SocPGs + 2 SelPGs (No MR/GM)',
      t2_noMR: 'Template 4 — 2 SocPGs only (No MR/GM)',
      blank:   'Blank Schedule',
    };

    let newAssumptions = { ...assumptions };

    if (tpl === 't1') {
      newAssumptions = { ...newAssumptions, dogs: 65, socpg: 2, selpg: 2, roomsUserEdited: false, catsUserEdited: false, catRoomsUserEdited: false, scUserEdited: false };
      add('TL_AM', 6, 0, 'ON_WT', 1);
      add('TL_AM', 6, 30,'BRFT', 1); add('SOC_BD', 6, 30,'BRFT', 1);
      add('TL_AM', 7, 0, 'GPB_SOC_AM', 1); add('SOC_BD', 7, 0,'GPB_SOC_AM', 1);
      add('PAW', 7, 0, 'PAW_SVC', 8);
      add('SOC_BD', 7, 30,'SC1', 1); add('SOC_SM', 7, 30,'SC1', 1);
      add('SOC_BD', 8, 0, 'SOC_AM_BD', 6);
      add('SOC_SM', 8, 30,'SOC_AM_SM', 6);
      add('TL_AM', 8, 0, 'PGM', 4);
      add('SEL_MID', 9, 0,'SEL_AM1', 2);
      add('UTL_MID', 9, 0,'HK', 5);
      add('TL_AM', 10, 0,'BRK30', 1);
      add('SEL_MID', 10, 30,'SEL_AM2', 2);
      add('PAW', 10, 30,'BRK30', 1);
      add('SOC_BD', 11, 0,'BRK30', 1);
      add('SOC_BD', 11, 30,'LUN', 1);
      add('SOC_SM', 11, 30,'BRK30', 1);
      add('SEL_MID', 11, 30,'SC_PA', 1);
      add('UTL_MID', 11, 30,'SC2', 3); add('SOC_SM', 12, 0,'SC2', 3);
      add('SOC_BD', 12, 0,'CATS', 3);
      add('SEL_MID', 12, 0,'SC_CA', 2);
      add('TL_AM', 12, 30,'TL_ADAM', 2);
      ['PAW','TL_AM','SOC_BD','SOC_SM','SEL_MID','SOC_BPM','SOC_SPM','TL_PM','UTL_MID'].forEach(r => add(r, 13, 30,'HUD', 1));
      add('SOC_BPM', 14, 0,'SOC_PM_BD', 6); add('SOC_SPM', 14, 0,'SOC_PM_SM', 6);
      add('TL_PM', 14, 0,'PGM', 2); add('SEL_MID', 14, 0,'PGM', 1);
      add('UTL_MID', 14, 0,'SC3', 6);
      add('SEL_MID', 14, 30,'SEL_PM1', 2);
      add('TL_PM', 15, 0,'SC_CS', 2);
      add('SEL_MID', 16, 0,'SEL_PM2', 2);
      add('TL_PM', 16, 0,'PGM', 2);
      add('SOC_BPM', 17, 0,'BRK30', 1); add('SOC_SPM', 17, 30,'BRK30', 1);
      add('SOC_SPM', 17, 0,'SC_CA', 1); add('SOC_BPM', 17, 30,'SC_CA', 1);
      add('TL_PM', 17, 0,'BRK30', 1);
      add('SOC_BPM', 18, 0,'DIN', 1); add('SOC_SPM', 18, 0,'DIN', 1);
      add('SOC_BPM', 19, 0,'GPB_SOC_PM', 1); add('SOC_SPM', 19, 0,'GPB_SOC_PM', 1);
      add('TL_PM', 19, 0,'TL_ADPM', 4);
      add('SOC_BPM', 19, 30,'TUCK', 1); add('SOC_SPM', 19, 30,'TUCK', 1);
      add('SOC_BPM', 20, 0,'CLS', 2); add('SOC_SPM', 20, 0,'CLS', 2);
      add('TL_PM', 21, 0,'ON_WT', 1);

    } else if (tpl === 't2') {
      newAssumptions = { ...newAssumptions, dogs: 50, socpg: 2, selpg: 0, roomsUserEdited: false, catsUserEdited: false, catRoomsUserEdited: false, scUserEdited: false };
      add('TL_AM', 6, 0,'ON_WT', 1);
      add('TL_AM', 6, 30,'BRFT', 1); add('SOC_BD', 6, 30,'BRFT', 1);
      add('TL_AM', 7, 0,'GPB_SOC_AM', 1); add('SOC_BD', 7, 0,'GPB_SOC_AM', 1);
      add('PAW', 7, 0,'PAW_SVC', 8);
      add('SOC_BD', 7, 30,'SC1', 1); add('SOC_SM', 7, 30,'SC1', 1);
      add('SOC_BD', 8, 0,'SOC_AM_BD', 6); add('SOC_SM', 8, 30,'SOC_AM_SM', 6);
      add('TL_AM', 8, 0,'PGM', 4);
      add('UTL_MID', 9, 0,'HK', 5);
      add('TL_AM', 10, 0,'BRK30', 1);
      add('UTL_MID', 11, 0,'SC2', 3);
      add('SOC_SM', 11, 30,'BRK30', 1); add('SOC_BD', 11, 0,'BRK30', 1);
      add('SOC_BD', 11, 30,'LUN', 1);
      add('UTL_MID', 11, 30,'SC_PA', 1);
      add('SOC_SM', 12, 0,'SC2', 3); add('SOC_BD', 12, 0,'CATS', 3);
      add('UTL_MID', 12, 0,'SC_CA', 2);
      add('TL_AM', 12, 30,'TL_ADAM', 2);
      ['PAW','TL_AM','SOC_BD','SOC_SM','SOC_BPM','SOC_SPM','TL_PM','UTL_MID'].forEach(r => add(r, 13, 30,'HUD', 1));
      add('SOC_BPM', 14, 0,'SOC_PM_BD', 6); add('SOC_SPM', 14, 0,'SOC_PM_SM', 6);
      add('TL_PM', 14, 0,'PGM', 2);
      add('UTL_MID', 14, 0,'SC3', 6);
      add('TL_PM', 15, 0,'SC_CS', 2); add('TL_PM', 16, 0,'PGM', 2);
      add('SOC_BPM', 17, 0,'BRK30', 1); add('SOC_SPM', 17, 30,'BRK30', 1);
      add('SOC_SPM', 17, 0,'SC_CA', 1); add('SOC_BPM', 17, 30,'SC_CA', 1);
      add('TL_PM', 17, 0,'BRK30', 1);
      add('SOC_BPM', 18, 0,'DIN', 1); add('SOC_SPM', 18, 0,'DIN', 1);
      add('SOC_BPM', 19, 0,'GPB_SOC_PM', 1); add('SOC_SPM', 19, 0,'GPB_SOC_PM', 1);
      add('TL_PM', 19, 0,'TL_ADPM', 4);
      add('SOC_BPM', 19, 30,'TUCK', 1); add('SOC_SPM', 19, 30,'TUCK', 1);
      add('SOC_BPM', 20, 0,'CLS', 2); add('SOC_SPM', 20, 0,'CLS', 2);
      add('TL_PM', 21, 0,'ON_WT', 1);

    } else if (tpl === 't1_noMR') {
      loadTemplate('t1'); return;
    } else if (tpl === 't2_noMR') {
      loadTemplate('t2'); return;
    } else if (tpl === 'blank') {
      newAssumptions = {
        dogs: '', socpg: 0, selpg: 0,
        roomsActual: null, roomsUserEdited: false,
        scActual: null, scUserEdited: false,
        catsActual: null, catsUserEdited: false,
        catRoomsActual: null, catRoomsUserEdited: false,
        date: '',
      };
    }
    // blank: empty schedule

    setSchedule(newSchedule);
    setAssumptions(newAssumptions);
    setScheduleLabel(labels[tpl] || tpl);
  }, [getTaskDefault, assumptions]); // eslint-disable-line

  // ─── Capture / apply state ────────────────────────────────────────────────
  const captureState = useCallback(() => ({ schedule, assumptions }), [schedule, assumptions]);

  const applyState = useCallback((state) => {
    if (state.schedule)    setSchedule(state.schedule);
    if (state.assumptions) setAssumptions(a => ({ ...a, ...state.assumptions }));
  }, []);

  // ─── User templates / postings ────────────────────────────────────────────
  const getUserTemplates = useCallback(() => loadLS(LS_TEMPLATES, {}), []);
  const getUserPostings  = useCallback(() => loadLS(LS_POSTINGS,  {}), []);
  const getUserDrafts    = useCallback(() => loadLS(LS_DRAFTS,    {}), []);
  const saveUserTemplates = useCallback((obj) => { saveLS(LS_TEMPLATES, obj); }, []);
  const saveUserPostings  = useCallback((obj) => { saveLS(LS_POSTINGS,  obj); }, []);
  const saveUserDrafts    = useCallback((obj) => { saveLS(LS_DRAFTS,    obj); }, []);

  // ─── Save user defaults ───────────────────────────────────────────────────
  // Re-apply color overrides to any blocks already on the schedule
  const saveDefaults = useCallback(() => {
    setSchedule(prev => {
      let changed = false;
      const updated = {};
      Object.entries(prev).forEach(([key, block]) => {
        const libTask = TASK_LIBRARY.find(t => t.code === block.code);
        if (!libTask) { updated[key] = block; return; }
        const def    = getTaskDefault(libTask.id);
        const newHex = resolveBlockHex(def.color ?? libTask.color);
        if (newHex !== block.color) {
          // Also update constituent colors in merged blocks
          const newBlock = { ...block, color: newHex };
          if (newBlock.constituents) {
            newBlock.constituents = newBlock.constituents.map(c =>
              c.code === block.code ? { ...c, color: newHex } : c
            );
          }
          updated[key] = newBlock;
          changed = true;
        } else {
          updated[key] = block;
        }
      });
      return changed ? updated : prev;
    });
  }, [getTaskDefault]);

  const resetDefaults = useCallback(() => {
    setUserTaskDefs({}); setUserRoleDefs({}); setUserProgramDefs({});
  }, []);

  return (
    <SchedulerContext.Provider value={{
      // State
      schedule, setSchedule,
      assumptions, setAssumptions,
      scheduleLabel, setScheduleLabel,
      extraRoles, setExtraRoles,
      columnOrder, setColumnOrder,
      // Defaults
      userTaskDefs, userRoleDefs, userProgramDefs,
      NOBLE_TASK_DEFAULTS, NOBLE_ROLE_DEFAULTS, NOBLE_PROGRAM_DEFAULTS,
      // Getters
      getTaskDefault, getRoleConfig, getProgramPct, getDerivedValues,
      // User defaults setters
      setUserTaskDefs, setUserRoleDefs, setUserProgramDefs,
      // Actions
      loadTemplate, captureState, applyState,
      getUserTemplates, getUserPostings, getUserDrafts,
      saveUserTemplates, saveUserPostings, saveUserDrafts,
      saveDefaults, resetDefaults,
    }}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler() {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error('useScheduler must be used within SchedulerProvider');
  return ctx;
}
