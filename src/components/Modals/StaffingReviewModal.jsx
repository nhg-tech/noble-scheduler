import Modal, { ModalFooter, Btn } from './Modal';

function SummaryCard({ label, value, tone = 'default' }) {
  const tones = {
    default: { background: 'var(--cream)', color: 'var(--dark)', border: 'var(--gray-light)' },
    success: { background: '#ECFDF3', color: '#166534', border: '#BBF7D0' },
    warning: { background: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
    danger: { background: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  };
  const selectedTone = tones[tone] || tones.default;
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: `1px solid ${selectedTone.border}`,
        background: selectedTone.background,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: selectedTone.color }}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--gray)',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

export default function StaffingReviewModal({ review, isLoading = false, onClose, onContinue }) {
  return (
    <Modal title="Staffing Review" onClose={onClose} width={760}>
      {isLoading ? (
        <div style={{ fontSize: 13, color: 'var(--gray)', lineHeight: 1.6 }}>
          Reviewing assignments, availability, preferences, and required skills for this schedule...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--gray-light)',
              background: 'var(--purple-pale)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>Schedule Date</div>
              <div style={{ fontSize: 14, color: 'var(--dark)', marginTop: 2 }}>{review.scheduleDate}</div>
            </div>
            <div style={{ maxWidth: 360, fontSize: 11, color: 'var(--gray)', lineHeight: 1.5, textAlign: 'right' }}>
              Publishing creates a dated team-facing schedule version. You can still publish with warnings if needed, and version history will preserve the prior state.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <SummaryCard label="Columns With Tasks" value={review.columnsWithTasks.length} />
            <SummaryCard label="Assigned" value={review.assignedColumns.length} tone={review.unassignedColumns.length ? 'warning' : 'success'} />
            <SummaryCard label="Unassigned" value={review.unassignedColumns.length} tone={review.unassignedColumns.length ? 'danger' : 'success'} />
            <SummaryCard label="Warnings" value={review.warningCount} tone={review.warningCount ? 'warning' : 'success'} />
          </div>

          {review.unassignedColumns.length > 0 && (
            <div>
              <SectionTitle>Unassigned Shift Columns</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {review.unassignedColumns.map((column) => (
                  <div
                    key={column.roleId}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#991B1B',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {column.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.assignmentIssues.length > 0 && (
            <div>
              <SectionTitle>Assignment Warnings</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {review.assignmentIssues.map((issue) => (
                  <div
                    key={issue.roleId}
                    style={{
                      border: '1px solid var(--gray-light)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>
                        {issue.roleLabel}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                        {issue.employeeName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {issue.warnings.map((warning, index) => (
                        <div
                          key={`${issue.roleId}-${warning.type}-${index}`}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 8,
                            background: warning.severity === 'strong' ? '#FEF2F2' : '#FFF7ED',
                            border: `1px solid ${warning.severity === 'strong' ? '#FECACA' : '#FED7AA'}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: warning.severity === 'strong' ? '#991B1B' : '#9A3412',
                            }}
                          >
                            {warning.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--dark)', marginTop: 4, lineHeight: 1.5 }}>
                            {warning.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.unassignedColumns.length === 0 && review.assignmentIssues.length === 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: '1px solid #BBF7D0',
                background: '#ECFDF3',
                color: '#166534',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              No staffing issues were found for this schedule date. All columns with scheduled work are assigned, and the current assignments passed availability, preference, and skill checks.
            </div>
          )}
        </div>
      )}

      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        {!isLoading && <Btn onClick={onContinue} variant="primary">Continue to Post</Btn>}
      </ModalFooter>
    </Modal>
  );
}
