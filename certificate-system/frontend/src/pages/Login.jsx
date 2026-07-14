import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, GraduationCap, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://photographicsoftware-1.onrender.com/api' : '/api'
);

export default function Login() {
  const { login } = useAuth();
  const [form,     setForm]     = useState({ identifier: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      // School admin via Supabase (email)
      if (form.identifier.includes('@')) {
        try {
          await login(form.identifier, form.password);
          toast.success('Welcome!');
          window.location.href = '/sms/dashboard';
          return;
        } catch {
          toast.error('Invalid email or password');
          return;
        }
      }
      // Staff login (Staff ID)
      try {
        const res = await axios.post(`${API_BASE}/staff-auth/login`,
          { username: form.identifier, password: form.password },
          { timeout: 45000 }
        );
        const { token, staff, school } = res.data;
        localStorage.setItem('staff_token',  token);
        localStorage.setItem('staff_data',   JSON.stringify(staff));
        localStorage.setItem('staff_school', JSON.stringify(school));
        toast.success(`Welcome, ${staff.full_name}!`);
        window.location.href = '/sms/dashboard';
        return;
      } catch (staffErr) {
        if (staffErr.code === 'ECONNABORTED') {
          toast.error('Server is starting up, please wait 30s and retry.', { duration: 6000 });
          return;
        }
        const msg = staffErr.response?.data?.error;
        toast.error(msg || 'Invalid username or password');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex min-h-[580px]">

        {/* ── Left: Brand panel ─────────────────────────── */}
        <div className="hidden md:flex flex-col w-[44%] bg-[#0a2156] p-10 relative overflow-hidden">
          {/* Decorative */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-500/10"/>
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-indigo-500/10"/>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
              <GraduationCap className="w-5 h-5 text-white"/>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-none">SchoolMS</p>
              <p className="text-blue-300 text-[11px]">School Management System</p>
            </div>
          </div>

          {/* Main text */}
          <div className="relative z-10 flex-1 flex flex-col justify-center">
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Manage your<br/>
              <span className="text-blue-300">school</span> smarter
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-8">
              Students, marks, report cards, staff and fees — all in one place.
            </p>
            <div className="space-y-3">
              {[
                'Student registration & profiles',
                'Term & annual report cards (PDF)',
                'Marks entry per subject',
                'Fee tracking & reminders',
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-400/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-300 text-[10px]">✓</span>
                  </div>
                  <span className="text-blue-100 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="relative z-10 text-blue-400 text-[11px]">
            © {new Date().getFullYear()} SchoolMS · Secure & private
          </p>
        </div>

        {/* ── Right: Login form ─────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-12">

          {/* Mobile brand */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#0a2156] rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-gray-900">SchoolMS</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to your school account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Email or Staff ID
              </label>
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all"
                placeholder="admin@school.com  or  ELA/TCH/638Z"
                value={form.identifier} onChange={f('identifier')}
                autoFocus autoComplete="username" autoCapitalize="none"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                School admin → use email &nbsp;·&nbsp; Staff → use your Staff ID
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                <Link to="/forgot-password" className="text-xs text-[#0a2156] hover:underline font-semibold">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm font-medium text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all"
                  placeholder="••••••••"
                  value={form.password} onChange={f('password')}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0a2156] hover:bg-[#0c2a6a] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm text-sm">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Signing in…</>
                : <><LogIn className="w-4 h-4"/> Sign In</>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
            New school?{' '}
            <Link to="/register" className="text-[#0a2156] font-bold hover:underline">
              Create an account <ArrowRight className="inline w-3.5 h-3.5"/>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
