import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// ⚠️ Change this to your backend URL
// In development: your computer's local IP (not localhost!)
// e.g. 'http://192.168.1.100:5000/api'
export const API_URL = 'http://192.168.1.100:5000/api';

const api = axios.create({ baseURL: API_URL });

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const token = await AsyncStorage.getItem('cert_token');
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setSchool(res.data.school);
    } catch {
      await clearSession();
    } finally {
      setLoading(false);
    }
  }

  async function clearSession() {
    await AsyncStorage.multiRemove(['cert_token', 'cert_refresh']);
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setSchool(null);
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { token, refresh_token, user: u, school: s } = res.data;
    await AsyncStorage.setItem('cert_token', token);
    await AsyncStorage.setItem('cert_refresh', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(u);
    setSchool(s);
    return s;
  }

  async function logout() {
    await clearSession();
  }

  // Refresh school data (e.g. after settings update)
  async function refreshSchool() {
    const res = await api.get('/auth/me');
    setSchool(res.data.school);
  }

  return (
    <AuthContext.Provider value={{ user, school, loading, api, login, logout, refreshSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
