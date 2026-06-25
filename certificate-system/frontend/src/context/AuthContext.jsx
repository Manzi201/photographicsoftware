import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

// Helper: save session to localStorage
function saveSession(token, refresh, user, school) {
  localStorage.setItem('cert_token',   token);
  localStorage.setItem('cert_refresh', refresh);
  localStorage.setItem('cert_user',    JSON.stringify(user));
  localStorage.setItem('cert_school',  JSON.stringify(school));
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Helper: clear session
function clearSession() {
  ['cert_token', 'cert_refresh', 'cert_user', 'cert_school'].forEach((k) =>
    localStorage.removeItem(k)
  );
  delete api.defaults.headers.common['Authorization'];
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [school,  setSchool]  = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount ───────────────────────────────
  useEffect(() => {
    const token       = localStorage.getItem('cert_token');
    const storedUser  = localStorage.getItem('cert_user');
    const storedSchool= localStorage.getItem('cert_school');

    if (token && storedUser) {
      // Optimistically restore from storage
      setUser(JSON.parse(storedUser));
      setSchool(storedSchool ? JSON.parse(storedSchool) : null);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Verify token is still valid with server
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          setSchool(res.data.school);
          localStorage.setItem('cert_school', JSON.stringify(res.data.school));
        })
        .catch(() => {
          clearSession();
          setUser(null);
          setSchool(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', {
      email:    email.trim().toLowerCase(),
      password,
    });
    const { token, refresh_token, user: u, school: s } = res.data;
    saveSession(token, refresh_token, u, s);
    setUser(u);
    setSchool(s);
    return { user: u, school: s };
  }, []);

  // ── Register then auto-login ───────────────────────────────
  const register = useCallback(async (email, password, school_name, active_year) => {
    // Step 1: create the account
    const regRes = await api.post('/auth/register', {
      email:       email.trim().toLowerCase(),
      password,
      school_name: school_name.trim(),
      active_year: active_year || String(new Date().getFullYear()),
    });

    if (!regRes.data.success) {
      throw new Error(regRes.data.error || 'Registration failed');
    }

    // Step 2: small delay so DB trigger has time to fire
    await new Promise((r) => setTimeout(r, 800));

    // Step 3: auto-login
    const result = await login(email, password);
    return result;
  }, [login]);

  // ── Logout ─────────────────────────────────────────────────
  const logout = useCallback(() => {
    // Fire-and-forget logout call to backend
    api.post('/auth/logout').catch(() => {});
    clearSession();
    setUser(null);
    setSchool(null);
  }, []);

  // ── Refresh school data (after settings update) ───────────
  const refreshSchool = useCallback(async () => {
    const res = await api.get('/auth/me');
    setSchool(res.data.school);
    localStorage.setItem('cert_school', JSON.stringify(res.data.school));
    return res.data.school;
  }, []);

  return (
    <AuthContext.Provider value={{ user, school, loading, login, register, logout, refreshSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
