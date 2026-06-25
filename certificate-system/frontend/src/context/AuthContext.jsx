import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import api from '../api';

const AuthContext = createContext(null);

// ── Helpers ────────────────────────────────────────────────────
function saveLocal(token, refresh, user, school) {
  localStorage.setItem('cert_token',   token);
  localStorage.setItem('cert_refresh', refresh);
  localStorage.setItem('cert_user',    JSON.stringify(user));
  localStorage.setItem('cert_school',  JSON.stringify(school));
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function clearLocal() {
  ['cert_token','cert_refresh','cert_user','cert_school'].forEach(k => localStorage.removeItem(k));
  delete api.defaults.headers.common['Authorization'];
}

// Create / fetch school row for a user
async function ensureSchool(userId, meta = {}) {
  // Try to fetch existing
  let { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!school) {
    // Create it
    const { data: newSchool, error } = await supabase.from('schools').insert([{
      user_id:        userId,
      school_name:    meta.school_name || 'My School',
      signatory_name: 'Head Teacher',
      active_year:    meta.active_year || String(new Date().getFullYear()),
      bg_preset:      'none',
    }]).select().single();
    if (error) console.error('ensureSchool error:', error.message);
    school = newSchool;
  }
  return school;
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [school,  setSchool]  = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount ────────────────────────────────
  useEffect(() => {
    // Listen to Supabase auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email };
          const s = await ensureSchool(session.user.id, session.user.user_metadata);
          saveLocal(session.access_token, session.refresh_token, u, s);
          setUser(u);
          setSchool(s);
        } else if (event === 'SIGNED_OUT') {
          clearLocal();
          setUser(null);
          setSchool(null);
        }
        setLoading(false);
      }
    );

    // Also try to restore from storage immediately
    const token = localStorage.getItem('cert_token');
    const storedUser = localStorage.getItem('cert_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      const storedSchool = localStorage.getItem('cert_school');
      if (storedSchool) setSchool(JSON.parse(storedSchool));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      setLoading(false);
    }

    return () => subscription.unsubscribe();
  }, []);

  // ── Register ─────────────────────────────────────────────────
  const register = useCallback(async (email, password, school_name, active_year) => {
    const { data, error } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
      options: {
        data: { school_name: school_name.trim(), active_year: active_year || String(new Date().getFullYear()) },
        emailRedirectTo: undefined,
      },
    });

    if (error) throw new Error(error.message);

    const session = data.session;
    if (!session) {
      // Email confirmation required
      throw new Error('CHECK_EMAIL');
    }

    const u = { id: data.user.id, email: data.user.email };
    // Wait a moment for trigger to fire
    await new Promise(r => setTimeout(r, 1000));
    const s = await ensureSchool(data.user.id, { school_name, active_year });

    saveLocal(session.access_token, session.refresh_token, u, s);
    setUser(u);
    setSchool(s);
    return { user: u, school: s };
  }, []);

  // ── Login ─────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    });

    if (error) throw new Error('Invalid email or password');

    const u = { id: data.user.id, email: data.user.email };
    const s = await ensureSchool(data.user.id, data.user.user_metadata);

    saveLocal(data.session.access_token, data.session.refresh_token, u, s);
    setUser(u);
    setSchool(s);
    return { user: u, school: s };
  }, []);

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearLocal();
    setUser(null);
    setSchool(null);
  }, []);

  // ── Refresh school ────────────────────────────────────────────
  const refreshSchool = useCallback(async () => {
    if (!user) return;
    const { data: s } = await supabase.from('schools').select('*').eq('user_id', user.id).single();
    if (s) {
      setSchool(s);
      localStorage.setItem('cert_school', JSON.stringify(s));
    }
    return s;
  }, [user]);

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
