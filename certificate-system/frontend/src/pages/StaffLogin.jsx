import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Award, Eye, EyeOff, LogIn, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://photographicsoftware-1.onrender.com/api'
    : '/api'
);
export default function StaffLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/staff-auth/login`, form);
      const { token, staff, school } = res.data;

      // Save to localStorage (used by StaffAuthContext + role dashboards)
      localStorage.setItem('staff_token',  token);
      localStorage.setItem('staff_data',   JSON.stringify(staff));
      localStorage.setItem('staff_school', JSON.stringify(school));

      toast.success(`Welcome, ${staff.full_name}!`);

      // All staff go to /sms/dashboard which routes by role
      navigate('/sms/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)' }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
            <Award className="w-6 h-6 text-blue-900" />
          </div>
          <span className="text-white font-bold text-lg">SchoolMS</span>
        </div>
        <div className="relative z-10">
          <div className="w-16 h-16 bg-yellow-400/20 border border-yellow-400/40 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-4">Staff Portal</h1>
          <p className="text-blue-200 text-lg mb-8">Sign in with your staff username and password provided by the school administrator.</p>
          <div className="space-y-3">
            {[['Teacher','Enter marks for your subjects'],['Secretary','Register students & print bulletins'],['Finance','Manage fees & payments'],['Director of Studies','Manage classes & promotions']].map(([r,d])=>(
              <div key={r} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 shrink-0"/>
                <div><p className="text-white font-semibold text-sm">{r}</p><p className="text-blue-300 text-xs">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-blue-400 text-xs">Contact your school admin for login credentials</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-gray-50">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-yellow-400" />
          </div>
          <span className="font-bold text-lg text-gray-900">SchoolMS Staff</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900">Staff Sign In</h2>
            <p className="text-gray-500 text-sm mt-1">Use your staff username and password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <input className="input-field" placeholder="e.g. jmanzi or teacher001"
                value={form.username} onChange={f('username')} autoFocus autoCapitalize="none" autoComplete="username"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass?'text':'password'} className="input-field pr-10"
                  placeholder="••••••••" value={form.password} onChange={f('password')} autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Signing in...</>
                : <><LogIn className="w-4 h-4"/> Sign In</>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2">
            <p className="text-sm text-gray-500">School admin?{' '}<Link to="/login" className="text-blue-600 font-semibold hover:underline">Admin Login →</Link></p>
          </div>
        </div>
        <p className="mt-10 text-xs text-gray-400 text-center">© {new Date().getFullYear()} SchoolMS</p>
      </div>
    </div>
  );
}
