import { useMemo } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { computeSummary } from '../../utils/calculations';
import { formatMin } from '../../utils/scheduling';

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
  const { schedule, assumptions, getDerivedValues, getProgramPct, getTaskDefault, getEffectiveRoles, columnOrder,
          skippedTasks, userTaskDefs, sessionTaskDefs, extraRoles, taskLibrary, hiddenColumns } = useScheduler();
  const { suites, cats, bungalows, scCount, totalRooms } = getDerivedValues();
  const { socpg, selpg, dogs } = assumptions;
  const { multipet, multipetCats } = getProgramPct();
  // Only count hours for roles currently visible (in columnOrder and not hidden)
  const effectiveRoles = getEffectiveRoles().filter(r => columnOrder.includes(r.id) && !hiddenColumns.has(r.id));
  const allEffectiveRoles = getEffectiveRoles();
  // 99 = all roles means every visible column regardless of type (GM, MR, ON included)
  const totalRoleCount = allEffectiveRoles.filter(r => !hiddenColumns.has(r.id)).length
    + (extraRoles || []).filter(r => !hiddenColumns.has(r.id)).length;

  // Subset of schedule blocks that count toward hours (excludes breaks, optional events, etc.)
  const countingSchedule = useMemo(() => {
    const roleMap = Object.fromEntries(effectiveRoles.map(r => [r.id, r]));
    const out = {};
    Object.entries(schedule).forEach(([key, block]) => {
      const roleId = key.split('|')[0];
      const role = roleMap[roleId];
      if (role && role.includeInHrs === false) return; // excluded role
      const libTask = block.taskId
        ? taskLibrary.find(t => t.id === block.taskId)
        : taskLibrary.find(t => t.code === block.code);
      if (!libTask) { out[key] = block; return; } // unknown tasks count by default
      const def = getTaskDefault(libTask.id);
      if (def.countHours !== false) out[key] = block;
    });
    return out;
  }, [schedule, getTaskDefault, effectiveRoles]);

  // Span-based scheduled mins: per included role, (lastTaskEnd - firstTaskStart) - nonCountedMins.
  // Matches the purple row in the column header — gaps between tasks count; only breaks/lunch are subtracted.
  const spanBasedSchedMins = useMemo(() => {
    const roleMap = Object.fromEntries(effectiveRoles.map(r => [r.id, r]));
    const byRole = {};
    Object.entries(schedule).forEach(([key, block]) => {
      const roleId  = key.split('|')[0];
      const startMin = Number(key.split('|')[1]);
      if (!byRole[roleId]) byRole[roleId] = [];
      byRole[roleId].push({ block, startMin });
    });
    let total = 0;
    Object.entries(byRole).forEach(([roleId, blocks]) => {
      const role = roleMap[roleId];
      if (!role || role.includeInHrs === false) return;
      let minStart = Infinity, maxEnd = -Infinity, nonCountedMins = 0;
      blocks.forEach(({ block, startMin }) => {
        const dur = Number(block.durationMin ?? (block.slots * 30));
        minStart = Math.min(minStart, startMin);
        maxEnd   = Math.max(maxEnd, startMin + dur);
        const libTask = block.taskId
          ? taskLibrary.find(t => t.id === block.taskId)
          : taskLibrary.find(t => t.code === block.code);
        const def     = libTask ? getTaskDefault(libTask.id) : null;
        if (def && def.countHours === false) nonCountedMins += dur;
      });
      if (minStart !== Infinity) total += (maxEnd - minStart) - nonCountedMins;
    });
    return total;
  }, [schedule, effectiveRoles, getTaskDefault]);

  const summary = useMemo(() => computeSummary({
    dogs, multipet, multipetCats, socpg, selpg,
    suites, cats, bungalows, scCount,
    schedule, countingSchedule, effectiveRoles,
    taskLibrary,
    userTaskDefs,
    sessionTaskDefs,
    skippedTasks,
    roleCount: totalRoleCount,
    derivedValues: { suites, cats, bungalows, scCount, totalRooms },
    assumptions,
    schedMinsOverride: spanBasedSchedMins,
  }), [schedule, countingSchedule, spanBasedSchedMins, assumptions, suites, cats, bungalows, scCount, effectiveRoles, skippedTasks, userTaskDefs, sessionTaskDefs]);

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
