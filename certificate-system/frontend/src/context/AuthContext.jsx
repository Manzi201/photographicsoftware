import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true); // checking stored session

  // Restore session from localStorage on startup
  useEffect(() => {
    const token = localStorage.getItem('cert_token');
    const stored = localStorage.getItem('cert_user');
    const storedSchool = localStorage.getItem('cert_school');
    if (token && stored) {
      setUser(JSON.parse(stored));
      setSchool(storedSchool ? JSON.parse(storedSchool) : null);
      // Set default auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token is still valid
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          setSchool(res.data.school);
          localStorage.setItem('cert_school', JSON.stringify(res.data.school));
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, refresh_token, user: u, school: s } = res.data;
    localStorage.setItem('cert_token', token);
    localStorage.setItem('cert_refresh', refresh_token);
    localStorage.setItem('cert_user', JSON.stringify(u));
    localStorage.setItem('cert_school', JSON.stringify(s));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(u);
    setSchool(s);
  }, []);

  const register = useCallback(async (email, password, school_name, active_year) => {
    await api.post('/auth/register', { email, password, school_name, active_year });
    // Auto-login after register
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('cert_token');
    localStorage.removeItem('cert_refresh');
    localStorage.removeItem('cert_user');
    localStorage.removeItem('cert_school');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setSchool(null);
  }, []);

  const refreshSchool = useCallback(async () => {
    const res = await api.get('/auth/me');
    setSchool(res.data.school);
    localStorage.setItem('cert_school', JSON.stringify(res.data.school));
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
