import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, GraduationCap, FileText, Users, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/sms/dashboard');
    } catch (err) {
      toast.error(err.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT HERO PANEL ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(145deg, #1a56db 0%, #1e40af 60%, #1d4ed8 100%)' }}>

        {/* Geometric shapes */}
        <div className="absolute top-10 right-10 w-48 h-48 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.3)' }}/>
        <div className="absolute bottom-20 left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.2)' }}/>
        <div className="absolute top-1/2 right-0 w-40 h-40 opacity-5 rotate-45" style={{ background: 'rgba(255,255,255,0.5)' }}/>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <GraduationCap className="w-6 h-6 text-blue-600" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SchoolMS</span>
        </div>

        {/* Report card preview */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Bulletin card mockup */}
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-64 rotate-[-2deg] mb-2">
            <div className="text-center border-b border-gray-100 pb-2 mb-3">
              <p className="font-bold text-gray-900 text-xs uppercase tracking-wide">REPORT CARD</p>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>GOOD SCHOOL NAME</span><span className="font-semibold text-gray-700">MAHORO Alice</span>
              </div>
              <p className="text-xs text-gray-400">Computer Science · Gender: F</p>
            </div>
            <table className="w-full text-xs mb-3">
              <thead><tr className="text-gray-400"><th className="text-left py-0.5">Subject</th><th>EU</th><th>EU</th><th>EU</th></tr></thead>
              <tbody className="text-gray-700">
                {[['Reading','A','A','A'],['Language','B','F','B'],['Science','D','D','E'],['G','A','A','A']].map(([s,...g])=>(
                  <tr key={s} className="border-t border-gray-50">
                    <td className="py-0.5 pr-2">{s}</td>
                    {g.map((v,i)=><td key={i} className="text-center font-bold text-blue-700">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Scored: <span className="font-bold text-gray-800">89%</span></p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">PASS</span>
            </div>
          </div>

          {/* Floating rank badge */}
          <div className="bg-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3 self-start -mt-4 ml-4">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
              <Award className="w-5 h-5 text-green-600"/>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">MAHORO</p>
              <p className="text-xs text-gray-500">is the 1st · Scored: 89%</p>
            </div>
          </div>

          {/* Print button mockup */}
          <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-2 self-end">
            <FileText className="w-4 h-4 text-white"/>
            <span className="text-white text-sm font-medium">Print report</span>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h2 className="text-white text-2xl font-bold mb-3">Transform Assessment Management</h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Record marks, generate report cards, and manage assessments — convenient, accurate, and teacher-friendly.
          </p>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 bg-gray-50 min-h-screen lg:min-h-0">

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">SchoolMS</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your school account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input type="email" className="input-field pl-9" placeholder="school@example.com"
                  value={form.email} onChange={f('email')} autoFocus autoComplete="email"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass?'text':'password'} className="input-field pr-10"
                  placeholder="••••••••" value={form.password} onChange={f('password')} autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Signing in...</>
                : <><LogIn className="w-4 h-4"/> Sign In</>}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-700 font-semibold hover:underline">Create Account</Link>
          </div>
          <div className="mt-3 text-center text-sm text-gray-500">
            Staff?{' '}
            <Link to="/staff-login" className="text-blue-700 font-semibold hover:underline">Staff Login →</Link>
          </div>
        </div>
        <p className="mt-10 text-xs text-gray-400">© {new Date().getFullYear()} SchoolMS</p>
      </div>
    </div>
  );
}
