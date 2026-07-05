import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, GraduationCap, Shield, FileText, Award, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://photographicsoftware-1.onrender.com/api' : '/api'
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
      localStorage.setItem('staff_token',  token);
      localStorage.setItem('staff_data',   JSON.stringify(staff));
      localStorage.setItem('staff_school', JSON.stringify(school));
      toast.success(`Welcome, ${staff.full_name}!`);
      navigate('/sms/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid credentials';
      if (err.code === 'ECONNABORTED') toast.error('Server is starting, please wait 30s and retry.');
      else toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT HERO ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(145deg, #1a56db 0%, #1e40af 60%, #1d4ed8 100%)' }}>
        <div className="absolute top-10 right-10 w-48 h-48 rounded-full opacity-10" style={{ background:'rgba(255,255,255,0.3)' }}/>
        <div className="absolute bottom-20 left-8 w-32 h-32 rounded-full opacity-10" style={{ background:'rgba(255,255,255,0.2)' }}/>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <GraduationCap className="w-6 h-6 text-blue-600"/>
          </div>
          <span className="text-white font-bold text-xl">SchoolMS</span>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-64 rotate-[-1deg]">
            <div className="text-center border-b border-gray-100 pb-2 mb-3">
              <p className="font-bold text-gray-900 text-xs uppercase">REPORT CARD</p>
              <p className="text-xs text-gray-500 mt-0.5">GOOD SCHOOL NAME · MAHORO Alice</p>
            </div>
            <table className="w-full text-xs mb-3">
              <thead><tr className="text-gray-400"><th className="text-left">Subject</th><th>T1</th><th>T2</th><th>T3</th></tr></thead>
              <tbody>
                {[['Reading','A','A','A'],['Language','B','F','B'],['Science','D','D','E']].map(([s,...g])=>(
                  <tr key={s} className="border-t border-gray-50">
                    <td className="py-0.5 pr-1 text-gray-700">{s}</td>
                    {g.map((v,i)=><td key={i} className="text-center font-bold text-blue-700">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Score: <b>89%</b></p>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">PASS</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow px-4 py-2.5 flex items-center gap-3 self-start ml-8">
            <Award className="w-5 h-5 text-green-600"/>
            <div><p className="text-xs font-bold text-gray-900">MAHORO</p><p className="text-xs text-gray-500">1st · 89%</p></div>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-white text-2xl font-bold mb-2">Transform Assessment Management</h2>
          <p className="text-blue-100 text-sm leading-relaxed">Record marks, generate report cards, and manage assessments — convenient, accurate, and teacher-friendly.</p>
        </div>
      </div>

      {/* ── RIGHT FORM ─────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 bg-gray-50 min-h-screen lg:min-h-0">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          <span className="font-bold text-lg text-gray-900">SchoolMS</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Staff Sign In</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in with your staff credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input className="input-field pl-9" placeholder="e.g. jmanzi or teacher001"
                  value={form.username} onChange={f('username')} autoFocus autoCapitalize="none" autoComplete="username"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass?'text':'password'} className="input-field pr-10"
                  placeholder="••••••••" value={form.password} onChange={f('password')} autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            {/* Role info */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Staff roles:</p>
              <div className="grid grid-cols-2 gap-1">
                {[['Admin','Full access'],['DoS','Classes & marks'],['Teacher','Enter marks'],['Secretary','Students & certs'],['Finance','Fees & payments']].map(([r,d])=>(
                  <div key={r} className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{r}:</span> {d}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Signing in...</>
                :<><LogIn className="w-4 h-4"/> Sign In</>}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500 space-y-1">
            <p>School admin?{' '}<Link to="/login" className="text-blue-700 font-semibold hover:underline">Admin Login →</Link></p>
            <p>No account?{' '}<Link to="/register" className="text-blue-700 font-semibold hover:underline">Create Account →</Link></p>
          </div>
        </div>
        <p className="mt-10 text-xs text-gray-400">© {new Date().getFullYear()} SchoolMS</p>
      </div>
    </div>
  );
}
