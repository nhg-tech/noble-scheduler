import Modal, { ModalFooter, Btn } from './Modal';

function WarningRow({ warning }) {
  const strong = warning.severity === 'strong';
  return (
    <div style={{
      border: `1px solid ${strong ? '#F5C2C7' : 'var(--gray-light)'}`,
      background: strong ? '#FFF4F4' : 'var(--cream)',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: strong ? '#B42318' : 'var(--purple)',
      }}>
        {warning.title}
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--dark)',
        lineHeight: 1.5,
        marginTop: 4,
      }}>
        {warning.message}
      </div>
    </div>
  );
}

export default function AssignmentWarningModal({
  employeeName,
  columnLabel,
  warnings,
  onConfirm,
  onClose,
}) {
  const strongCount = warnings.filter((warning) => warning.severity === 'strong').length;

  return (
    <Modal title="Assignment Warnings" onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--gray)', lineHeight: 1.55 }}>
          Assigning <strong>{employeeName}</strong> to <strong>{columnLabel}</strong> raised {warnings.length} warning{warnings.length === 1 ? '' : 's'}.
          {strongCount > 0 ? ' Strong warnings usually mean the employee is unavailable for some or all of this shift.' : ' These are advisory only.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {warnings.map((warning, index) => (
            <WarningRow key={`${warning.type}-${index}`} warning={warning} />
          ))}
        </div>
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={onConfirm} variant="gold">Assign Anyway</Btn>
      </ModalFooter>
    </Modal>
  );
}
