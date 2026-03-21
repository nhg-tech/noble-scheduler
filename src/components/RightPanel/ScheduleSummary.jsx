import { useMemo } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { computeSummary } from '../../utils/calculations';
import { formatMin } from '../../utils/scheduling';

export default function ScheduleSummary() {
  const { schedule, assumptions, getDerivedValues, getProgramPct } = useScheduler();
  const { suites, cats, bungalows, scCount } = getDerivedValues();
  const { socpg, selpg, dogs } = assumptions;
  const { multipet, multipetCats } = getProgramPct();

  const summary = useMemo(() => computeSummary({
    dogs, multipet, multipetCats, socpg, selpg,
    suites, cats, bungalows, scCount, schedule,
  }), [schedule, assumptions, suites, cats, bungalows, scCount]);

  const deltaColor = summary.delta < 0 ? '#FF5252' : summary.delta > 60 ? '#4CAF50' : 'var(--gold-dark)';

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 15,
        fontWeight: 700,
        color: 'var(--purple)',
        marginBottom: 10,
        letterSpacing: '0.02em',
      }}>Schedule Summary</div>

      <Row label="Tasks placed" value={summary.taskCount} />
      <Row label="Hours scheduled" value={`${summary.schedHrs.toFixed(1)}h`} />
      <Row label="Hours available" value={`${summary.hrsAvail.toFixed(1)}h`} />
      <Row label="Open slots" value={`${summary.openSlots} (${Math.round(summary.openMins)}m)`} />

      <div style={{ borderTop: '1px solid var(--gray-light)', margin: '8px 0' }} />

      <Row label="Est. time required" value={`${summary.reqHrs.toFixed(1)}h`} />
      <Row
        label="Delta"
        value={`${summary.delta >= 0 ? '+' : ''}${Math.round(summary.delta)}m`}
        valueColor={deltaColor}
        bold
      />

      {summary.missing.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: '6px 8px',
          background: 'rgba(255,82,82,0.08)',
          borderRadius: 6,
          border: '1px solid rgba(255,82,82,0.2)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#FF5252', marginBottom: 3 }}>Missing</div>
          {summary.missing.map(code => (
            <div key={code} style={{ fontSize: 11, color: '#FF5252' }}>• {code}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueColor, bold }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 11, color: 'var(--gray)' }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: bold ? 700 : 500,
        color: valueColor || 'var(--dark)',
        fontFamily: "'DM Mono', monospace",
      }}>{value}</span>
    </div>
  );
}
