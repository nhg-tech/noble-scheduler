import Modal, { ModalFooter, Btn } from './Modal';

function SaveOption({ title, description, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 8,
        border: '1.5px solid var(--gray-light)',
        background: 'var(--cream)',
        color: 'var(--dark)',
        fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.1 }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--gray)', lineHeight: 1.45 }}>{description}</span>
      </span>
    </button>
  );
}

export default function SaveChooserModal({
  canSaveDraft,
  canSaveTemplate,
  onChoose,
  onClose,
}) {
  return (
    <Modal title="Save Schedule" onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {canSaveDraft && (
          <SaveOption
            title="Save Draft"
            description="Save a working version you can keep editing later."
            icon="📝"
            onClick={() => onChoose('draft')}
          />
        )}
        {canSaveTemplate && (
          <SaveOption
            title="Save Template"
            description="Save the current layout as a reusable template."
            icon="💾"
            onClick={() => onChoose('template')}
          />
        )}
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
      </ModalFooter>
    </Modal>
  );
}
