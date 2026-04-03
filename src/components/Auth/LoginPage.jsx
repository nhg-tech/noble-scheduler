import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login, authError } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [localErr, setLocalErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalErr('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setLocalErr(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--gray-light)', fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", color: 'var(--dark)',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
    marginTop: 4,
  };
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--gray)',
    letterSpacing: '0.05em', textTransform: 'uppercase' };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--purple-pale)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 44px',
        boxShadow: '0 8px 40px rgba(62,42,126,0.15)', width: 400, maxWidth: '96vw',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'var(--purple)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 24,
          }}>🐾</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22,
            fontWeight: 700, color: 'var(--purple)' }}>Noble Task Scheduler</div>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 3 }}>Noble Pet Resort</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@noblepetresort.com" autoComplete="email" />
          </div>

          <div>
            <label style={lbl}>Password</label>
            <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" />
          </div>

          {(localErr || authError) && (
            <div style={{ fontSize: 12, color: '#e53935', background: '#FFEBEE',
              padding: '8px 12px', borderRadius: 6 }}>
              {localErr || authError}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: '11px', borderRadius: 8, border: 'none',
            background: loading ? 'var(--gray-light)' : 'var(--purple)',
            color: loading ? 'var(--gray)' : '#fff',
            fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
          }}>
            {loading ? 'Please wait…' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 16,
          fontSize: 12,
          color: 'var(--gray)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Accounts are created by an administrator. If you need access, please contact your admin.
        </div>
      </div>
    </div>
  );
}
