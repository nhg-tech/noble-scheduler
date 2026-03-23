import { useAuth } from '../../context/AuthContext';
import LoginPage from './LoginPage';

/**
 * Shows a loading spinner while auth is being checked,
 * LoginPage if not authenticated, or children if authenticated.
 */
export default function AuthGate({ children }) {
  const { user, authChecked } = useAuth();

  // Brief flash while token is being validated
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--purple-pale)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🐾</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--purple)', fontSize: 14 }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return children;
}
