import { useEffect, useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useScheduler } from '../../context/SchedulerContext';
import { apiSchedules, apiStaffing } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { ACTIONS, RESOURCES } from '../../permissions';

const PANEL_TITLE = { fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 8 };
const PANEL_SECTION = { borderBottom: '1px solid var(--gray-light)', padding: '10px 14px' };
const EMPLOYEE_CARD_STYLE = {
  background: 'var(--purple-pale)',
  color: 'var(--purple)',
  border: '1px solid rgba(62,42,126,0.16)',
};
const EMPLOYEE_GROUP_STYLE = {
  background: 'var(--gold-light)',
  color: 'var(--gold-dark)',
};
const EMPLOYEE_CARD_UNAVAILABLE_STYLE = {
  background: '#F4F4F6',
  color: '#7A7A88',
  border: '1px solid rgba(122,122,136,0.22)',
};

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isIsoDateName(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftMonth(monthString, delta) {
  const [year, month] = monthString.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function humanDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function getMonthGrid(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = first.getDay();
  const cells = [];

  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${monthString}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function DateMarkerCalendar({
  markedDates,
  selectedDate,
  onSelectDate,
  emptyLabel,
}) {
  const validDates = markedDates.filter(isIsoDateName).sort();
  const fallbackMonth = selectedDate && isIsoDateName(selectedDate)
    ? selectedDate.slice(0, 7)
    : (validDates[0]?.slice(0, 7) || new Date().toISOString().slice(0, 7));
  const [viewMonth, setViewMonth] = useState(fallbackMonth);

  if (validDates.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--gray)', fontStyle: 'italic', marginBottom: 8 }}>
        {emptyLabel}
      </div>
    );
  }

  const markedDateSet = new Set(validDates);
  const cells = getMonthGrid(viewMonth);
  const monthLabel = new Date(`${viewMonth}-01T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <button onClick={() => setViewMonth(prev => shiftMonth(prev, -1))} style={calendarNavBtnStyle}>‹</button>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>{monthLabel}</div>
        <button onClick={() => setViewMonth(prev => shiftMonth(prev, 1))} style={calendarNavBtnStyle}>›</button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 4,
        marginBottom: 4,
      }}>
        {CALENDAR_WEEKDAYS.map((label) => (
          <div
            key={label}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--gray)',
              textAlign: 'center',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 4,
      }}>
        {cells.map((dateValue, index) => {
          if (!dateValue) {
            return <div key={`blank-${index}`} style={{ minHeight: 32 }} />;
          }
          const isMarked = markedDateSet.has(dateValue);
          const isSelected = selectedDate === dateValue;
          return (
            <button
              key={dateValue}
              onClick={() => isMarked && onSelectDate(dateValue)}
              style={{
                minHeight: 32,
                borderRadius: 8,
                border: `1px solid ${isSelected ? 'var(--purple)' : isMarked ? 'var(--gold)' : 'var(--gray-light)'}`,
                background: isSelected ? 'var(--purple)' : isMarked ? 'var(--gold-light)' : '#fff',
                color: isSelected ? '#fff' : isMarked ? 'var(--gold-dark)' : '#B8B6C5',
                fontSize: 11,
                fontWeight: 700,
                cursor: isMarked ? 'pointer' : 'default',
                position: 'relative',
                fontFamily: "'DM Sans', sans-serif",
                opacity: isMarked ? 1 : 0.6,
              }}
            >
              {dateValue.slice(-2)}
              {isMarked && !isSelected && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: '50%',
                    width: 5,
                    height: 5,
                    marginLeft: -2.5,
                    borderRadius: '50%',
                    background: 'var(--purple)',
                    opacity: 0.7,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gray)' }}>
          Selected: {humanDate(selectedDate)}
        </div>
      )}
    </div>
  );
}

// ─── Load Schedule Panel ─────────────────────────────────────────────────────
function LoadSchedule({ onBeforeReplaceSchedule, onAfterStateLoaded }) {
  const { can } = useAuth();
  const {
    loadTemplate, getUserTemplates, getMasterTemplates, getUserPostings, getUserDrafts,
    applyState, setScheduleLabel,
    saveUserDrafts,
    apiDeleteTemplate, apiDeleteSchedule,
    assumptions, setAssumptions,
    currentLoadedEntity, setCurrentLoadedEntity,
  } = useScheduler();

  const [loadTab, setLoadTab] = useState('template');
  const [tplValue, setTplValue]     = useState('blank');
  const [draftValue, setDraftValue]   = useState('');
  const [postingValue, setPostingValue] = useState('');

  // Refresh from storage each render (small panel, acceptable)
  const masterTemplates = getMasterTemplates(); // { name: state }
  const userTemplates   = getUserTemplates();   // { name: state }
  const userDrafts      = getUserDrafts();      // { name: state }
  const userPostings    = getUserPostings();    // { name: state }
  const masterKeys   = Object.keys(masterTemplates);
  const templateKeys = Object.keys(userTemplates);
  const draftKeys    = Object.keys(userDrafts).sort();
  const postingKeys  = Object.keys(userPostings).sort();
  const legacyDraftKeys = draftKeys.filter((name) => !isIsoDateName(name));
  const legacyPostingKeys = postingKeys.filter((name) => !isIsoDateName(name));

  const canViewMasterTemplates = can(RESOURCES.MASTER_TEMPLATES, ACTIONS.VIEW);
  const canDeleteMasterTemplates = can(RESOURCES.MASTER_TEMPLATES, ACTIONS.DELETE);
  const canViewUserTemplates = can(RESOURCES.USER_TEMPLATES, ACTIONS.VIEW);
  const canDeleteUserTemplates = can(RESOURCES.USER_TEMPLATES, ACTIONS.DELETE);
  const canEditSchedules = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.EDIT);
  const canViewDrafts = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.VIEW);
  const canDeleteDrafts = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.DELETE);
  const canViewPosted = can(RESOURCES.PUBLISHED_SCHEDULES, ACTIONS.VIEW);

  const availableTabs = [
    (canViewMasterTemplates || canViewUserTemplates) ? 'template' : null,
    canViewDrafts ? 'draft' : null,
    canViewPosted ? 'posting' : null,
  ].filter(Boolean);
  const resolvedLoadTab = availableTabs.includes(loadTab) ? loadTab : (availableTabs[0] || 'template');
  const resolvedDraftValue = draftKeys.includes(draftValue) ? draftValue : (draftKeys[0] || '');
  const resolvedPostingValue = postingKeys.includes(postingValue) ? postingValue : (postingKeys[0] || '');
  const resolvedTemplateValue = tplValue;

  useEffect(() => {
    if (currentLoadedEntity?.kind === 'template') {
      const nextValue = currentLoadedEntity.scope === 'master'
        ? `master_${currentLoadedEntity.name}`
        : currentLoadedEntity.scope === 'user'
          ? `user_${currentLoadedEntity.name}`
          : 'blank';
      const frame = window.requestAnimationFrame(() => {
        setTplValue((prev) => (prev === nextValue ? prev : nextValue));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (currentLoadedEntity?.kind === 'builtin' && currentLoadedEntity?.name === 'blank') {
      const frame = window.requestAnimationFrame(() => {
        setTplValue((prev) => (prev === 'blank' ? prev : 'blank'));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [currentLoadedEntity]);

  function handleLoadTemplate() {
    if (!resolvedTemplateValue) return;
    if (!onBeforeReplaceSchedule()) return;
    if (resolvedTemplateValue.startsWith('master_')) {
      const name = resolvedTemplateValue.replace('master_', '');
      const state = masterTemplates[name];
      if (!state) return;
      const preservedDate = assumptions.date || '';
      setScheduleLabel(name);
      setCurrentLoadedEntity({ kind: 'template', scope: 'master', id: state.id, name });
      applyState({
        ...state,
        assumptions: {
          ...(state.assumptions || {}),
          date: preservedDate,
        },
      });
      onAfterStateLoaded?.();
    } else if (resolvedTemplateValue.startsWith('user_')) {
      const name = resolvedTemplateValue.replace('user_', '');
      const state = userTemplates[name];
      if (!state) return;
      const preservedDate = assumptions.date || '';
      setScheduleLabel(name);
      setCurrentLoadedEntity({ kind: 'template', scope: 'user', id: state.id, name });
      applyState({
        ...state,
        assumptions: {
          ...(state.assumptions || {}),
          date: preservedDate,
        },
      });
      onAfterStateLoaded?.();
    } else {
      // Built-in Noble Template
      loadTemplate(resolvedTemplateValue);
      onAfterStateLoaded?.();
    }
  }

  async function handleLoad(storeObj, name) {
    let state = storeObj[name];
    if (!state) return;
    if (!onBeforeReplaceSchedule()) return;
    // If the entry is metadata-only (from list endpoint hydration), fetch full data by ID
    if (state.id && !state.schedule) {
      try {
        state = await apiSchedules.getOne(state.id);
      } catch (err) {
        console.warn('Failed to fetch full schedule, using cached state:', err.message);
      }
    }
    setScheduleLabel(name);
    setCurrentLoadedEntity({
      kind: 'schedule',
      status: state.status || (loadTab === 'draft' ? 'draft' : 'posted'),
      id: state.id,
      name,
      versionNumber: state.versionNumber,
      rootScheduleId: state.rootScheduleId,
    });
    applyState(state);
    onAfterStateLoaded?.();
  }

  async function handleDeleteTemplate() {
    const isMaster = resolvedTemplateValue.startsWith('master_');
    const isUser   = resolvedTemplateValue.startsWith('user_');
    if (!isMaster && !isUser) return;
    const name = resolvedTemplateValue.replace(/^(master_|user_)/, '');
    if (!window.confirm(`Delete template "${name}"?`)) return;
    await apiDeleteTemplate(name, isMaster ? 'master' : 'user');
    setTplValue('blank');
  }

  const tabStyle = (active) => ({
    flex: 1, padding: '5px 8px', border: 'none', fontSize: 10,
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: 'pointer',
    background: active ? 'var(--purple)' : 'var(--cream)',
    color: active ? '#fff' : 'var(--gray)',
    transition: 'all 0.15s',
  });

  return (
    <div style={PANEL_SECTION}>
      <div style={PANEL_TITLE}>Load Schedule</div>
      {availableTabs.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 8, background: 'var(--cream)', borderRadius: 6, padding: 2 }}>
          {availableTabs.includes('template') && (
            <button style={tabStyle(resolvedLoadTab === 'template')} onClick={() => setLoadTab('template')}>Templates</button>
          )}
          {availableTabs.includes('draft') && (
            <button style={tabStyle(resolvedLoadTab === 'draft')} onClick={() => setLoadTab('draft')}>📝 Drafts</button>
          )}
          {availableTabs.includes('posting') && (
            <button style={tabStyle(resolvedLoadTab === 'posting')} onClick={() => setLoadTab('posting')}>✅ Posted</button>
          )}
        </div>
      )}
      {availableTabs.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 8 }}>
          You have view-only access to summary data, but no saved schedules or templates are available for your role.
        </div>
      )}

      {resolvedLoadTab === 'template' && (
        <>
          <SelectWrap value={resolvedTemplateValue} onChange={setTplValue}>
            <option value="blank">— New Blank Schedule —</option>
            {canViewMasterTemplates && masterKeys.length > 0 && (
              <optgroup label="— Master Templates —">
                {masterKeys.map(name => (
                  <option key={name} value={`master_${name}`}>{name}</option>
                ))}
              </optgroup>
            )}
            {canViewUserTemplates && templateKeys.length > 0 && (
              <optgroup label="— My Templates —">
                {templateKeys.map(name => (
                  <option key={name} value={`user_${name}`}>{name}</option>
                ))}
              </optgroup>
            )}
          </SelectWrap>
          <LoadBtn onClick={handleLoadTemplate}>
            {resolvedTemplateValue === 'blank' ? 'New Blank Schedule' : 'Load Template'}
          </LoadBtn>
          {((resolvedTemplateValue.startsWith('master_') && canDeleteMasterTemplates) || (resolvedTemplateValue.startsWith('user_') && canDeleteUserTemplates)) && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <SmBtn onClick={handleDeleteTemplate} danger>🗑 Delete</SmBtn>
            </div>
          )}
        </>
      )}

      {resolvedLoadTab === 'draft' && (
        <>
          <DateMarkerCalendar
            markedDates={draftKeys}
            selectedDate={resolvedDraftValue}
            onSelectDate={setDraftValue}
            emptyLabel="No saved drafts yet."
          />
          {legacyDraftKeys.length > 0 && (
            <SelectWrap value={resolvedDraftValue} onChange={setDraftValue}>
              {legacyDraftKeys.map(name => (
                <option key={name} value={name}>📝 {name}</option>
              ))}
            </SelectWrap>
          )}
          <LoadBtn onClick={() => handleLoad(userDrafts, resolvedDraftValue)}>Load Draft</LoadBtn>
          {resolvedDraftValue && canDeleteDrafts && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <SmBtn danger onClick={async () => {
                if (!window.confirm(`Delete draft "${resolvedDraftValue}"?`)) return;
                const draft = userDrafts[resolvedDraftValue];
                try {
                  if (draft?.id) {
                    await apiDeleteSchedule(draft.id, 'draft', resolvedDraftValue);
                  } else {
                    const updated = { ...userDrafts };
                    delete updated[resolvedDraftValue];
                    saveUserDrafts(updated);
                  }
                  if (
                    currentLoadedEntity?.kind === 'schedule' &&
                    currentLoadedEntity?.status === 'draft' &&
                    currentLoadedEntity?.name === resolvedDraftValue
                  ) {
                    setCurrentLoadedEntity({ kind: 'builtin', scope: 'builtin', name: 'blank' });
                  }
                  setDraftValue('');
                } catch (err) {
                  window.alert(err.message || `Failed to delete draft "${draftValue}".`);
                }
              }}>🗑 Delete</SmBtn>
            </div>
          )}
        </>
      )}

      {resolvedLoadTab === 'posting' && (
        <>
          <DateMarkerCalendar
            markedDates={postingKeys}
            selectedDate={resolvedPostingValue}
            onSelectDate={setPostingValue}
            emptyLabel="No posted schedules yet."
          />
          {legacyPostingKeys.length > 0 && (
            <SelectWrap value={resolvedPostingValue} onChange={setPostingValue}>
              {legacyPostingKeys.map(name => (
                <option key={name} value={name}>✅ {name}</option>
              ))}
            </SelectWrap>
          )}
          <LoadBtn onClick={() => handleLoad(userPostings, resolvedPostingValue)}>Load Posted</LoadBtn>
        </>
      )}

      {/* Date — always visible, below the load button */}
      {canEditSchedules && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--gray-light)', paddingTop: 8 }}>
          <InputRow label="Schedule Date">
            <Inp
              type="date"
              value={assumptions.date || ''}
              disabled={!canEditSchedules}
              onChange={e => setAssumptions(prev => ({ ...prev, date: e.target.value }))}
            />
          </InputRow>
        </div>
      )}
    </div>
  );
}

// ─── Assumptions Panel ───────────────────────────────────────────────────────
function Assumptions() {
  const { can } = useAuth();
  const { assumptions, setAssumptions, getProgramPct, getEffectiveRoles } = useScheduler();
  const pct = getProgramPct();
  const [open, setOpen] = useState(false);
  const canEditSchedule = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.EDIT);

  if (!canEditSchedule) return null;

  function update(field, value) {
    if (!canEditSchedule) return;
    setAssumptions(a => ({ ...a, [field]: value }));
  }

  const dogs     = assumptions.dogs || 0;
  const estRooms = Math.round(dogs * (1 - pct.multipet / 100));
  const estSC    = Math.max(1, Math.round(dogs * pct.pf / 100));
  const estCats  = Math.round(dogs * pct.cats / 100);
  const estBung  = Math.max(1, Math.round(estCats / (1 + pct.multipetCats / 100)));

  const rooms      = assumptions.roomsUserEdited    ? assumptions.roomsActual    : estRooms;
  const scs        = assumptions.scUserEdited       ? assumptions.scActual       : estSC;
  const cats       = assumptions.catsUserEdited     ? assumptions.catsActual     : estCats;
  const bungs      = assumptions.catRoomsUserEdited ? assumptions.catRoomsActual : estBung;
  const totalRooms = rooms + bungs;
  const employees  = getEffectiveRoles().length;

  return (
    <div style={PANEL_SECTION}>
      {/* Title row doubles as the single toggle */}
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', marginBottom: open ? 8 : 4,
      }}>
        <span style={PANEL_TITLE}><span style={{ marginBottom: 0 }}>Assumptions</span></span>
        <span style={{ fontSize: 14, color: 'var(--purple)', lineHeight: 1 }}>{open ? '▾' : '▸'}</span>
      </button>

      {/* Collapsed summary — both lines */}
      {!open && (
        <div style={{ fontSize: 10, color: 'var(--gray)', fontStyle: 'italic', lineHeight: 1.6 }}>
          <div>🐕 {dogs} dogs · {rooms} rooms · {assumptions.socpg} Soc · {assumptions.selpg} Sel · {scs} SC</div>
          <div>🐈 {cats} cats · {bungs} bungalow{bungs !== 1 ? 's' : ''}</div>
        </div>
      )}

      {open && <>
        <SubHead>🐕 Dogs</SubHead>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 2 }}>
          <InputRow label="Total Dogs">
            <Inp type="number" value={assumptions.dogs} min={1} max={200}
              disabled={!canEditSchedule}
              onChange={e => update('dogs', parseInt(e.target.value) || 65)} />
          </InputRow>
          <InputRow label="Dog Rooms ↺">
            <Inp type="number"
              value={assumptions.roomsUserEdited ? (assumptions.roomsActual ?? '') : estRooms}
              disabled={!canEditSchedule}
              style={assumptions.roomsUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
              onChange={e => {
                const v = parseInt(e.target.value);
                update('roomsActual', isNaN(v) ? null : v);
                update('roomsUserEdited', !isNaN(v) && v !== estRooms);
              }} />
          </InputRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <InputRow label="# SocPGs">
            <Inp type="number" value={assumptions.socpg} min={1} max={6}
              disabled={!canEditSchedule}
              onChange={e => update('socpg', parseInt(e.target.value) || 2)} />
          </InputRow>
          <InputRow label="# SelPGs">
            <Inp type="number" value={assumptions.selpg} min={0} max={4}
              disabled={!canEditSchedule}
              onChange={e => update('selpg', parseInt(e.target.value) || 0)} />
          </InputRow>
          <InputRow label="# SCs ↺">
            <Inp type="number"
              value={assumptions.scUserEdited ? (assumptions.scActual ?? '') : estSC}
              disabled={!canEditSchedule}
              style={assumptions.scUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
              onChange={e => {
                const v = parseInt(e.target.value);
                update('scActual', isNaN(v) ? null : v);
                update('scUserEdited', !isNaN(v) && v !== estSC);
              }} />
          </InputRow>
        </div>

        <SubHead style={{ marginTop: 6 }}>🐈 Cats</SubHead>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <InputRow label="Cats ↺">
            <Inp type="number"
              value={assumptions.catsUserEdited ? (assumptions.catsActual ?? '') : estCats}
              disabled={!canEditSchedule}
              style={assumptions.catsUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
              onChange={e => {
                const v = parseInt(e.target.value);
                update('catsActual', isNaN(v) ? null : v);
                update('catsUserEdited', !isNaN(v) && v !== estCats);
              }} />
          </InputRow>
          <InputRow label="Cat Rooms ↺">
            <Inp type="number"
              value={assumptions.catRoomsUserEdited ? (assumptions.catRoomsActual ?? '') : estBung}
              disabled={!canEditSchedule}
              style={assumptions.catRoomsUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
              onChange={e => {
                const v = parseInt(e.target.value);
                update('catRoomsActual', isNaN(v) ? null : v);
                update('catRoomsUserEdited', !isNaN(v) && v !== estBung);
              }} />
          </InputRow>
        </div>

        {/* Read-only derived totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <InputRow label="Total Rooms">
            <Inp type="number" value={totalRooms} readOnly
              style={{ background: 'var(--gray-light)', color: 'var(--gray)', cursor: 'default' }} />
          </InputRow>
          <InputRow label="# Employees">
            <Inp type="number" value={employees} readOnly
              style={{ background: 'var(--gray-light)', color: 'var(--gray)', cursor: 'default' }} />
          </InputRow>
        </div>
      </>}
    </div>
  );
}

function EmployeesLibrary() {
  const { can } = useAuth();
  const { staffData, assumptions, employeeAssignments } = useScheduler();
  const canEditSchedule = can(RESOURCES.DAILY_SCHEDULES, ACTIONS.EDIT);
  const [expanded, setExpanded] = useState({});
  const [availabilityStatus, setAvailabilityStatus] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function hydrateAvailability() {
      if (!assumptions.date) {
        if (isMounted) setAvailabilityStatus({});
        return;
      }

      const activePeople = staffData.filter((person) => person.isActive !== false);
      if (activePeople.length === 0) {
        if (isMounted) setAvailabilityStatus({});
        return;
      }

      try {
        const rows = await Promise.all(activePeople.map(async (person) => {
          const [availabilityRecords, exceptions] = await Promise.all([
            apiStaffing.getAvailability({
              staffId: person.id,
              startDate: assumptions.date,
              endDate: assumptions.date,
            }),
            apiStaffing.getExceptions({ staffId: person.id }),
          ]);

          const hasBaseUnavailable = availabilityRecords.some((record) => record.date === assumptions.date && record.isAvailable === false);
          const hasExceptionUnavailable = exceptions.some((exception) => (
            assumptions.date >= exception.startDate &&
            assumptions.date <= exception.endDate &&
            exception.mode === 'unavailable'
          ));

          return [
            String(person.id),
            {
              isUnavailable: hasBaseUnavailable || hasExceptionUnavailable,
            },
          ];
        }));

        if (isMounted) {
          setAvailabilityStatus(Object.fromEntries(rows));
        }
      } catch {
        if (isMounted) setAvailabilityStatus({});
      }
    }

    hydrateAvailability();
    return () => { isMounted = false; };
  }, [assumptions.date, staffData]);

  const assignedStaffIds = useMemo(
    () => new Set(Object.values(employeeAssignments || {}).map((entry) => String(entry.staffId)).filter(Boolean)),
    [employeeAssignments]
  );

  const activeStaff = staffData
    .filter((person) => person.isActive !== false)
    .filter((person) => !assignedStaffIds.has(String(person.id)));

  if (!canEditSchedule) return null;

  const groupedStaff = activeStaff.reduce((acc, person) => {
    const roleKey = person.role?.trim() || 'Other';
    if (!acc[roleKey]) acc[roleKey] = [];
    acc[roleKey].push(person);
    return acc;
  }, {});

  const orderedGroups = Object.entries(groupedStaff)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([role, people]) => ({
      role,
      people: people.slice().sort((a, b) => {
        const last = (a.lastName || '').localeCompare(b.lastName || '');
        if (last !== 0) return last;
        return (a.firstName || '').localeCompare(b.firstName || '');
      }),
    }));

  function isExpanded(role) {
    return expanded[role] !== false;
  }

  function toggleGroup(role) {
    setExpanded((prev) => ({ ...prev, [role]: !isExpanded(role) }));
  }

  function toggleAll() {
    const anyCollapsed = orderedGroups.some((group) => expanded[group.role] === false);
    if (anyCollapsed) {
      setExpanded({});
      return;
    }
    const allCollapsed = {};
    orderedGroups.forEach((group) => { allCollapsed[group.role] = false; });
    setExpanded(allCollapsed);
  }

  return (
    <div style={{ ...PANEL_SECTION, paddingBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={PANEL_TITLE}>Employees</div>
        {orderedGroups.length > 0 && (
          <button
            onClick={toggleAll}
            title={orderedGroups.some((group) => expanded[group.role] === false) ? 'Expand all' : 'Collapse all'}
            style={{
              background: 'none',
              border: '1px solid var(--gray-light)',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 11,
              color: 'var(--gray)',
              lineHeight: 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {orderedGroups.some((group) => expanded[group.role] === false) ? '⊞' : '⊟'}
          </button>
        )}
      </div>

      {orderedGroups.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--gray)', fontStyle: 'italic' }}>
          No active employees yet.
        </div>
      )}

      {orderedGroups.map((group) => (
        <div key={group.role} style={{ marginBottom: 8 }}>
          <button
            onClick={() => toggleGroup(group.role)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: EMPLOYEE_GROUP_STYLE.background,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '5px 8px',
              marginBottom: isExpanded(group.role) ? 6 : 0,
            }}
          >
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: EMPLOYEE_GROUP_STYLE.color,
            }}>
              {group.role}
            </span>
            <span style={{ fontSize: 10, color: EMPLOYEE_GROUP_STYLE.color }}>
              {isExpanded(group.role) ? '▲' : '▼'}
            </span>
          </button>

          {isExpanded(group.role) && group.people.map((person) => (
            <EmployeeCard
              key={person.id}
              person={person}
              roleLabel={group.role}
              isUnavailable={availabilityStatus[String(person.id)]?.isUnavailable}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmployeeCard({ person, roleLabel, isUnavailable = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staff-${person.id}`,
    data: {
      type: 'staff',
      staff: person,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        marginBottom: 6,
        padding: '7px 10px',
        borderRadius: 8,
        background: isUnavailable ? EMPLOYEE_CARD_UNAVAILABLE_STYLE.background : EMPLOYEE_CARD_STYLE.background,
        color: isUnavailable ? EMPLOYEE_CARD_UNAVAILABLE_STYLE.color : EMPLOYEE_CARD_STYLE.color,
        border: isUnavailable ? EMPLOYEE_CARD_UNAVAILABLE_STYLE.border : EMPLOYEE_CARD_STYLE.border,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : isUnavailable ? 0.78 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      title={isUnavailable ? 'Unavailable for the selected date. You can still assign with a warning.' : undefined}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {`${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unnamed Employee'}
          </div>
          {isUnavailable && (
            <div style={{
              marginTop: 3,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}>
              Unavailable
            </div>
          )}
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.75,
          flexShrink: 0,
        }}>
          {roleLabel}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SelectWrap({ value, onChange, children }) {
  return (
    <div style={{ position: 'relative', marginBottom: 0 }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', padding: '8px 32px 8px 10px', border: '1px solid var(--gray-light)',
        borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
        color: 'var(--dark)', background: 'var(--cream)', cursor: 'pointer',
        appearance: 'none', WebkitAppearance: 'none',
      }}>{children}</select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: 'var(--gray)', fontSize: 10 }}>▼</span>
    </div>
  );
}

function LoadBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 8, width: '100%', padding: 8,
      background: 'var(--purple)', color: '#fff', border: 'none',
      borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
      cursor: 'pointer',
    }}>{children}</button>
  );
}

function SmBtn({ onClick, children, purple, danger, style }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '5px 10px', fontSize: 11,
      fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: 'pointer',
      borderRadius: 6, border: '1px solid',
      background: purple ? 'var(--purple)' : danger ? 'var(--red-light)' : 'var(--cream)',
      color: purple ? '#fff' : danger ? 'var(--red)' : 'var(--dark)',
      borderColor: purple ? 'transparent' : danger ? '#F48FB1' : 'var(--gray-light)',
      ...style,
    }}>{children}</button>
  );
}

function InputRow({ label, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 4, display: 'block', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

function Inp({ style, ...props }) {
  return (
    <input style={{
      width: '100%', padding: '7px 10px', border: '1px solid var(--gray-light)',
      borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
      color: 'var(--dark)', background: 'var(--cream)', transition: 'border-color 0.15s',
      ...style,
    }} {...props} />
  );
}

function SubHead({ children, style }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: 'var(--gray)', margin: '4px 0 3px', ...style,
    }}>{children}</div>
  );
}

function Derived({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 2, fontStyle: 'italic', marginBottom: 3 }}>
      {children}
    </div>
  );
}

const calendarNavBtnStyle = {
  border: '1px solid var(--gray-light)',
  background: '#fff',
  color: 'var(--purple)',
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};

// ─── Export ──────────────────────────────────────────────────────────────────
export default function LeftPanel({ onBeforeReplaceSchedule = () => true, onAfterStateLoaded = () => {} }) {
  return (
    <div style={{
      background: '#fff', borderRight: '1px solid var(--gray-light)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
      width: 300, flexShrink: 0,
    }}>
      <LoadSchedule onBeforeReplaceSchedule={onBeforeReplaceSchedule} onAfterStateLoaded={onAfterStateLoaded} />
      <Assumptions />
      <EmployeesLibrary />
    </div>
  );
}
