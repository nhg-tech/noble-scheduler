import { useState } from 'react';
import { useScheduler } from '../../context/SchedulerContext';

const PANEL_TITLE = { fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 12 };
const PANEL_SECTION = { borderBottom: '1px solid var(--gray-light)', padding: 16 };

// ─── Load Schedule Panel ─────────────────────────────────────────────────────
function LoadSchedule() {
  const {
    loadTemplate, getUserTemplates, getUserPostings, getUserDrafts,
    applyState, setScheduleLabel,
    saveUserTemplates, saveUserPostings, saveUserDrafts,
  } = useScheduler();

  const [loadTab, setLoadTab] = useState('template');
  const [tplValue, setTplValue]     = useState('t1');
  const [draftValue, setDraftValue]   = useState('');
  const [postingValue, setPostingValue] = useState('');

  // Refresh from storage each render (small panel, acceptable)
  const userTemplates = getUserTemplates(); // { name: state }
  const userDrafts    = getUserDrafts();    // { name: state }
  const userPostings  = getUserPostings();  // { name: state }
  const templateKeys = Object.keys(userTemplates);
  const draftKeys    = Object.keys(userDrafts);
  const postingKeys  = Object.keys(userPostings);

  const BUILTIN_LABELS = {
    t1:      'Template 1 — 2 SocPGs + 2 SelPGs (GM+MR)',
    t2:      'Template 2 — 2 SocPGs only (GM+MR)',
    t1_noMR: 'Template 3 — 2 SocPGs + 2 SelPGs (No MR/GM)',
    t2_noMR: 'Template 4 — 2 SocPGs only (No MR/GM)',
    blank:   'Blank Schedule',
  };

  function handleLoadTemplate() {
    if (!tplValue) return;
    if (tplValue.startsWith('user_')) {
      const name = tplValue.replace('user_', '');
      const state = userTemplates[name];
      if (!state) return;
      setScheduleLabel(name);
      applyState(state);
    } else {
      // Check if user has saved an override for this built-in template
      const builtinLabel = BUILTIN_LABELS[tplValue];
      if (builtinLabel && userTemplates[builtinLabel]) {
        setScheduleLabel(builtinLabel);
        applyState(userTemplates[builtinLabel]);
      } else {
        loadTemplate(tplValue);
      }
    }
  }

  function handleLoad(storeObj, name, labelPrefix) {
    const state = storeObj[name];
    if (!state) return;
    setScheduleLabel(`${labelPrefix}${name}`);
    applyState(state);
  }

  function handleDeleteTemplate() {
    if (!tplValue.startsWith('user_')) return;
    const name = tplValue.replace('user_', '');
    if (!window.confirm(`Delete template "${name}"?`)) return;
    const updated = { ...userTemplates };
    delete updated[name];
    saveUserTemplates(updated);
    setTplValue('t1');
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
      <div style={{ display: 'flex', gap: 2, marginBottom: 10, background: 'var(--cream)', borderRadius: 6, padding: 2 }}>
        <button style={tabStyle(loadTab === 'template')} onClick={() => setLoadTab('template')}>Templates</button>
        <button style={tabStyle(loadTab === 'draft')}    onClick={() => setLoadTab('draft')}>📝 Drafts</button>
        <button style={tabStyle(loadTab === 'posting')}  onClick={() => setLoadTab('posting')}>✅ Posted</button>
      </div>

      {loadTab === 'template' && (
        <>
          <SelectWrap value={tplValue} onChange={setTplValue}>
            <optgroup label="— Noble Templates —">
              <option value="t1">2 SocPGs + 2 SelPGs · GM+MR (~50–80 dogs)</option>
              <option value="t2">2 SocPGs only · GM+MR (~40–60 dogs)</option>
              <option value="t1_noMR">2 SocPGs + 2 SelPGs · No MR/GM</option>
              <option value="t2_noMR">2 SocPGs only · No MR/GM</option>
              <option value="blank">— Blank Schedule —</option>
            </optgroup>
            {templateKeys.length > 0 && (
              <optgroup label="— My Templates —">
                {templateKeys.map(name => (
                  <option key={name} value={`user_${name}`}>{name}</option>
                ))}
              </optgroup>
            )}
          </SelectWrap>
          <LoadBtn onClick={handleLoadTemplate}>Load Template</LoadBtn>
          {tplValue.startsWith('user_') && (
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
          <LoadBtn onClick={() => handleLoad(userDrafts, draftValue, '📝 ')}>Load Draft</LoadBtn>
          {draftValue && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <SmBtn danger onClick={() => {
                if (!window.confirm(`Delete draft "${draftValue}"?`)) return;
                const updated = { ...userDrafts };
                delete updated[draftValue];
                saveUserDrafts(updated);
                setDraftValue('');
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
          <LoadBtn onClick={() => handleLoad(userPostings, postingValue, '✅ ')}>Load Posted</LoadBtn>
        </>
      )}
    </div>
  );
}

// ─── Assumptions Panel ───────────────────────────────────────────────────────
function Assumptions() {
  const { assumptions, setAssumptions, getProgramPct } = useScheduler();
  const pct = getProgramPct();

  function update(field, value) {
    setAssumptions(a => ({ ...a, [field]: value }));
  }

  const dogs = assumptions.dogs || 0;
  const estRooms = Math.round(dogs * (1 - pct.multipet / 100));
  const estSC    = Math.max(1, Math.round(dogs * pct.pf / 100));
  const estCats  = Math.round(dogs * pct.cats / 100);
  const estBung  = Math.max(1, Math.round(estCats / (1 + pct.multipetCats / 100)));

  return (
    <div style={{ ...PANEL_SECTION, flex: 1 }}>
      <div style={PANEL_TITLE}>Assumptions</div>

      <SubHead>🐕 Dogs</SubHead>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <InputRow label="Total Dogs">
          <Inp type="number" value={assumptions.dogs} min={1} max={200}
            onChange={e => update('dogs', parseInt(e.target.value) || 65)} />
        </InputRow>
        <InputRow label="Dog Rooms ↺ auto">
          <Inp type="number"
            value={assumptions.roomsUserEdited ? (assumptions.roomsActual ?? '') : estRooms}
            style={assumptions.roomsUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
            onChange={e => {
              const v = parseInt(e.target.value);
              const edited = !isNaN(v) && v !== estRooms;
              update('roomsActual', isNaN(v) ? null : v);
              update('roomsUserEdited', edited);
            }} />
        </InputRow>
      </div>
      <Derived>{assumptions.roomsUserEdited ? `Auto-calc: ${estRooms} rooms · Override: ${assumptions.roomsActual}` : `Auto-calc: ${estRooms} rooms (${pct.multipet}% multi-pet)`}</Derived>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <InputRow label="# SocPGs">
          <Inp type="number" value={assumptions.socpg} min={1} max={6}
            onChange={e => update('socpg', parseInt(e.target.value) || 2)} />
        </InputRow>
        <InputRow label="# SelPGs">
          <Inp type="number" value={assumptions.selpg} min={0} max={4}
            onChange={e => update('selpg', parseInt(e.target.value) || 0)} />
        </InputRow>
        <InputRow label="# SCs ↺ auto">
          <Inp type="number"
            value={assumptions.scUserEdited ? (assumptions.scActual ?? '') : estSC}
            style={assumptions.scUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
            onChange={e => {
              const v = parseInt(e.target.value);
              const edited = !isNaN(v) && v !== estSC;
              update('scActual', isNaN(v) ? null : v);
              update('scUserEdited', edited);
            }} />
        </InputRow>
      </div>
      <Derived>{assumptions.scUserEdited ? `Auto-calc: ${estSC} SCs · Override: ${assumptions.scActual}` : `Auto-calc: ${estSC} SCs (${pct.pf}% of dogs)`}</Derived>

      <SubHead style={{ marginTop: 8 }}>🐈 Cats</SubHead>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <InputRow label="Cats ↺ auto">
          <Inp type="number"
            value={assumptions.catsUserEdited ? (assumptions.catsActual ?? '') : estCats}
            style={assumptions.catsUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
            onChange={e => {
              const v = parseInt(e.target.value);
              const edited = !isNaN(v) && v !== estCats;
              update('catsActual', isNaN(v) ? null : v);
              update('catsUserEdited', edited);
            }} />
        </InputRow>
        <InputRow label="Cat Rooms ↺ auto">
          <Inp type="number"
            value={assumptions.catRoomsUserEdited ? (assumptions.catRoomsActual ?? '') : estBung}
            style={assumptions.catRoomsUserEdited ? { borderColor: 'var(--gold-dark)', background: 'var(--gold-light)' } : {}}
            onChange={e => {
              const v = parseInt(e.target.value);
              const edited = !isNaN(v) && v !== estBung;
              update('catRoomsActual', isNaN(v) ? null : v);
              update('catRoomsUserEdited', edited);
            }} />
        </InputRow>
      </div>
      <Derived>{`Auto: ${estCats} cats · ${estBung} bungalow${estBung !== 1 ? 's' : ''}`}</Derived>

      <div style={{ marginTop: 8 }}>
        <InputRow label="Date">
          <Inp type="date" value={assumptions.date || ''}
            onChange={e => update('date', e.target.value)} />
        </InputRow>
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
    <div style={{ marginBottom: 10 }}>
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
      color: 'var(--gray)', margin: '6px 0 4px', ...style,
    }}>{children}</div>
  );
}

function Derived({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 3, fontStyle: 'italic', marginBottom: 4 }}>
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
