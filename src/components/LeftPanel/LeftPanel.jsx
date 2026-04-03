import { useState, useEffect } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { apiSchedules } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { ACTIONS, RESOURCES } from '../../permissions';

const PANEL_TITLE = { fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 8 };
const PANEL_SECTION = { borderBottom: '1px solid var(--gray-light)', padding: '10px 14px' };

// ─── Load Schedule Panel ─────────────────────────────────────────────────────
function LoadSchedule() {
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
  const draftKeys    = Object.keys(userDrafts);
  const postingKeys  = Object.keys(userPostings);

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

  // Auto-select first item when lists populate (e.g. after API hydration)
  useEffect(() => {
    if (!draftValue && draftKeys.length > 0) setDraftValue(draftKeys[0]);
  }, [draftKeys.length]); // eslint-disable-line
  useEffect(() => {
    if (!postingValue && postingKeys.length > 0) setPostingValue(postingKeys[0]);
  }, [postingKeys.length]); // eslint-disable-line
  useEffect(() => {
    if (!availableTabs.length) return;
    if (!availableTabs.includes(loadTab)) setLoadTab(availableTabs[0]);
  }, [availableTabs, loadTab]);
  useEffect(() => {
    if (currentLoadedEntity?.kind === 'template' && currentLoadedEntity?.name) {
      const nextValue = currentLoadedEntity.scope === 'master'
        ? `master_${currentLoadedEntity.name}`
        : `user_${currentLoadedEntity.name}`;
      if (tplValue !== nextValue) setTplValue(nextValue);
      if (loadTab !== 'template') setLoadTab('template');
      return;
    }
    if (currentLoadedEntity?.kind === 'builtin') {
      if (tplValue !== 'blank') setTplValue('blank');
    }
  }, [currentLoadedEntity]);

  function handleLoadTemplate() {
    if (!tplValue) return;
    if (tplValue.startsWith('master_')) {
      const name = tplValue.replace('master_', '');
      const state = masterTemplates[name];
      if (!state) return;
      setScheduleLabel(name);
      setCurrentLoadedEntity({ kind: 'template', scope: 'master', id: state.id, name });
      applyState(state);
    } else if (tplValue.startsWith('user_')) {
      const name = tplValue.replace('user_', '');
      const state = userTemplates[name];
      if (!state) return;
      setScheduleLabel(name);
      setCurrentLoadedEntity({ kind: 'template', scope: 'user', id: state.id, name });
      applyState(state);
    } else {
      // Built-in Noble Template
      loadTemplate(tplValue);
    }
  }

  async function handleLoad(storeObj, name) {
    let state = storeObj[name];
    if (!state) return;
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
    });
    applyState(state);
  }

  async function handleDeleteTemplate() {
    const isMaster = tplValue.startsWith('master_');
    const isUser   = tplValue.startsWith('user_');
    if (!isMaster && !isUser) return;
    const name = tplValue.replace(/^(master_|user_)/, '');
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
            <button style={tabStyle(loadTab === 'template')} onClick={() => setLoadTab('template')}>Templates</button>
          )}
          {availableTabs.includes('draft') && (
            <button style={tabStyle(loadTab === 'draft')} onClick={() => setLoadTab('draft')}>📝 Drafts</button>
          )}
          {availableTabs.includes('posting') && (
            <button style={tabStyle(loadTab === 'posting')} onClick={() => setLoadTab('posting')}>✅ Posted</button>
          )}
        </div>
      )}
      {availableTabs.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 8 }}>
          You have view-only access to summary data, but no saved schedules or templates are available for your role.
        </div>
      )}

      {loadTab === 'template' && (
        <>
          <SelectWrap value={tplValue} onChange={setTplValue}>
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
            {tplValue === 'blank' ? 'New Blank Schedule' : 'Load Template'}
          </LoadBtn>
          {((tplValue.startsWith('master_') && canDeleteMasterTemplates) || (tplValue.startsWith('user_') && canDeleteUserTemplates)) && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <SmBtn onClick={handleDeleteTemplate} danger>🗑 Delete</SmBtn>
            </div>
          )}
        </>
      )}

      {loadTab === 'draft' && (
        <>
          <SelectWrap value={draftValue} onChange={setDraftValue}>
            {draftKeys.length === 0
              ? <option value="">— No saved drafts —</option>
              : draftKeys.map(name => (
                  <option key={name} value={name}>📝 {name}</option>
                ))
            }
          </SelectWrap>
          <LoadBtn onClick={() => handleLoad(userDrafts, draftValue)}>Load Draft</LoadBtn>
          {draftValue && canDeleteDrafts && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <SmBtn danger onClick={async () => {
                if (!window.confirm(`Delete draft "${draftValue}"?`)) return;
                const draft = userDrafts[draftValue];
                try {
                  if (draft?.id) {
                    await apiDeleteSchedule(draft.id, 'draft', draftValue);
                  } else {
                    const updated = { ...userDrafts };
                    delete updated[draftValue];
                    saveUserDrafts(updated);
                  }
                  if (
                    currentLoadedEntity?.kind === 'schedule' &&
                    currentLoadedEntity?.status === 'draft' &&
                    currentLoadedEntity?.name === draftValue
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

      {loadTab === 'posting' && (
        <>
          <SelectWrap value={postingValue} onChange={setPostingValue}>
            {postingKeys.length === 0
              ? <option value="">— No posted schedules —</option>
              : postingKeys.map(name => (
                  <option key={name} value={name}>✅ {name}</option>
                ))
            }
          </SelectWrap>
          <LoadBtn onClick={() => handleLoad(userPostings, postingValue)}>Load Posted</LoadBtn>
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
  const [open, setOpen] = useState(true);
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
    <div style={{ ...PANEL_SECTION, flex: 1 }}>
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

// ─── Export ──────────────────────────────────────────────────────────────────
export default function LeftPanel() {
  return (
    <div style={{
      background: '#fff', borderRight: '1px solid var(--gray-light)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
      width: 280, flexShrink: 0,
    }}>
      <LoadSchedule />
      <Assumptions />
    </div>
  );
}
