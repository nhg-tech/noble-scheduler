import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { resolveBlockHex } from '../data/palette';
import { legacySlotsToMinutes, makeKey, minutesToGridSlots } from '../utils/scheduling';
import { apiSetup, apiTemplates, apiSchedules, isLoggedIn } from '../api';
import {
  deleteScheduleRecord,
  deleteTemplateRecord,
  persistScheduleRecord,
  persistTemplateRecord,
} from './schedulerPersistence';

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
const LS_COL_WIDTH   = 'noble_col_width';
const LS_CAT_DEFS    = 'noble_cat_defs';    // { [catId]: { label?, deleted?, custom?, color? } }
const LS_CAT_ORDER   = 'noble_cat_order';   // [catId, ...]
const LS_TASK_ORDER  = 'noble_task_order';  // { [catId]: [taskId, ...] }
const LS_SESSION     = 'noble_session_state'; // { schedule, assumptions } — auto-saved on every change

const NOBLE_PROGRAM_DEFAULTS = { social: 65, select: 20, pf: 15, cats: 20, multipet: 15, multipetCats: 15 };



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
    // Include any roles from userRoleDefs not yet in stored order
    const base    = stored ?? Object.keys(savedRoles).filter(id => !savedRoles[id].deleted);
    const missing = Object.keys(savedRoles).filter(id => !savedRoles[id].deleted && !base.includes(id));
    return [...base, ...missing];
  });
  // Persisted in LS_SESSION so it survives page reload; also saved with templates/drafts
  const [hiddenColumns,  setHiddenColumns]  = useState(() => new Set(loadLS(LS_SESSION, null)?.hiddenColumns ?? []));
  const [scheduleLabel,  setScheduleLabel]  = useState('Blank Schedule');
  const [currentLoadedEntity, setCurrentLoadedEntity] = useState({ kind: 'builtin', scope: 'builtin', name: 'blank' });
  const [userCatDefs,    setUserCatDefs]    = useState(() => loadLS(LS_CAT_DEFS,   {}));
  const [catOrder,       setCatOrder]       = useState(() => loadLS(LS_CAT_ORDER,  []));
  const [taskOrder,      setTaskOrder]      = useState(() => loadLS(LS_TASK_ORDER, {}));
  // Column width — shared between GridBody and PrintLayout; persisted across sessions
  const [colWidth, setColWidth] = useState(() => loadLS(LS_COL_WIDTH, 120));

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
  useEffect(() => { saveLS(LS_COL_WIDTH,   colWidth);        }, [colWidth]);
  useEffect(() => { saveLS(LS_CAT_DEFS,    userCatDefs);     }, [userCatDefs]);
  useEffect(() => { saveLS(LS_CAT_ORDER,   catOrder);        }, [catOrder]);
  useEffect(() => { saveLS(LS_TASK_ORDER,  taskOrder);       }, [taskOrder]);

  // Auto-save current schedule + assumptions so they survive page reloads
  useEffect(() => {
    saveLS(LS_SESSION, { schedule, assumptions, skippedTasks: [...skippedTasks], hiddenColumns: [...hiddenColumns], sessionTaskDefs, scheduleLabel });
  }, [schedule, assumptions, skippedTasks, hiddenColumns, sessionTaskDefs, scheduleLabel]);

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
          // API is authoritative; preserve any local entries not yet pushed to API (e.g. created but not yet saved)
          setUserTaskDefs(prev => {
            const localOnly = Object.fromEntries(
              Object.entries(prev).filter(([id]) => !(id in tasks.value))
            );
            return { ...tasks.value, ...localOnly };
          });
        if (roles.status    === 'fulfilled') {
          // GET /setup/roles now returns { roles, columnOrder }.
          const apiRoles       = roles.value.roles       ?? roles.value; // fallback: legacy flat object
          const apiColumnOrder = roles.value.columnOrder ?? null;
          if (Object.keys(apiRoles).length) {
            // Merge: API is authoritative for base fields; local overrides win for any
            // field the API didn't return (e.g. includeInHrs before first Save Defaults,
            // or custom roles not yet pushed to API).
            setUserRoleDefs(prev => {
              const merged = { ...apiRoles };
              Object.entries(prev).forEach(([id, localDef]) => {
                merged[id] = merged[id]
                  ? { ...merged[id], ...localDef }   // local fields layer on top of API
                  : localDef;                         // custom role not yet in API
              });
              return merged;
            });
          }
          // Restore column order from DB — API is source of truth; localStorage is just a cache.
          // Only apply if the API returned a non-empty order; preserves local order if not yet saved.
          if (apiColumnOrder && apiColumnOrder.length) {
            setColumnOrder(prev => {
              // Append any local-only roles (e.g. custom roles not yet saved to API) at the end.
              const localOnly = prev.filter(id => !apiColumnOrder.includes(id));
              return [...apiColumnOrder, ...localOnly];
            });
          }
        }
        if (progMix.status  === 'fulfilled') {
          setUserProgramDefs(progMix.value);
          // Apply "Today's Actuals" defaults to assumptions — only fills gaps,
          // never overwrites values the user has already set this session.
          const pm = progMix.value;
          setAssumptions(prev => ({
            ...prev,
            ...(prev.dogs  == null && pm.defaultDogs  != null && { dogs:  pm.defaultDogs  }),
            ...(prev.socpg == null && pm.defaultSocpg != null && { socpg: pm.defaultSocpg }),
            ...(prev.selpg == null && pm.defaultSelpg != null && { selpg: pm.defaultSelpg }),
          }));
        }
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

  // ─── Phase 2: taskLibrary — DB-driven array, replaces hardcoded TASK_LIBRARY ─
  // All non-hidden tasks from DB (base library + user-created defaults).
  const taskLibrary = useMemo(() =>
    Object.entries(userTaskDefs)
      .filter(([, t]) => !t.hidden)
      .map(([id, t]) => ({ id, ...t })),
    [userTaskDefs]
  );

  // ─── Category helpers ─────────────────────────────────────────────────────
  // Returns merged, ordered list of all categories.
  // Each entry: { id, label, deleted }
  const getFullCatList = useCallback(() => {
    // All categories: ordered ones first, then any in userCatDefs not yet in catOrder
    const extraIds = Object.keys(userCatDefs).filter(id => !catOrder.includes(id));
    const allIds   = [...catOrder, ...extraIds];
    return allIds.map(id => {
      const cat = userCatDefs[id] || {};
      return {
        id,
        label:   cat.label   ?? id,
        color:   cat.color   ?? null,
        deleted: cat.deleted ?? false,
      };
    });
  }, [userCatDefs, catOrder]);

  // ─── Getters ─────────────────────────────────────────────────────────────
  // Phase 2: DB is source of truth — userTaskDefs contains full task data.
  const getTaskDefault = useCallback((taskId) => {
    const task = userTaskDefs[taskId] || {};
    return {
      slots:        task.slots,
      unitMin:      task.durationMin ?? task.unitMin,
      unitBasis:    task.unitBasis,
      idealStart:   task.idealStart,
      color:        task.color,
      countHours:   task.countHours ?? true,
      code:         task.code ?? taskId,
      minResources: task.minResources ?? null,
    };
  }, [userTaskDefs]);

  const getRoleConfig = useCallback((roleId) => {
    const role = userRoleDefs[roleId] || {};
    return {
      shiftStart:   role.shiftStart,
      shiftEnd:     role.shiftEnd,
      hours:        role.hours,
      includeInHrs: role.includeInHrs,
    };
  }, [userRoleDefs]);

  // Phase 2: all roles (base + custom) live in userRoleDefs from DB.
  // Deleted roles are excluded.
  const getEffectiveRoles = useCallback(() => {
    return Object.entries(userRoleDefs)
      .filter(([, r]) => !r.deleted)
      .map(([id, r]) => ({
        id,
        label:        r.label        || id,
        sub:          r.sub          || '',
        type:         r.type         || 'TM',
        shiftStart:   r.shiftStart   ?? 9,
        shiftEnd:     r.shiftEnd     ?? 17,
        unpaidBreak:  r.unpaidBreak  ?? 0,
        hours:        r.hours        ?? 7.5,
        includeInHrs: r.includeInHrs,
      }));
  }, [userRoleDefs]);

  // Returns soft-deleted roles in the same shape — used by the grid to show
  // deleted role columns still referenced in saved schedules/drafts/templates.
  const getDeletedRoles = useCallback(() => {
    return Object.entries(userRoleDefs)
      .filter(([, r]) => r.deleted)
      .map(([id, r]) => ({
        id,
        label:        r.label        || id,
        sub:          r.sub          || '',
        type:         r.type         || 'TM',
        shiftStart:   r.shiftStart   ?? 9,
        shiftEnd:     r.shiftEnd     ?? 17,
        unpaidBreak:  r.unpaidBreak  ?? 0,
        hours:        r.hours        ?? 7.5,
        includeInHrs: false,
        deleted:      true,
      }));
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
      const taskData = userTaskDefs[taskId];
      if (!taskData) return;
      const t = { id: taskId, ...taskData };
      const startMin    = hour * 60 + min;
      const def         = getTaskDefault(t.id);
      const durationMin = overrideSlots
        ? legacySlotsToMinutes(overrideSlots)
        : Number(def.unitMin ?? legacySlotsToMinutes(t.slots));
      const hexColor    = resolveBlockHex(def.color ?? t.color);
      const key         = makeKey(roleId, startMin);
      newSchedule[key]  = { name: t.name, code: t.code, taskId: t.id, color: hexColor,
        slots: minutesToGridSlots(durationMin), durationMin, notes: t.desc };
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
    setCurrentLoadedEntity({ kind: 'builtin', scope: 'builtin', name: tpl });
    setSessionTaskDefs({}); // clear session-only custom tasks on template load
    // Reset column order to all effective roles (built-in + custom) and clear session hides
    setColumnOrder(getEffectiveRoles().map(r => r.id));
    setHiddenColumns(new Set());
  }, [getTaskDefault, getEffectiveRoles, assumptions, userTaskDefs]); // eslint-disable-line

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
    return persistTemplateRecord({
      name,
      state,
      type,
      apiTemplates,
      masterTemplatesData,
      userTemplatesData,
      setMasterTemplatesData,
      setUserTemplatesData,
      saveLS,
      masterTemplatesKey: LS_MASTER_TEMPLATES,
      userTemplatesKey: LS_TEMPLATES,
    });
  }, [masterTemplatesData, userTemplatesData]);

  const apiSaveSchedule = useCallback(async (name, state, status, existingSchedule = null) => {
    return persistScheduleRecord({
      name,
      state,
      status,
      existingSchedule,
      apiSchedules,
      draftsData,
      postingsData,
      setDraftsData,
      setPostingsData,
      saveLS,
      draftsKey: LS_DRAFTS,
      postingsKey: LS_POSTINGS,
    });
  }, [draftsData, postingsData]);

  const apiDeleteSchedule = useCallback(async (id, status, name) => {
    return deleteScheduleRecord({
      id,
      status,
      name,
      apiSchedules,
      draftsData,
      postingsData,
      setDraftsData,
      setPostingsData,
      saveLS,
      draftsKey: LS_DRAFTS,
      postingsKey: LS_POSTINGS,
    });
  }, [draftsData, postingsData]);

  const apiDeleteTemplate = useCallback(async (name, type) => {
    return deleteTemplateRecord({
      name,
      type,
      apiTemplates,
      masterTemplatesData,
      userTemplatesData,
      setMasterTemplatesData,
      setUserTemplatesData,
      saveLS,
      masterTemplatesKey: LS_MASTER_TEMPLATES,
      userTemplatesKey: LS_TEMPLATES,
    });
  }, [masterTemplatesData, userTemplatesData]);

  // ─── Save user defaults ───────────────────────────────────────────────────
  // Re-apply color and code overrides to any blocks already on the schedule
  const saveDefaults = useCallback(() => {
    setSchedule(prev => {
      let changed = false;
      const updated = {};
      Object.entries(prev).forEach(([key, block]) => {
        // Look up task by code from userTaskDefs (DB is source of truth in Phase 2)
        const entry = Object.entries(userTaskDefs).find(([, def]) => def.code === block.code);
        if (!entry) { updated[key] = block; return; }
        const [taskId, taskData] = entry;
        const def     = getTaskDefault(taskId);
        const newHex  = resolveBlockHex(def.color ?? taskData.color);
        const newCode = def.code ?? taskData.code;
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

  // Also push setup defaults to API — throws on failure so callers can surface the error
  const persistDefaultsToApi = useCallback(async (tasks, roles, progMix, cats, co, to, colOrder) => {
    if (!isLoggedIn()) return;
    // Include "Today's Actuals" from assumptions so they persist as defaults in the DB
    const progMixWithActuals = {
      ...progMix,
      defaultDogs:  assumptions.dogs  ?? null,
      defaultSocpg: assumptions.socpg ?? null,
      defaultSelpg: assumptions.selpg ?? null,
    };
    await Promise.all([
      Object.keys(tasks).length  && apiSetup.saveTasks(tasks),
      Object.keys(roles).length  && apiSetup.saveRoles(roles, colOrder ?? []),
      apiSetup.saveProgramMix(progMixWithActuals),
      apiSetup.saveCategories({ catDefs: cats, catOrder: co, taskOrder: to }),
    ].filter(Boolean));
  }, [assumptions]);

  const resetDefaults = useCallback(() => {
    setUserTaskDefs({}); setUserRoleDefs({}); setUserProgramDefs({});
  }, []);

  return (
    <SchedulerContext.Provider value={{
      // State
      schedule, setSchedule,
      assumptions, setAssumptions,
      scheduleLabel, setScheduleLabel,
      currentLoadedEntity, setCurrentLoadedEntity,
      extraRoles, setExtraRoles,
      columnOrder, setColumnOrder,
      hiddenColumns,
      hideColumn:    (id) => setHiddenColumns(prev => new Set([...prev, id])),
      restoreColumn: (id) => setHiddenColumns(prev => { const s = new Set(prev); s.delete(id); return s; }),
      userCatDefs, setUserCatDefs,
      catOrder, setCatOrder,
      taskOrder, setTaskOrder,
      getFullCatList,
      // Phase 2: DB-driven task library (array format, replaces hardcoded TASK_LIBRARY)
      taskLibrary,
      // Defaults
      userTaskDefs, userRoleDefs, userProgramDefs,
      // Session-only custom tasks (not persisted; saved/restored with schedule)
      sessionTaskDefs, setSessionTaskDefs,
      colWidth, setColWidth,
      NOBLE_PROGRAM_DEFAULTS,
      // Getters
      getTaskDefault, getRoleConfig, getProgramPct, getDerivedValues, getEffectiveRoles, getDeletedRoles,
      // User defaults setters
      setUserTaskDefs, setUserRoleDefs, setUserProgramDefs,
      // Skipped tasks
      skippedTasks, toggleSkipTask,
      // Actions
      loadTemplate, captureState, applyState,
      getUserTemplates, getMasterTemplates, getUserPostings, getUserDrafts,
      saveUserTemplates, saveMasterTemplates, saveUserPostings, saveUserDrafts,
      apiSaveTemplate, apiSaveSchedule, apiDeleteTemplate, apiDeleteSchedule, persistDefaultsToApi,
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
