import { useMemo } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { computeSummary } from '../../utils/calculations';
import { formatMin } from '../../utils/scheduling';
import { TASK_LIBRARY } from '../../data/taskLibrary';

function fmtDelta(mins) {
  const sign = mins >= 0 ? '+' : '-';
  const abs  = Math.abs(Math.round(mins));
  const h    = Math.floor(abs / 60);
  const m    = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

export default function ScheduleSummary() {
  const { schedule, assumptions, getDerivedValues, getProgramPct, getTaskDefault, getEffectiveRoles, columnOrder } = useScheduler();
  const { suites, cats, bungalows, scCount } = getDerivedValues();
  const { socpg, selpg, dogs } = assumptions;
  const { multipet, multipetCats } = getProgramPct();
  // Only count hours for roles currently visible (in columnOrder)
  const effectiveRoles = getEffectiveRoles().filter(r => columnOrder.includes(r.id));

  // Subset of schedule blocks that count toward hours (excludes breaks, optional events, etc.)
  const countingSchedule = useMemo(() => {
    const out = {};
    Object.entries(schedule).forEach(([key, block]) => {
      const libTask = TASK_LIBRARY.find(t => t.code === block.code);
      if (!libTask) { out[key] = block; return; } // unknown tasks count by default
      const def = getTaskDefault(libTask.id);
      if (def.countHours !== false) out[key] = block;
    });
    return out;
  }, [schedule, getTaskDefault]);

  const summary = useMemo(() => computeSummary({
    dogs, multipet, multipetCats, socpg, selpg,
    suites, cats, bungalows, scCount, schedule, countingSchedule, effectiveRoles,
  }), [schedule, countingSchedule, assumptions, suites, cats, bungalows, scCount, effectiveRoles]);

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
        value={fmtDelta(summary.delta)}
        valueColor={deltaColor}
        bold
      />

      {/* Missing box hidden — to be revisited */}
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
