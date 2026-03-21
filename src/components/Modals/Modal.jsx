// Shared modal wrapper
export default function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(26,26,46,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(62,42,126,0.18)',
          width,
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--gray-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--purple)',
          }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 18,
              cursor: 'pointer', color: 'var(--gray)', lineHeight: 1,
              padding: '2px 6px', borderRadius: 4,
            }}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalFooter({ children }) {
  return (
    <div style={{
      padding: '12px 20px',
      borderTop: '1px solid var(--gray-light)',
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = 'secondary', disabled }) {
  const styles = {
    primary: { background: 'var(--purple)', color: '#fff', border: 'none' },
    danger:  { background: '#FF5252', color: '#fff', border: 'none' },
    secondary: { background: 'var(--gray-light)', color: 'var(--dark)', border: 'none' },
    gold: { background: 'var(--gold)', color: 'var(--purple)', border: 'none' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 18px',
        borderRadius: 7,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        ...styles[variant],
      }}
    >{children}</button>
  );
}
