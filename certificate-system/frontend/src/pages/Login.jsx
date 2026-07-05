import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, GraduationCap, User, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AuthHero from '../components/AuthHero';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://photographicsoftware-1.onrender.com/api' : '/api'
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) { toast.error('Fill in all fields'); return; }
    setLoading(true);

    try {
      // ── Try 1: School admin via Supabase (email + password) ──
      if (form.identifier.includes('@')) {
        try {
          await login(form.identifier, form.password);
          toast.success('Welcome!');
          navigate('/sms/dashboard');
          return;
        } catch {}
      }

      // ── Try 2: Staff login (username or email + password) ──
      try {
        const res = await axios.post(`${API_BASE}/staff-auth/login`, {
          username: form.identifier,
          password: form.password,
        }, { timeout: 45000 });
        const { token, staff, school } = res.data;
        localStorage.setItem('staff_token',  token);
        localStorage.setItem('staff_data',   JSON.stringify(staff));
        localStorage.setItem('staff_school', JSON.stringify(school));
        toast.success(`Welcome, ${staff.full_name}!`);
        navigate('/sms/dashboard');
        return;
      } catch (staffErr) {
        // If it was a timeout, inform user
        if (staffErr.code === 'ECONNABORTED') {
          toast.error('Server is starting up, please wait 30s and retry.', { duration: 6000 });
          return;
        }
      }

      // ── Both failed ──
      toast.error('Invalid username/email or password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <AuthHero />

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-white min-h-screen lg:min-h-0">

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          <span className="font-bold text-lg text-gray-900">SchoolMS</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="text-gray-500 text-sm mt-1">Use your email or staff username</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email or Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input className="input-field pl-9"
                  placeholder="admin@school.com or jmanzi"
                  value={form.identifier} onChange={f('identifier')}
                  autoFocus autoComplete="username" autoCapitalize="none"/>
              </div>
              <p className="text-xs text-gray-400 mt-1">School admin: use email · Staff: use username</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input type={showPass?'text':'password'} className="input-field pl-9 pr-10"
                  placeholder="••••••••" value={form.password} onChange={f('password')} autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Signing in...</>
                : <><LogIn className="w-4 h-4"/> Sign In</>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            No account? <Link to="/register" className="text-blue-700 font-semibold hover:underline">Create School Account</Link>
          </div>
        </div>

        <p className="mt-12 text-xs text-gray-400">© {new Date().getFullYear()} SchoolMS</p>
      </div>
    </div>
  );
}
