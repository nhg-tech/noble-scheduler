import { useState } from 'react';
import Modal, { ModalFooter, Btn } from './Modal';

/**
 * SaveModal — used for Save Draft, Save Template, and Post Schedule.
 * Props:
 *   mode: 'draft' | 'template' | 'post'
 *   existingName: string | null — currently loaded template/schedule name for overwrite
 *   existingScope?: string | null — current entity scope/status used to decide whether overwrite applies
 *   existingNames?: string[] | { master?: string[], my?: string[] } — names already in the selected bucket
 *   onSave: (name: string) => void
 *   onClose: () => void
 */
export default function SaveModal({ mode, existingName, existingScope = null, existingNames = [], onSave, onClose }) {
  const [name, setName] = useState('');
  const [tplType, setTplType] = useState('master'); // 'master' | 'my' — only used for template mode
  const [nameError, setNameError] = useState('');

  const titles = {
    draft: 'Save Draft',
    template: 'Save Template',
    post: 'Post Schedule',
  };

  const placeholders = {
    draft: 'e.g. Thursday draft',
    template: tplType === 'master' ? 'e.g. Standard Weekday' : 'e.g. My custom layout',
    post: 'e.g. Thursday June 5',
  };

  const namesInScope = mode === 'template'
    ? (tplType === 'master'
        ? existingNames.master || []
        : existingNames.my || [])
    : existingNames;

  const normalizedName = name.trim().toLowerCase();
  const hasDuplicateName = normalizedName && namesInScope.some(existing => existing.toLowerCase() === normalizedName);
  const templateScopeMatches = mode !== 'template' || existingScope === tplType;
  const showOverride = !!existingName && templateScopeMatches;

  function handleSave() {
    if (!name.trim()) return;
    if (hasDuplicateName) {
      setNameError(`A ${mode === 'template' ? 'template' : 'schedule'} named "${name.trim()}" already exists. Use the overwrite option instead.`);
      return;
    }
    setNameError('');
    onSave(name.trim(), tplType);
  }

  const overrideLabel = {
    draft: 'Overwrite current draft',
    template: 'Override existing',
    post: 'Overwrite current posted schedule',
  };

  return (
    <Modal title={titles[mode] || 'Save'} onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Template type toggle — Master vs My */}
        {mode === 'template' && (
          <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '1.5px solid var(--purple-light)' }}>
            {[
              { value: 'master', label: '🏢 Master Template', desc: 'Shared business template' },
              { value: 'my',     label: '👤 My Template',     desc: 'Personal saved template' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setTplType(opt.value);
                  setNameError('');
                }}
                style={{
                  flex: 1, padding: '8px 10px', border: 'none', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  background: tplType === opt.value ? 'var(--purple)' : 'var(--purple-pale)',
                  color: tplType === opt.value ? '#fff' : 'var(--purple)',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Override option */}
        {showOverride && (
          <>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--gray)',
                letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8,
              }}>{overrideLabel[mode] || 'Override Existing'}</div>
              <button
                onClick={() => onSave(existingName, tplType)}
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
                <span>💾 Save over "{existingName}"</span>
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
            onChange={e => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
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
          {nameError && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              color: '#B42318',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {nameError}
            </div>
          )}
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
