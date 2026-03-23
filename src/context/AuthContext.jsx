import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister, apiLogout, apiGetMe, isLoggedIn, getToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);
  const [authChecked,  setAuthChecked]  = useState(false); // true once initial check done
  const [authError,    setAuthError]    = useState(null);

  // On mount — validate any stored token
  useEffect(() => {
    if (!isLoggedIn()) {
      setAuthChecked(true);
      return;
    }
    apiGetMe()
      .then(me => { setUser(me); setAuthChecked(true); })
      .catch(() => { setUser(null); setAuthChecked(true); });
  }, []);

  // Listen for 401 events emitted by api.js
  useEffect(() => {
    function handle() { setUser(null); }
    window.addEventListener('noble:unauthorized', handle);
    return () => window.removeEventListener('noble:unauthorized', handle);
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      const me = await apiLogin(email, password);
      setUser(me);
      return me;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (email, password, name, role) => {
    setAuthError(null);
    try {
      const me = await apiRegister(email, password, name, role);
      setUser(me);
      return me;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authChecked, authError, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
