import { useMemo, useState, useRef, useEffect } from 'react';
import { useScheduler } from '../../context/SchedulerContext';
import { computeSummary, computeTaskDuration } from '../../utils/calculations';
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

function fmtMins(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ScheduleSummary() {
  const { schedule, assumptions, getDerivedValues, getProgramPct, getTaskDefault, getEffectiveRoles, columnOrder,
          skippedTasks, userTaskDefs, sessionTaskDefs, extraRoles, taskLibrary, hiddenColumns } = useScheduler();
  const { suites, cats, bungalows, scCount, totalRooms } = getDerivedValues();
  const { socpg, selpg, dogs } = assumptions;
  const { multipet, multipetCats } = getProgramPct();
  // Only count hours for roles currently visible (in columnOrder and not hidden)
  const effectiveRoles = getEffectiveRoles().filter(r => columnOrder.includes(r.id) && !hiddenColumns.has(r.id));
  // 99 = all roles means every visible column — must match what the grid actually shows
  const totalRoleCount = getEffectiveRoles().filter(r => columnOrder.includes(r.id) && !hiddenColumns.has(r.id)).length
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

  // Span calculation is now handled inside computeSummary via the shared computeAllSpanMins
  // utility — no local duplication needed.
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
    getTaskDefault,
  }), [schedule, countingSchedule, assumptions, suites, cats, bungalows, scCount, effectiveRoles, skippedTasks, userTaskDefs, sessionTaskDefs, getTaskDefault]);

  // Per-task breakdown for the Est. time required tooltip
  const reqBreakdown = useMemo(() => {
    const derivedValues = { suites, cats, bungalows, scCount, totalRooms };
    const allTasks = [
      ...taskLibrary,
      ...Object.values(sessionTaskDefs || {}),
      ...Object.entries(userTaskDefs || {})
        .filter(([id, t]) => !taskLibrary.find(lib => lib.id === id) && !sessionTaskDefs?.[id] && !t.hidden)
        .map(([, t]) => t),
    ];
    const items = [];
    allTasks.forEach(task => {
      if (skippedTasks?.has(task.id)) return;
      const override = userTaskDefs?.[task.id] || {};
      if (override.hidden) return;
      const effectiveUnitMin   = override.durationMin ?? task.durationMin ?? task.unitMin;
      const effectiveUnitBasis = override.unitBasis   ?? task.unitBasis   ?? 'Fixed';
      const mergedTask = { ...task, unitMin: effectiveUnitMin, unitBasis: effectiveUnitBasis };
      const duration  = computeTaskDuration(mergedTask, derivedValues, assumptions);
      const overrideMin = override.minResources === 99 ? totalRoleCount : override.minResources;
      const instances = overrideMin ?? 1;
      if (duration > 0 && instances > 0) {
        items.push({
          name:      override.code ?? task.code ?? task.name ?? task.id,
          duration:  Math.round(duration),
          instances,
          total:     Math.round(duration * instances),
        });
      }
    });
    return items.sort((a, b) => b.total - a.total);
  }, [taskLibrary, sessionTaskDefs, userTaskDefs, skippedTasks, suites, cats, bungalows, scCount, totalRooms, assumptions, totalRoleCount]);

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

      <Row
        label="Est. time required"
        value={`${summary.reqHrs.toFixed(1)}h`}
        tooltip={<ReqBreakdown items={reqBreakdown} totalMins={Math.round(summary.reqMins)} />}
      />
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

function ReqBreakdown({ items, totalMins }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)', marginBottom: 6 }}>
        Est. time required = task duration × min. staffing
      </div>
      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gray-light)' }}>
              <th style={{ textAlign: 'left',  padding: '2px 4px', color: 'var(--gray)', fontWeight: 600 }}>Task</th>
              <th style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--gray)', fontWeight: 600 }}>Dur</th>
              <th style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--gray)', fontWeight: 600 }}>×</th>
              <th style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--gray)', fontWeight: 600 }}>Staff</th>
              <th style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--gray)', fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '2px 4px', color: 'var(--dark)', fontFamily: "'DM Mono', monospace" }}>{item.name}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: 'var(--gray)' }}>{fmtMins(item.duration)}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: 'var(--gray)' }}>×</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: 'var(--gray)' }}>{item.instances}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: 'var(--dark)', fontWeight: 600 }}>{fmtMins(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--gray-light)' }}>
              <td colSpan={4} style={{ padding: '3px 4px', fontWeight: 700, color: 'var(--purple)' }}>Total</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--purple)' }}>{fmtMins(totalMins)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Max dimensions: ~2× the default width, 50% of viewport height
const TOOLTIP_MAX_W = 640;
const TOOLTIP_MIN_W = 320;

function InfoIcon({ tooltip }) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState(null);
  const iconRef   = useRef(null);
  const panelRef  = useRef(null);

  // Close on any click outside the tooltip panel
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          iconRef.current  && !iconRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function handleClick(e) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const vh   = window.innerHeight;
    const vw   = window.innerWidth;

    // Prefer opening below; fall back to above if cramped
    const spaceBelow = vh - rect.bottom - 8;
    const openBelow  = spaceBelow >= vh / 2;

    // Clamp left so panel stays within viewport
    const left = Math.max(8, Math.min(rect.right - TOOLTIP_MIN_W, vw - TOOLTIP_MAX_W - 8));

    setPos({
      top:    openBelow ? rect.bottom + 6 : undefined,
      bottom: openBelow ? undefined : vh - rect.top + 6,
      left,
    });
    setOpen(true);
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <span
        ref={iconRef}
        onClick={handleClick}
        style={{
          fontSize: 9, color: 'var(--gold-dark)', border: '1px solid var(--gold-dark)',
          borderRadius: '50%', width: 12, height: 12,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', lineHeight: 1, flexShrink: 0,
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
        }}
      >i</span>
      {open && pos && (
        <div
          ref={panelRef}
          style={{
            position:  'fixed',
            top:       pos.top,
            bottom:    pos.bottom,
            left:      pos.left,
            minWidth:  TOOLTIP_MIN_W,
            maxWidth:  TOOLTIP_MAX_W,
            width:     'max-content',
            maxHeight: '50vh',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--gray-light)',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            padding: '10px 12px',
            zIndex: 9999,
          }}
        >
          {tooltip}
        </div>
      )}
    </span>
  );
}

function Row({ label, value, valueColor, bold, tooltip }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 11, color: 'var(--gray)', display: 'flex', alignItems: 'center' }}>
        {label}
        {tooltip && <InfoIcon tooltip={tooltip} />}
      </span>
      <span style={{
        fontSize: 12,
        fontWeight: bold ? 700 : 500,
        color: valueColor || 'var(--dark)',
        fontFamily: "'DM Mono', monospace",
      }}>{value}</span>
    </div>
  );
}
