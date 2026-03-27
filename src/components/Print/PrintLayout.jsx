import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useScheduler } from '../../context/SchedulerContext';
import { TIME_SLOTS, ROLES } from '../../data/roles';
import { keyToRoleAndMin, formatMin, inShift } from '../../utils/scheduling';
import { resolveBlockHex, resolveBlockText } from '../../data/palette';
import { computeSummary } from '../../utils/calculations';
import { TASK_LIBRARY } from '../../data/taskLibrary';

// ─── Print layout constants ───────────────────────────────────────────────────
const MIN_SLOT_H     = 14;   // minimum px per 30-min slot
const MAX_SLOT_H     = 30;   // maximum px per 30-min slot (don't over-expand)
const PRINT_TIME_W   = 40;   // time gutter width
const PRINT_COL_W    = 112;  // per-role column width
const COL_HEADER_H   = 38;   // column header strip
const PAGE_HEADER_H  = 34;   // facility / date banner
const FOOTER_H       = 82;   // compact footer (title + 2 content rows)
const FOOTER_GAP     = 6;    // gap between grid and footer
const BETWEEN_GAP    = 10;   // gap between footer boxes

// Printable area in px @ 96 dpi with 0.4 in margins each side
const PAPER = {
  legal:  { w: Math.round((14 - 0.80) * 96), h: Math.round((8.5 - 0.80) * 96) },  // ~1267 × 711
  letter: { w: Math.round((11 - 0.80) * 96), h: Math.round((8.5 - 0.80) * 96) },  // ~ 979 × 711
};

