import { useState } from 'react';
import Modal, { ModalFooter, Btn } from '../Modals/Modal';
import { useScheduler } from '../../context/SchedulerContext';

/**
 * PrintModal — lets the user configure print options before printing.
 * onPrint(opts) is called when the user confirms.
 */
export default function PrintModal({ onPrint, onClose }) {
  const { getEffectiveRoles, extraRoles, columnOrder, hiddenColumns } = useScheduler();

  // Build the list of currently-visible columns (matches what's on screen)
  const allRolesBase = [...getEffectiveRoles(), ...extraRoles];
  const visibleRoles = columnOrder
    .map(id => allRolesBase.find(r => r.id === id))
    .filter(Boolean)
    .filter(r => !hiddenColumns.has(r.id));

  const [paperSize,       setPaperSize]       = useState('legal');
  const [inclSummary,     setInclSummary]     = useState(true);
  const [inclAssumptions, setInclAssumptions] = useState(true);
  // Set of role IDs to EXCLUDE from print (empty = print all visible)
  const [excludedCols,    setExcludedCols]    = useState(new Set());

  function toggleCol(id) {
    setExcludedCols(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allSelected  = excludedCols.size === 0;
  const noneSelected = excludedCols.size === visibleRoles.length;

  function selectAll()  { setExcludedCols(new Set()); }
  function selectNone() { setExcludedCols(new Set(visibleRoles.map(r => r.id))); }

  function handlePrint() {
    onPrint({ paperSize, inclSummary, inclAssumptions, excludedCols: [...excludedCols] });
    onClose();
  }

  const includedCount = visibleRoles.length - excludedCols.size;

  return (
    <Modal title="Print Schedule" onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '2px 0' }}>

        {/* ── Paper size ─────────────────────────────────────────────────── */}
        <div>
          <FieldLabel>Paper Size</FieldLabel>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {[
              { val: 'legal',  label: 'Legal  (14 × 8.5")' },
              { val: 'letter', label: 'Letter (11 × 8.5")' },
            ].map(({ val, label }) => (
              <label key={val} style={radioLabelStyle}>
                <input
                  type="radio" name="paperSize" value={val}
                  checked={paperSize === val}
                  onChange={() => setPaperSize(val)}
                  style={{ accentColor: 'var(--purple)', width: 14, height: 14 }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* ── Columns to print ───────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--gray-light)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <FieldLabel>
              Columns to Print
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 5, fontSize: 10, color: 'var(--gray)' }}>
                ({includedCount} of {visibleRoles.length})
              </span>
            </FieldLabel>
            <div style={{ display: 'flex', gap: 4 }}>
              <QuickBtn onClick={selectAll}  active={allSelected}>All</QuickBtn>
              <QuickBtn onClick={selectNone} active={noneSelected}>None</QuickBtn>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {visibleRoles.map(role => {
              const included = !excludedCols.has(role.id);
              return (
                <button
                  key={role.id}
                  onClick={() => toggleCol(role.id)}
                  title={role.sub}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: `1.5px solid ${included ? 'var(--purple)' : 'var(--gray-light)'}`,
                    background: included ? 'var(--purple-pale)' : 'var(--cream)',
                    color: included ? 'var(--purple)' : 'var(--gray)',
                    cursor: 'pointer',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11, fontWeight: 700,
                    transition: 'all 0.1s',
                    lineHeight: 1.3,
                  }}
                >
                  {role.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Optional footer sections ───────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--gray-light)', paddingTop: 14 }}>
          <FieldLabel>Optional Footer Sections</FieldLabel>
          <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
            <CheckRow label="Schedule Summary"  checked={inclSummary}     onChange={setInclSummary} />
            <CheckRow label="Assumptions"       checked={inclAssumptions} onChange={setInclAssumptions} />
          </div>
        </div>

        {/* ── Info line ─────────────────────────────────────────────────── */}
        <div style={{
          fontSize: 11, color: 'var(--gray)', fontStyle: 'italic', lineHeight: 1.5,
          background: 'var(--cream)', borderRadius: 6, padding: '7px 10px',
        }}>
          Landscape orientation · Grid auto-scales to fill the selected paper size
        </div>
      </div>

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handlePrint} variant="primary" disabled={includedCount === 0}>
          🖨 Print
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--gray)',
      letterSpacing: '0.05em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center',
    }}>{children}</div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
      fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: 'var(--dark)',
    }}>
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--purple)', width: 14, height: 14 }}
      />
      {label}
    </label>
  );
}

function QuickBtn({ onClick, active, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
      fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
      border: `1px solid ${active ? 'var(--purple)' : 'var(--gray-light)'}`,
      background: active ? 'var(--purple)' : 'var(--cream)',
      color: active ? '#fff' : 'var(--gray)',
      transition: 'all 0.1s',
    }}>{children}</button>
  );
}

const radioLabelStyle = {
  display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: 'var(--dark)',
};
