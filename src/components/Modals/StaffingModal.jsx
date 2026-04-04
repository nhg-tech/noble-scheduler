import Modal, { ModalFooter, Btn } from './Modal';

function Section({ title, children }) {
  return (
    <div style={{
      border: '1px solid var(--gray-light)',
      borderRadius: 10,
      padding: '14px 16px',
      background: '#fff',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--gray)',
        marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function StaffingModal({ scheduleDate, onClose }) {
  return (
    <Modal title="Staffing" onClose={onClose} width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--purple-pale)',
          border: '1px solid var(--gray-light)',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>Active Schedule Date</div>
            <div style={{ fontSize: 13, color: 'var(--dark)', marginTop: 2 }}>
              {scheduleDate || 'No date selected yet'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray)', maxWidth: 320, textAlign: 'right' }}>
            This is the new operational home for staff availability, preferences, and shift assignment.
          </div>
        </div>

        <Section title="Availability">
          <p style={{ margin: 0, fontSize: 12, color: 'var(--gray)', lineHeight: 1.6 }}>
            Recurring availability and date-specific overrides will live here, tied to the active schedule date instead of Setup.
          </p>
        </Section>

        <Section title="Preferences">
          <p style={{ margin: 0, fontSize: 12, color: 'var(--gray)', lineHeight: 1.6 }}>
            Preferred shifts and soft staffing guidance will live here so schedulers can make informed tradeoffs without changing staff master data.
          </p>
        </Section>

        <Section title="Next Up">
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--dark)', fontSize: 12, lineHeight: 1.7 }}>
            <li>Manage weekly availability patterns by staff member</li>
            <li>Add date-specific overrides for time off or special requests</li>
            <li>Support staffing warnings during employee-to-shift assignment</li>
          </ul>
        </Section>
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Close</Btn>
      </ModalFooter>
    </Modal>
  );
}
