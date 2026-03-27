import { useState } from 'react';
import Modal, { ModalFooter, Btn } from '../Modals/Modal';

/**
 * PrintModal — lets the user choose paper size + optional sections before printing.
 * onPrint(opts) is called when the user confirms; the parent injects @page CSS and calls window.print().
 */
export default function PrintModal({ onPrint, onClose }) {
  const [paperSize,       setPaperSize]       = useState('legal');
  const [inclSummary,     setInclSummary]     = useState(true);
  const [inclAssumptions, setInclAssumptions] = useState(true);

  function handlePrint() {
    onPrint({ paperSize, inclSummary, inclAssumptions });
    onClose();
  }

  return (
    <Modal title="Print Schedule" onClose={onClose} width={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '2px 0' }}>

        {/* Paper size */}
        <div>
          <FieldLabel>Paper Size</FieldLabel>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {[
              { val: 'legal',  label: 'Legal  (14 × 8.5")' },
              { val: 'letter', label: 'Letter (11 × 8.5")' },
            ].map(({ val, label }) => (
              <label key={val} style={{
                display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: 'var(--dark)',
              }}>
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

        <div style={{ borderTop: '1px solid var(--gray-light)', paddingTop: 14 }}>
          <FieldLabel>Optional Sections</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
            <CheckRow
              label="Include Schedule Summary"
              checked={inclSummary}
              onChange={setInclSummary}
            />
            <CheckRow
              label="Include Assumptions"
              checked={inclAssumptions}
              onChange={setInclAssumptions}
            />
          </div>
        </div>

        <div style={{
          fontSize: 11, color: 'var(--gray)', fontStyle: 'italic', lineHeight: 1.6,
          background: 'var(--cream)', borderRadius: 6, padding: '8px 10px',
        }}>
          Landscape orientation · Grid auto-scales to fill the selected paper size
        </div>
      </div>

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handlePrint} variant="primary">🖨 Print</Btn>
      </ModalFooter>
    </Modal>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--gray)',
      letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>{children}</div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
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
