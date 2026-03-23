import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login, register, authError } = useAuth();
  const [mode,     setMode]     = useState('login');   // 'login' | 'register'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [role,     setRole]     = useState('gm');
  const [loading,  setLoading]  = useState(false);
  const [localErr, setLocalErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalErr('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) { setLocalErr('Name is required'); setLoading(false); return; }
        await register(email, password, name, role);
      }
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

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden',
          border: '1.5px solid var(--gray-light)', marginBottom: 24 }}>
          {['login','register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setLocalErr(''); }}
              style={{
                flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                background: mode === m ? 'var(--purple)' : '#fff',
                color: mode === m ? '#fff' : 'var(--gray)',
                transition: 'all 0.15s',
              }}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <label style={lbl}>Full Name</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Jane Smith" autoComplete="name" />
            </div>
          )}

          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@noblepetresort.com" autoComplete="email" />
          </div>

          <div>
            <label style={lbl}>Password</label>
            <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>

          {mode === 'register' && (
            <div>
              <label style={lbl}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                style={{ ...inp, marginTop: 4, appearance: 'none' }}>
                <option value="owner">Owner</option>
                <option value="gm">General Manager</option>
                <option value="tl">Team Lead</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          )}

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
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
