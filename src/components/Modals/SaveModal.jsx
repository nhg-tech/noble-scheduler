import { useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';

/**
 * SaveModal — used for Save Draft, Save Template, and Post Schedule.
 * Props:
 *   mode: 'draft' | 'template' | 'post'
 *   existingName: string | null — for template mode, the currently loaded template name
 *   onSave: (name: string) => void
 *   onClose: () => void
 */
export default function SaveModal({ mode, existingName, onSave, onClose }) {
  const [name, setName] = useState('');

  const titles = {
    draft: 'Save Draft',
    template: 'Save Template',
    post: 'Post Schedule',
  };

  const placeholders = {
    draft: 'e.g. Thursday draft',
    template: 'e.g. 2 soc + 2 sel standard',
    post: 'e.g. Thursday June 5',
  };

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim());
  }

  const showOverride = mode === 'template' && existingName;

  return (
    <Modal title={titles[mode] || 'Save'} onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Override option */}
        {showOverride && (
          <>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--gray)',
                letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8,
              }}>Override Existing</div>
              <button
                onClick={() => onSave(existingName)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 7,
                  border: '1.5px solid var(--purple-light)',
                  background: 'var(--purple-pale)',
                  color: 'var(--purple)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>💾 Override "{existingName}"</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>replaces existing</span>
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--gray)', fontSize: 11,
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--gray-light)' }} />
              <span>or save as new</span>
              <div style={{ flex: 1, height: 1, background: 'var(--gray-light)' }} />
            </div>
          </>
        )}

        {/* Save as new */}
        <div>
          {showOverride && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--gray)',
              letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8,
            }}>New Name</div>
          )}
          {!showOverride && (
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--gray)',
              letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8,
            }}>Name</label>
          )}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={placeholders[mode] || 'Enter name...'}
            autoFocus={!showOverride}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 7,
              border: '1.5px solid var(--gray-light)',
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              color: 'var(--dark)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {mode === 'post' && (
          <p style={{ fontSize: 11, color: 'var(--gray)', margin: 0 }}>
            Posting will lock this schedule for staff viewing. You can still save a draft separately.
          </p>
        )}
      </div>

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={!name.trim()}>
          {showOverride ? 'Save as New' : (titles[mode] || 'Save')}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
