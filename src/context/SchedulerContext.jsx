import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ROLES } from '../data/roles';
import { TASK_LIBRARY, CAT_ORDER, CAT_LABELS } from '../data/taskLibrary';
import { resolveBlockHex } from '../data/palette';
import { makeKey, keyToRoleAndMin } from '../utils/scheduling';
import { apiSetup, apiTemplates, apiSchedules, isLoggedIn } from '../api';

// ─── localStorage keys ───────────────────────────────────────────────────────
const LS_TASKS    = 'noble_task_defaults';
const LS_ROLES    = 'noble_role_defaults';
const LS_PROGRAMS = 'noble_program_defaults';
const LS_TEMPLATES        = 'noble_user_templates';
const LS_MASTER_TEMPLATES = 'noble_master_templates';
const LS_POSTINGS         = 'noble_user_postings';
const LS_DRAFTS           = 'noble_drafts';
const LS_EXTRA_ROLES = 'noble_extra_roles';
const LS_COL_ORDER   = 'noble_column_order';
const LS_CAT_DEFS    = 'noble_cat_defs';    // { [catId]: { label?, deleted?, custom?, color? } }
const LS_CAT_ORDER   = 'noble_cat_order';   // [catId, ...]
const LS_TASK_ORDER  = 'noble_task_order';  // { [catId]: [taskId, ...] }
const LS_SESSION     = 'noble_session_state'; // { schedule, assumptions } — auto-saved on every change

const NOBLE_PROGRAM_DEFAULTS = { social: 65, select: 20, pf: 15, cats: 20, multipet: 15, multipetCats: 15 };

// Tasks that should NOT count toward scheduled hours totals (unpaid breaks etc.)
const COUNT_HOURS_FALSE = new Set(['BRK30', 'LUN']);