// ─── Compact shift-time formatter (for column headers) ───────────────────────
function fmtShift(decimal) {
  const total  = ((decimal % 24) + 24) % 24;
  const h24    = Math.floor(total);
  const m      = Math.round((total - h24) * 60);
  const suffix = h24 < 12 ? 'a' : 'p';
  const h12    = h24 % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function fmtDelta(mins) {
  if (mins == null) return '—';
  const sign = mins >= 0 ? '+' : '-';
  const abs  = Math.abs(Math.round(mins));
  const h    = Math.floor(abs / 60);
  const m    = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

// ─── PrintLayout ─────────────────────────────────────────────────────────────
/**
 * Always present in the DOM (display:none normally).
 * During @media print it becomes visible as the sole printed element.
 * opts: { paperSize: 'legal'|'letter', inclSummary: bool, inclAssumptions: bool }
 */
export default function PrintLayout({ opts }) {
  const {
    schedule, assumptions, scheduleLabel,
    getEffectiveRoles, extraRoles, columnOrder, hiddenColumns,
    getDerivedValues, getProgramPct, getTaskDefault,
    userTaskDefs, sessionTaskDefs, skippedTasks,
  } = useScheduler();

  const { paperSize = 'legal', inclSummary = true, inclAssumptions = true, excludedCols = [] } = opts || {};
  const excludedSet = new Set(excludedCols);

  // ── Visible columns (screen-visible minus any print-excluded ones) ─────────
  const allRolesBase = [...getEffectiveRoles(), ...extraRoles];
  const roles = columnOrder
    .map(id => allRolesBase.find(r => r.id === id))
    .filter(Boolean)
    .filter(r => !hiddenColumns.has(r.id))
    .filter(r => !excludedSet.has(r.id));

  // ── Active slot range — trim to actual task content ────────────────────────
  const { activeStart, activeEnd } = useMemo(() => {
    let minMin = Infinity, maxMin = -Infinity;
    Object.entries(schedule).forEach(([key, task]) => {
      const { startMin } = keyToRoleAndMin(key);
      const dur = task.durationMin ?? task.slots * 30;
      minMin = Math.min(minMin, startMin);
      maxMin = Math.max(maxMin, startMin + dur);
    });
    if (minMin === Infinity) { minMin = 5 * 60; maxMin = 21.5 * 60; }
    // Pad by 1 slot each side, then align to 30-min boundary
    const startMin = Math.floor(Math.max(0, minMin - 30) / 30) * 30;
    const endMin   = Math.ceil((maxMin + 30) / 30) * 30;
    return { activeStart: startMin, activeEnd: endMin };
  }, [schedule]);

  const activeSlots = useMemo(() =>
    TIME_SLOTS.filter(s => {
      const sm = s.hour * 60 + s.min;
      return sm >= activeStart && sm < activeEnd;
    }),
    [activeStart, activeEnd]
  );

  // ── Dimensions & dynamic sizing ──────────────────────────────────────────
  const numCols   = roles.length;
  const numSlots  = activeSlots.length;
  const hasFooter = inclSummary || inclAssumptions;
  const baseH     = PAGE_HEADER_H + COL_HEADER_H + (hasFooter ? FOOTER_GAP + FOOTER_H : 0);

  const page = PAPER[paperSize] || PAPER.legal;

  // Dynamic column width: expand columns to fill page width when there's
  // leftover horizontal space (i.e. fewer columns than usual). Capped at 180px.
  const baseContentW = PRINT_TIME_W + numCols * PRINT_COL_W;
  const colW = (numCols > 0 && baseContentW < page.w)
    ? Math.min(180, Math.floor((page.w - PRINT_TIME_W) / numCols))
    : PRINT_COL_W;
  const contentW = PRINT_TIME_W + numCols * colW;

  // Dynamic slot height: expand slots to fill available page height.
  // When widthScale ≥ 1 (content narrower than page, scale capped at 1),
  // use page.h directly; otherwise use page.h / widthScale (pre-zoom budget).
  const widthScale     = page.w / contentW;
  const effectivePageH = widthScale >= 1 ? page.h : page.h / widthScale;
  const idealSlotH     = numSlots > 0 ? (effectivePageH - baseH) / numSlots : MIN_SLOT_H;
  const slotH          = Math.min(MAX_SLOT_H, Math.max(MIN_SLOT_H, Math.floor(idealSlotH)));

  const gridH    = numSlots * slotH;
  const contentH = baseH + gridH;
  const scale    = Math.min(page.w / contentW, page.h / contentH, 1);

  // ── Summary calculation (mirrors ScheduleSummary) ─────────────────────────
  const { suites, cats, bungalows, scCount, totalRooms } = getDerivedValues();
  const { socpg, selpg, dogs } = assumptions;
  const { multipet, multipetCats } = getProgramPct();
  const effectiveRoles = getEffectiveRoles().filter(r => columnOrder.includes(r.id));
  const baseRoleCount  = ROLES.filter(r => r.type === 'TM' || r.type === 'TL' || r.type === 'PAW').length;
  const totalRoleCount = baseRoleCount + (extraRoles?.length || 0);

  const countingSchedule = useMemo(() => {
    const roleMap = Object.fromEntries(effectiveRoles.map(r => [r.id, r]));
    const out = {};
    Object.entries(schedule).forEach(([key, block]) => {
      const roleId = key.split('|')[0];
      const role = roleMap[roleId];
      if (role && role.includeInHrs === false) return;
      const libTask = TASK_LIBRARY.find(t => t.code === block.code);
      if (!libTask) { out[key] = block; return; }
      const def = getTaskDefault(libTask.id);
      if (def.countHours !== false) out[key] = block;
    });
    return out;
  }, [schedule, getTaskDefault, effectiveRoles]);

  const summary = useMemo(() => computeSummary({
    dogs, multipet, multipetCats, socpg, selpg,
    suites, cats, bungalows, scCount,
    schedule, countingSchedule, effectiveRoles,
    taskLibrary: TASK_LIBRARY,
    userTaskDefs,
    sessionTaskDefs,
    skippedTasks,
    roleCount: totalRoleCount,
    derivedValues: { suites, cats, bungalows, scCount, totalRooms },
    assumptions,
  }), [schedule, countingSchedule, assumptions, suites, cats, bungalows, scCount,
       effectiveRoles, skippedTasks, userTaskDefs, sessionTaskDefs]);

  // ── Assumptions display values ─────────────────────────────────────────────
  const pct    = getProgramPct();
  const estRooms = Math.round(dogs * (1 - pct.multipet / 100));
  const estSC    = Math.max(1, Math.round(dogs * (pct.pf ?? 0) / 100));
  const estCats  = Math.round(dogs * (pct.cats ?? 0) / 100);
  const estBung  = Math.max(1, Math.round(estCats / (1 + (pct.multipetCats ?? 0) / 100)));
  const aRooms   = assumptions.roomsUserEdited    ? assumptions.roomsActual    : estRooms;
  const aSCs     = assumptions.scUserEdited       ? assumptions.scActual       : estSC;
  const aCats    = assumptions.catsUserEdited     ? assumptions.catsActual     : estCats;
  const aBungs   = assumptions.catRoomsUserEdited ? assumptions.catRoomsActual : estBung;

  // ── Date string ───────────────────────────────────────────────────────────
  const dateStr = assumptions.date
    ? new Date(assumptions.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : '';

  const content = (
    <div
      id="noble-print-root"
      style={{ position: 'fixed', left: -99999, top: 0, zIndex: -1, pointerEvents: 'none' }}
    >
      {/* Scale wrapper — zoom scales layout space too, avoiding white-space issues */}
      <div style={{
        width: contentW,
        zoom: scale,
        fontFamily: "'DM Sans', sans-serif",
        background: '#fff',
        color: '#1A1A2E',
        fontSize: 12,
      }}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{
          height: PAGE_HEADER_H,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          borderBottom: '2px solid #3E2A7E',
          paddingBottom: 4, marginBottom: 0,
        }}>
          <div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 17, fontWeight: 700, color: '#3E2A7E', lineHeight: 1.1,
            }}>
              Noble Pet Resort · Task Schedule
            </div>
            <div style={{ fontSize: 9, color: '#6B6B80', marginTop: 1 }}>{scheduleLabel}</div>
          </div>
          {dateStr && (
            <div style={{ fontSize: 10, color: '#6B6B80', fontWeight: 600, marginBottom: 1 }}>
              {dateStr}
            </div>
          )}
        </div>

        {/* ── Column header row ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          borderBottom: '1.5px solid #3E2A7E',
          background: '#F8F5F0',
        }}>
          {/* Time gutter spacer */}
          <div style={{ width: PRINT_TIME_W, minWidth: PRINT_TIME_W, flexShrink: 0 }} />
          {/* Role headers */}
          {roles.map(role => (
            <div key={role.id} style={{
              width: colW, minWidth: colW,
              height: COL_HEADER_H,
              borderLeft: '1px solid #E8E6F0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '3px 4px',
            }}>
              <div style={{
                fontWeight: 700, fontSize: 10, color: '#1A1A2E',
                letterSpacing: '0.02em', textAlign: 'center',
              }}>{role.label}</div>
              <div style={{ fontSize: 8, color: '#6B6B80', marginTop: 1 }}>{role.sub}</div>
              {role.shiftStart != null && role.shiftEnd != null && (
                <div style={{ fontSize: 8, color: '#6B6B80', marginTop: 1, fontFamily: "'DM Mono', monospace" }}>
                  {fmtShift(role.shiftStart)}–{fmtShift(role.shiftEnd)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Grid body ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', height: gridH, position: 'relative' }}>

          {/* Time gutter */}
          <div style={{
            width: PRINT_TIME_W, minWidth: PRINT_TIME_W, flexShrink: 0,
            borderRight: '1px solid #E8E6F0',
          }}>
            {activeSlots.map((slot, i) => {
              const isMidnight = slot.isMidnight;
              return (
                <div key={i} style={{
                  height: slotH, boxSizing: 'border-box',
                  borderBottom: isMidnight ? '1.5px solid #3E2A7E' : '1px solid #E8E6F0',
                  borderTop: isMidnight ? '1.5px solid #3E2A7E' : undefined,
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  paddingRight: 3, paddingTop: 1,
                  background: isMidnight ? 'rgba(62,42,126,0.04)' : undefined,
                }}>
                  {slot.isHour && (
                    <span style={{
                      fontSize: 7, lineHeight: 1,
                      color: isMidnight ? '#3E2A7E' : '#9999AA',
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: isMidnight ? 700 : 400,
                    }}>
                      {isMidnight ? 'MID' : formatMin(slot.hour * 60 + slot.min)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Role columns */}
          {roles.map(role => (
            <PrintColumn
              key={role.id}
              role={role}
              schedule={schedule}
              activeSlots={activeSlots}
              activeStart={activeStart}
              colW={colW}
              slotH={slotH}
              gridH={gridH}
            />
          ))}
        </div>

        {/* ── Footer (compact horizontal layout) ───────────────────────── */}
        {hasFooter && (
          <div style={{
            display: 'flex', gap: BETWEEN_GAP,
            marginTop: FOOTER_GAP,
            borderTop: '1.5px solid #3E2A7E',
            paddingTop: 5,
            height: FOOTER_H,
            overflow: 'hidden',
          }}>
            {inclAssumptions && (
              <FooterBox title="Assumptions">
                {/* 4-column compact grid — 8 items in 2 rows */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '4px 12px',
                }}>
                  <KV label="Dogs"       value={dogs} />
                  <KV label="Dog Rooms"  value={aRooms} />
                  <KV label="SocPGs"     value={socpg} />
                  <KV label="SelPGs"     value={selpg} />
                  <KV label="Svc Coaches" value={aSCs} />
                  <KV label="Cats"       value={aCats} />
                  <KV label="Cat Rooms"  value={aBungs} />
                  <KV label="Total Rooms" value={(aRooms || 0) + (aBungs || 0)} />
                </div>
              </FooterBox>
            )}
            {inclSummary && (
              <FooterBox title="Schedule Summary">
                {/* Single row of 5 key-value stats */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <KV label="Tasks Placed"    value={summary.taskCount} />
                  <KV label="Hrs Scheduled"   value={`${(summary.schedHrs ?? 0).toFixed(1)}h`} />
                  <KV label="Hrs Available"   value={`${(summary.hrsAvail ?? 0).toFixed(1)}h`} />
                  <KV label="Est. Required"   value={`${(summary.reqHrs ?? 0).toFixed(1)}h`} />
                  <KV
                    label="Delta"
                    value={fmtDelta(summary.delta)}
                    bold
                    valueColor={
                      summary.delta < 0 ? '#C0392B'
                      : summary.delta > 60 ? '#1E6B3C'
                      : '#B8860B'
                    }
                  />
                </div>
              </FooterBox>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── PrintColumn ─────────────────────────────────────────────────────────────
function PrintColumn({ role, schedule, activeSlots, activeStart, colW, slotH, gridH }) {
  // Collect task blocks for this role
  const blocks = useMemo(() => {
    const out = [];
    Object.entries(schedule).forEach(([key, task]) => {
      const { roleId, startMin } = keyToRoleAndMin(key);
      if (roleId !== role.id) return;
      out.push({ key, task, startMin });
    });
    return out;
  }, [schedule, role.id]);

  // Background: alternating in-shift / out-of-shift based on inShift
  const slotBgs = useMemo(() =>
    activeSlots.map(slot => {
      // Find this slot's index in the master TIME_SLOTS array so inShift() can work
      const origIdx = TIME_SLOTS.findIndex(s => s.hour === slot.hour && s.min === slot.min);
      const inS = origIdx >= 0 ? inShift(role, origIdx) : false;
      return { isMidnight: slot.isMidnight, inShift: inS };
    }),
    [activeSlots, role]
  );

  return (
    <div style={{
      width: colW, minWidth: colW,
      height: gridH,
      position: 'relative',
      borderLeft: '1px solid #E8E6F0',
      flexShrink: 0,
    }}>
      {/* Background grid rows */}
      {slotBgs.map((sb, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: i * slotH,
          left: 0, right: 0,
          height: slotH,
          boxSizing: 'border-box',
          borderBottom: sb.isMidnight ? '1.5px solid #3E2A7E' : '1px solid #E8E6F0',
          borderTop: sb.isMidnight ? '1.5px solid #3E2A7E' : undefined,
          background: sb.isMidnight
            ? 'rgba(62,42,126,0.06)'
            : sb.inShift
              ? 'transparent'
              : 'rgba(0,0,0,0.025)',
        }} />
      ))}

      {/* Task blocks */}
      {blocks.map(({ key, task, startMin }) => {
        const durationMin = task.durationMin ?? task.slots * 30;
        const topPx    = ((startMin - activeStart) / 30) * slotH;
        const heightPx = Math.max(slotH - 1, (durationMin / 30) * slotH - 1);

        if (task.merged && task.constituents) {
          // Merged block — split vertically by constituent proportion
          return (
            <MergedPrintBlock
              key={key}
              task={task}
              topPx={topPx}
              heightPx={heightPx}
              colW={colW}
            />
          );
        }

        const bgHex  = resolveBlockHex(task.color || 'block-group');
        const txtCol = resolveBlockText(bgHex);

        return (
          <div key={key} style={{
            position: 'absolute',
            top: topPx + 1, left: 1,
            width: colW - 2,
            height: heightPx,
            background: bgHex,
            color: txtCol,
            borderRadius: 3,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}>
            <span style={{
              fontSize: 7, fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.02em',
              textAlign: 'center',
              lineHeight: 1.1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>
              {task.code}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── MergedPrintBlock ─────────────────────────────────────────────────────────
function MergedPrintBlock({ task, topPx, heightPx, colW }) {
  const total = task.constituents.reduce((s, c) => s + (c.durationMin || 0), 0) || 1;

  return (
    <div style={{
      position: 'absolute',
      top: topPx + 1, left: 1,
      width: colW - 2,
      height: heightPx,
      borderRadius: 3,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {task.constituents.map((c, i) => {
        const pct    = (c.durationMin || 0) / total;
        const segH   = pct * heightPx;
        const bgHex  = resolveBlockHex(task.colors?.[i] || c.color || 'block-group');
        const txtCol = resolveBlockText(bgHex);
        return (
          <div key={i} style={{
            height: segH,
            background: bgHex,
            color: txtCol,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <span style={{
              fontSize: 7, fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              padding: '0 2px',
            }}>
              {task.codes?.[i] ?? c.code}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Footer helpers ───────────────────────────────────────────────────────────
function FooterBox({ title, children }) {
  return (
    <div style={{
      flex: 1, background: '#F8F5F0',
      borderRadius: 5, padding: '5px 10px 6px',
      overflow: 'hidden',
    }}>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 10, fontWeight: 700, color: '#3E2A7E',
        marginBottom: 6, borderBottom: '1px solid #E8E6F0', paddingBottom: 3,
        letterSpacing: '0.03em',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/** Compact vertical key-value cell used in the footer grid/flex layouts */
function KV({ label, value, bold, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        fontSize: 7, color: '#9999AA',
        textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1,
      }}>{label}</span>
      <span style={{
        fontSize: 11, lineHeight: 1.1,
        fontWeight: bold ? 700 : 600,
        color: valueColor || '#1A1A2E',
        fontFamily: "'DM Mono', monospace",
      }}>{value}</span>
    </div>
  );
}
