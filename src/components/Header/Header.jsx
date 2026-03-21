import { useScheduler } from '../../context/SchedulerContext';

export default function Header({ onSetup, onSaveDraft, onSaveTemplate, onPostSchedule, onValidate, onChecklist, onPrint }) {
  const { scheduleLabel, setSchedule } = useScheduler();

  function handleClear() {
    if (window.confirm('Clear all scheduled tasks?')) setSchedule({});
  }

  return (
    <header style={{
      background: 'var(--purple)', color: '#fff',
      padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '56px',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 2px 16px rgba(62,42,126,0.25)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: 32, height: 32, background: 'var(--gold)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 16, color: 'var(--purple)',
        }}>N</div>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, letterSpacing: '0.02em' }}>
            Noble Task Scheduler
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Noble Pet Resort · SeaTac, WA</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginRight: 4 }}>{scheduleLabel}</span>
        <Btn onClick={onSetup}>⚙ Setup</Btn>
        <Btn onClick={onSaveDraft}>📝 Save Draft</Btn>
        <Btn onClick={onSaveTemplate}>💾 Save Template</Btn>
        <Btn onClick={onPostSchedule}>📋 Post Schedule</Btn>
        <Btn onClick={onValidate}>⚡ Validate</Btn>
        <Btn onClick={onChecklist}>☑ Checklist</Btn>
        <Btn onClick={handleClear}>🗑 Clear</Btn>
        <Btn onClick={onPrint} gold>🖨 Print</Btn>
      </div>
    </header>
  );
}

function Btn({ children, onClick, gold }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 6,
      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
      cursor: 'pointer', transition: 'all 0.15s',
      display: 'flex', alignItems: 'center', gap: 6,
      background: gold ? 'var(--gold)' : 'rgba(255,255,255,0.12)',
      color: gold ? 'var(--purple)' : '#fff',
      border: gold ? 'none' : '1px solid rgba(255,255,255,0.2)',
      fontWeight: gold ? 600 : 500,
    }}>
      {children}
    </button>
  );
}