// Build Noble baseline defaults from task library and roles
const NOBLE_TASK_DEFAULTS = {};
TASK_LIBRARY.forEach(t => {
  NOBLE_TASK_DEFAULTS[t.id] = {
    slots: t.slots, unitMin: t.unitMin ?? null,
    unitBasis: t.unitBasis ?? '', idealStart: t.idealStart ?? '',
    color: t.color ?? 'block-group',
    countHours: !COUNT_HOURS_FALSE.has(t.id),
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
  const [schedule,       setSchedule]       = useState(() => loadLS(LS_SESSION, null)?.schedule ?? {});
  const [assumptions,    setAssumptions]    = useState(() => ({
    dogs: 65, socpg: 2, selpg: 2,
    roomsActual: null, roomsUserEdited: false,
    scActual: null, scUserEdited: false,
    catsActual: null, catsUserEdited: false,
    catRoomsActual: null, catRoomsUserEdited: false,
    date: new Date().toISOString().split('T')[0],
    ...(loadLS(LS_SESSION, null)?.assumptions ?? {}),
  }));
  const [userTaskDefs,   setUserTaskDefs]   = useState(() => loadLS(LS_TASKS, {}));
  const [userRoleDefs,   setUserRoleDefs]   = useState(() => loadLS(LS_ROLES, {}));
  const [userProgramDefs,setUserProgramDefs]= useState(() => loadLS(LS_PROGRAMS, {}));
  const [extraRoles,     setExtraRoles]     = useState(() => loadLS(LS_EXTRA_ROLES, []));
  const [columnOrder,    setColumnOrder]    = useState(() => {
    const stored     = loadLS(LS_COL_ORDER, null);
    const savedRoles = loadLS(LS_ROLES, {});
    // Include any custom roles from userRoleDefs not yet in stored order
    const customIds  = Object.entries(savedRoles)
      .filter(([, def]) => def.custom && !def.deleted)
      .map(([id]) => id);
    const base    = stored ?? ROLES.map(r => r.id);
    const missing = customIds.filter(id => !base.includes(id));
    return [...base, ...missing];
  });
  // Persisted in LS_SESSION so it survives page reload; also saved with templates/drafts
  const [hiddenColumns,  setHiddenColumns]  = useState(() => new Set(loadLS(LS_SESSION, null)?.hiddenColumns ?? []));
  const [scheduleLabel,  setScheduleLabel]  = useState('Template 1 — 2 SocPGs + 2 SelPGs');
  const [userCatDefs,    setUserCatDefs]    = useState(() => loadLS(LS_CAT_DEFS,   {}));
  const [catOrder,       setCatOrder]       = useState(() => loadLS(LS_CAT_ORDER,  [...CAT_ORDER]));
  const [taskOrder,      setTaskOrder]      = useState(() => loadLS(LS_TASK_ORDER, {}));
  // Custom tasks — persisted in LS_SESSION so they survive page reloads; also saved/restored with drafts/templates
  const [sessionTaskDefs, setSessionTaskDefs] = useState(() => loadLS(LS_SESSION, null)?.sessionTaskDefs ?? {});
  const [skippedTasks, setSkippedTasks] = useState(() => {
    const arr = loadLS(LS_SESSION, null)?.skippedTasks ?? [];
    return new Set(arr);
  });

  // In-memory stores for templates / schedules (populated from API on mount)
  const [masterTemplatesData, setMasterTemplatesData] = useState(() => loadLS(LS_MASTER_TEMPLATES, {}));
  const [userTemplatesData,   setUserTemplatesData]   = useState(() => loadLS(LS_TEMPLATES,        {}));
  const [draftsData,          setDraftsData]          = useState(() => loadLS(LS_DRAFTS,           {}));
  const [postingsData,        setPostingsData]        = useState(() => loadLS(LS_POSTINGS,         {}));

  // Persist user defaults on change (write-through cache — API is source of truth)
  useEffect(() => { saveLS(LS_TASKS,       userTaskDefs);    }, [userTaskDefs]);
  useEffect(() => { saveLS(LS_ROLES,       userRoleDefs);    }, [userRoleDefs]);
  useEffect(() => { saveLS(LS_PROGRAMS,    userProgramDefs); }, [userProgramDefs]);
  useEffect(() => { saveLS(LS_EXTRA_ROLES, extraRoles);      }, [extraRoles]);
  useEffect(() => { saveLS(LS_COL_ORDER,   columnOrder);     }, [columnOrder]);
  useEffect(() => { saveLS(LS_CAT_DEFS,    userCatDefs);     }, [userCatDefs]);
  useEffect(() => { saveLS(LS_CAT_ORDER,   catOrder);        }, [catOrder]);
  useEffect(() => { saveLS(LS_TASK_ORDER,  taskOrder);       }, [taskOrder]);

  // Auto-save current schedule + assumptions so they survive page reloads
  useEffect(() => {
    saveLS(LS_SESSION, { schedule, assumptions, skippedTasks: [...skippedTasks], hiddenColumns: [...hiddenColumns], sessionTaskDefs });
  }, [schedule, assumptions, skippedTasks, hiddenColumns, sessionTaskDefs]);

  // ─── API hydration on mount ───────────────────────────────────────────────
  // Fetch all data from API and update state (API wins over localStorage cache)
  useEffect(() => {
    if (!isLoggedIn()) return;
    async function hydrate() {
      try {
        const [tasks, roles, progMix, cats, master, user, drafts, postings] = await Promise.allSettled([
          apiSetup.getTasks(),
          apiSetup.getRoles(),
          apiSetup.getProgramMix(),
          apiSetup.getCategories(),
          apiTemplates.getMaster(),
          apiTemplates.getUser(),
          apiSchedules.getDrafts(),
          apiSchedules.getPostings(),
        ]);
        if (tasks.status    === 'fulfilled' && Object.keys(tasks.value).length)
          // Merge: API data for library overrides; preserve local custom default tasks not yet pushed to API
          setUserTaskDefs(prev => {
            const localCustom = Object.fromEntries(
              Object.entries(prev).filter(([, def]) => def.custom)
            );
            return { ...tasks.value, ...localCustom };
          });
        if (roles.status    === 'fulfilled' && Object.keys(roles.value).length)
          setUserRoleDefs(roles.value);
        if (progMix.status  === 'fulfilled')
          setUserProgramDefs(progMix.value);
        if (cats.status     === 'fulfilled') {
          const { catDefs, catOrder: co, taskOrder: to } = cats.value;
          if (catDefs  && Object.keys(catDefs).length)  setUserCatDefs(catDefs);
          if (co       && co.length)                    setCatOrder(co);
          if (to       && Object.keys(to).length)       setTaskOrder(to);
        }
        if (master.status   === 'fulfilled') { setMasterTemplatesData(master.value); saveLS(LS_MASTER_TEMPLATES, master.value); }
        if (user.status     === 'fulfilled') { setUserTemplatesData(user.value);     saveLS(LS_TEMPLATES,        user.value); }
        if (drafts.status   === 'fulfilled') { setDraftsData(drafts.value);          saveLS(LS_DRAFTS,           drafts.value); }
        if (postings.status === 'fulfilled') { setPostingsData(postings.value);      saveLS(LS_POSTINGS,         postings.value); }
      } catch (err) {
        console.warn('API hydration failed — using localStorage cache:', err.message);
      }
    }
    hydrate();
  }, []); // eslint-disable-line

  // ─── Category helpers ─────────────────────────────────────────────────────
  // Returns merged, ordered list of all categories (built-in + custom).
  // Each entry: { id, label, deleted }
  const getFullCatList = useCallback(() => {
    // catOrder may not yet include custom cats added after initial load — append any missing ones
    const customIds = Object.keys(userCatDefs).filter(id => userCatDefs[id]?.custom && !catOrder.includes(id));
    const allIds    = [...catOrder, ...customIds];
    return allIds.map(id => {
      const override  = userCatDefs[id] || {};
      const isBuiltin = CAT_ORDER.includes(id);
      if (!isBuiltin && !override.custom) return null; // unknown id, skip
      return {
        id,
        label:   override.label   ?? CAT_LABELS[id] ?? id,
        deleted: override.deleted ?? false,
      };
    }).filter(Boolean);
  }, [userCatDefs, catOrder]);

  // ─── Getters ─────────────────────────────────────────────────────────────
  const getTaskDefault = useCallback((taskId) => {
    const base    = NOBLE_TASK_DEFAULTS[taskId] || {};
    const libTask = TASK_LIBRARY.find(t => t.id === taskId);
    const user    = userTaskDefs[taskId] || {};
    return {
      slots:      user.slots      ?? base.slots,
      unitMin:    user.durationMin ?? user.unitMin ?? base.unitMin,
      unitBasis:  user.unitBasis  ?? base.unitBasis,
      idealStart: user.idealStart ?? base.idealStart,
      color:      user.color      ?? base.color,
      countHours: user.countHours ?? base.countHours ?? true,
      code:       user.code       ?? libTask?.code ?? taskId,
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

  // Returns all active roles: built-in with overrides, then custom roles.
  // Deleted roles are excluded. Consumed by GridHeader/GridBody instead of raw ROLES.
  const getEffectiveRoles = useCallback(() => {
    // Built-in roles with any user overrides applied
    const builtIn = ROLES
      .filter(r => !userRoleDefs[r.id]?.deleted)
      .map(r => {
        const over = userRoleDefs[r.id] || {};
        return {
          ...r,
          label:        over.label        ?? r.label,
          sub:          over.sub          ?? r.sub,
          shiftStart:   over.shiftStart   ?? r.shiftStart,
          shiftEnd:     over.shiftEnd     ?? r.shiftEnd,
          unpaidBreak:  over.unpaidBreak  ?? (r.unpaidBreak ?? 0),
          hours:        over.hours        ?? r.hours,
          includeInHrs: over.includeInHrs ?? (r.type === 'TM' || r.type === 'TL'),
        };
      });
    // Custom roles added via Role Config
    const custom = Object.entries(userRoleDefs)
      .filter(([, def]) => def.custom && !def.deleted)
      .map(([id, def]) => ({
        id,
        label:        def.label        || id,
        sub:          def.sub          || '',
        type:         def.type         || 'TM',
        shiftStart:   def.shiftStart   ?? 9,
        shiftEnd:     def.shiftEnd     ?? 17,
        unpaidBreak:  def.unpaidBreak  ?? 30,
        hours:        def.hours        ?? 7.5,
        custom:       true,
        includeInHrs: def.includeInHrs ?? true,
      }));
    return [...builtIn, ...custom];
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

    const totalRooms = suites + bungalows;
    return { suites, cats, bungalows, scCount, totalRooms, estRooms, estCats, estBung, estSC, pct };
  }, [assumptions, getProgramPct]);

  // ─── Load template ────────────────────────────────────────────────────────
  const loadTemplate = useCallback((tpl) => {
    let newSchedule = {};
    const add = (roleId, hour, min, taskId, overrideSlots) => {
      const t = TASK_LIBRARY.find(x => x.id === taskId);
      if (!t) return;
      const startMin    = hour * 60 + min;
      const def         = getTaskDefault(t.id);
      const durationMin = overrideSlots ? overrideSlots * 30 : Number(def.unitMin ?? t.slots * 30);
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
    setSessionTaskDefs({}); // clear session-only custom tasks on template load
    // Reset column order to all effective roles (built-in + custom) and clear session hides
    setColumnOrder(getEffectiveRoles().map(r => r.id));
    setHiddenColumns(new Set());
  }, [getTaskDefault, getEffectiveRoles, assumptions]); // eslint-disable-line

  // ─── Capture / apply state ────────────────────────────────────────────────
  const captureState = useCallback(
    () => ({ schedule, assumptions, sessionTaskDefs, columnOrder, extraRoles, skippedTasks: [...skippedTasks], hiddenColumns: [...hiddenColumns] }),
    [schedule, assumptions, sessionTaskDefs, columnOrder, extraRoles, skippedTasks, hiddenColumns]
  );

  const applyState = useCallback((state) => {
    if (state.schedule)                                  setSchedule(state.schedule);
    if (state.assumptions)                               setAssumptions(a => ({ ...a, ...state.assumptions }));
    setSessionTaskDefs(state.sessionTaskDefs || {});
    if (Array.isArray(state.extraRoles))                 setExtraRoles(state.extraRoles);
    if (Array.isArray(state.columnOrder) && state.columnOrder.length > 0)
      setColumnOrder(state.columnOrder);
    setSkippedTasks(new Set(Array.isArray(state.skippedTasks) ? state.skippedTasks : []));
    setHiddenColumns(new Set(Array.isArray(state.hiddenColumns) ? state.hiddenColumns : []));
  }, []);

  const toggleSkipTask = useCallback((taskId) => {
    setSkippedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  // ─── Template / schedule getters (read from state — already API-hydrated) ──
  const getUserTemplates   = useCallback(() => userTemplatesData,   [userTemplatesData]);
  const getMasterTemplates = useCallback(() => masterTemplatesData, [masterTemplatesData]);
  const getUserPostings    = useCallback(() => postingsData,        [postingsData]);
  const getUserDrafts      = useCallback(() => draftsData,          [draftsData]);

  // ─── Template / schedule savers (update state + localStorage + API) ────────
  const saveUserTemplates = useCallback(async (obj) => {
    setUserTemplatesData(obj); saveLS(LS_TEMPLATES, obj);
  }, []);

  const saveMasterTemplates = useCallback(async (obj) => {
    setMasterTemplatesData(obj); saveLS(LS_MASTER_TEMPLATES, obj);
  }, []);

  const saveUserPostings = useCallback(async (obj) => {
    setPostingsData(obj); saveLS(LS_POSTINGS, obj);
  }, []);

  const saveUserDrafts = useCallback(async (obj) => {
    setDraftsData(obj); saveLS(LS_DRAFTS, obj);
  }, []);

  // ─── API-backed save for a single template/schedule ───────────────────────
  const apiSaveTemplate = useCallback(async (name, state, type) => {
    try {
      if (type === 'master') {
        await apiTemplates.saveMaster(name, state);
        const updated = { ...masterTemplatesData, [name]: state };
        setMasterTemplatesData(updated); saveLS(LS_MASTER_TEMPLATES, updated);
      } else {
        await apiTemplates.saveUser(name, state);
        const updated = { ...userTemplatesData, [name]: state };
        setUserTemplatesData(updated); saveLS(LS_TEMPLATES, updated);
      }
    } catch (err) {
      console.warn('API template save failed — saved locally only:', err.message);
      if (type === 'master') {
        const updated = { ...masterTemplatesData, [name]: state };
        setMasterTemplatesData(updated); saveLS(LS_MASTER_TEMPLATES, updated);
      } else {
        const updated = { ...userTemplatesData, [name]: state };
        setUserTemplatesData(updated); saveLS(LS_TEMPLATES, updated);
      }
    }
  }, [masterTemplatesData, userTemplatesData]);

  const apiSaveSchedule = useCallback(async (name, state, status) => {
    try {
      await apiSchedules.save({
        name,
        scheduleDate: state.assumptions?.date || null,
        status,
        schedule:     state.schedule     || {},
        assumptions:  state.assumptions  || {},
        sessionTaskDefs: state.sessionTaskDefs || {},
      });
      if (status === 'draft') {
        const updated = { ...draftsData, [name]: state };
        setDraftsData(updated); saveLS(LS_DRAFTS, updated);
      } else {
        const updated = { ...postingsData, [name]: state };
        setPostingsData(updated); saveLS(LS_POSTINGS, updated);
      }
    } catch (err) {
      console.warn('API schedule save failed — saved locally only:', err.message);
      if (status === 'draft') {
        const updated = { ...draftsData, [name]: state };
        setDraftsData(updated); saveLS(LS_DRAFTS, updated);
      } else {
        const updated = { ...postingsData, [name]: state };
        setPostingsData(updated); saveLS(LS_POSTINGS, updated);
      }
    }
  }, [draftsData, postingsData]);

  const apiDeleteTemplate = useCallback(async (name, type) => {
    try {
      if (type === 'master') await apiTemplates.deleteMaster(name);
      else                   await apiTemplates.deleteUser(name);
    } catch (err) {
      console.warn('API delete failed:', err.message);
    }
    if (type === 'master') {
      const updated = { ...masterTemplatesData }; delete updated[name];
      setMasterTemplatesData(updated); saveLS(LS_MASTER_TEMPLATES, updated);
    } else {
      const updated = { ...userTemplatesData }; delete updated[name];
      setUserTemplatesData(updated); saveLS(LS_TEMPLATES, updated);
    }
  }, [masterTemplatesData, userTemplatesData]);

  // ─── Save user defaults ───────────────────────────────────────────────────
  // Re-apply color and code overrides to any blocks already on the schedule
  const saveDefaults = useCallback(() => {
    setSchedule(prev => {
      let changed = false;
      const updated = {};
      Object.entries(prev).forEach(([key, block]) => {
        // Find library task by original code; fall back to reverse-lookup via userTaskDefs
        // (handles blocks whose code was already overridden in a previous save)
        let libTask = TASK_LIBRARY.find(t => t.code === block.code);
        if (!libTask) {
          const entry = Object.entries(userTaskDefs).find(([, def]) => def.code === block.code);
          if (entry) libTask = TASK_LIBRARY.find(t => t.id === entry[0]);
        }
        if (!libTask) { updated[key] = block; return; }
        const def     = getTaskDefault(libTask.id);
        const newHex  = resolveBlockHex(def.color ?? libTask.color);
        const newCode = def.code ?? libTask.code;
        if (newHex !== block.color || newCode !== block.code) {
          const oldCode  = block.code;
          const newBlock = { ...block, color: newHex, code: newCode };
          // Also update constituent codes/colors in merged blocks
          if (newBlock.constituents) {
            newBlock.constituents = newBlock.constituents.map(c =>
              c.code === oldCode ? { ...c, color: newHex, code: newCode } : c
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
  }, [getTaskDefault, userTaskDefs]);

  // Also push setup defaults to API
  const persistDefaultsToApi = useCallback(async (tasks, roles, progMix, cats, co, to) => {
    if (!isLoggedIn()) return;
    try {
      await Promise.all([
        Object.keys(tasks).length  && apiSetup.saveTasks(tasks),
        Object.keys(roles).length  && apiSetup.saveRoles(roles),
        apiSetup.saveProgramMix(progMix),
        apiSetup.saveCategories({ catDefs: cats, catOrder: co, taskOrder: to }),
      ].filter(Boolean));
    } catch (err) {
      console.warn('API defaults save failed — saved locally only:', err.message);
    }
  }, []);

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
      hiddenColumns,
      hideColumn:    (id) => setHiddenColumns(prev => new Set([...prev, id])),
      restoreColumn: (id) => setHiddenColumns(prev => { const s = new Set(prev); s.delete(id); return s; }),
      userCatDefs, setUserCatDefs,
      catOrder, setCatOrder,
      taskOrder, setTaskOrder,
      getFullCatList,
      // Defaults
      userTaskDefs, userRoleDefs, userProgramDefs,
      // Session-only custom tasks (not persisted; saved/restored with schedule)
      sessionTaskDefs, setSessionTaskDefs,
      NOBLE_TASK_DEFAULTS, NOBLE_ROLE_DEFAULTS, NOBLE_PROGRAM_DEFAULTS,
      // Getters
      getTaskDefault, getRoleConfig, getProgramPct, getDerivedValues, getEffectiveRoles,
      // User defaults setters
      setUserTaskDefs, setUserRoleDefs, setUserProgramDefs,
      // Skipped tasks
      skippedTasks, toggleSkipTask,
      // Actions
      loadTemplate, captureState, applyState,
      getUserTemplates, getMasterTemplates, getUserPostings, getUserDrafts,
      saveUserTemplates, saveMasterTemplates, saveUserPostings, saveUserDrafts,
      apiSaveTemplate, apiSaveSchedule, apiDeleteTemplate, persistDefaultsToApi,
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
