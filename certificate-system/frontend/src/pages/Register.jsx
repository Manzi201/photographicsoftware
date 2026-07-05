import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, FileText, Award, Building2, Calendar, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function StepBar({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current, active = i === current;
        return (
          <React.Fragment key={i}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all
              ${done ? 'bg-blue-600 border-blue-600 text-white'
              : active ? 'bg-white border-blue-600 text-blue-600 scale-110 shadow'
              : 'bg-white border-gray-200 text-gray-400'}`}>
              {done ? <Check className="w-4 h-4"/> : i + 1}
            </div>
            {i < total - 1 && <div className={`h-0.5 w-8 rounded ${done ? 'bg-blue-500' : 'bg-gray-200'}`}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [form, setForm] = useState({
    school_name: '', active_year: String(new Date().getFullYear()),
    email: '', password: '', confirm_password: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const validateStep0 = () => {
    if (!form.school_name.trim()) { toast.error('Enter school name'); return false; }
    return true;
  };
  const validateStep1 = () => {
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter valid email'); return false; }
    if (form.password.length < 6) { toast.error('Password min 6 characters'); return false; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    try {
      await register(form.email, form.password, form.school_name, form.active_year);
      setStep(2);
    } catch (err) {
      if (err.message === 'CHECK_EMAIL') { setEmailSent(true); return; }
      const msg = err.message?.includes('already') ? 'Email already registered. Sign in instead.' : err.message || 'Registration failed';
      toast.error(msg, { duration: 5000 });
    } finally { setLoading(false); }
  };

  const defaultUsername = form.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT HERO ───────────────────────────────────── */}
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
          {/* Bulletin preview */}
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

      {/* ── RIGHT FORM ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 bg-gray-50 min-h-screen lg:min-h-0">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          <span className="font-bold text-lg text-gray-900">SchoolMS</span>
        </div>

        <div className="w-full max-w-sm">

          {/* Email confirmation screen */}
          {emailSent && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-blue-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-6">We sent a confirmation link to <strong>{form.email}</strong></p>
              <Link to="/login" className="btn-primary w-full justify-center py-3 flex items-center gap-2">Go to Sign In →</Link>
            </div>
          )}

          {/* Step 0 — School Info */}
          {!emailSent && step === 0 && (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
                <p className="text-gray-500 text-sm mt-1">Set up your school management account</p>
              </div>
              <StepBar current={0} total={3}/>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">School Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9 font-semibold" placeholder="e.g. GREEN HILLS ACADEMY"
                      value={form.school_name} onChange={set('school_name')} autoFocus/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Year</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9" type="number" min="2020" max="2099"
                      value={form.active_year} onChange={set('active_year')}/>
                  </div>
                </div>
                {form.school_name && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs text-blue-600 font-medium">Certificate will show:</p>
                    <p className="font-bold text-blue-900 text-sm uppercase mt-0.5 truncate">{form.school_name}</p>
                    <p className="text-xs text-blue-500">Year {form.active_year}</p>
                  </div>
                )}
                <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl">
                  Continue <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </>
          )}

          {/* Step 1 — Credentials */}
          {!emailSent && step === 1 && (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
                <p className="text-gray-500 text-sm mt-1">Set up your login credentials</p>
              </div>
              <StepBar current={1} total={3}/>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                  <input type="email" className="input-field" placeholder="admin@school.com"
                    value={form.email} onChange={set('email')} autoFocus autoComplete="email"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                  <div className="relative">
                    <input type={showPass?'text':'password'} className="input-field pr-10" placeholder="Min 6 characters"
                      value={form.password} onChange={set('password')} autoComplete="new-password"/>
                    <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>}
                    </button>
                  </div>
                  {form.password && (
                    <div className="flex gap-1 mt-1.5">
                      {[1,2,3,4].map(i=>(
                        <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length>=i*3
                          ?i<=1?'bg-red-400':i<=2?'bg-amber-400':i<=3?'bg-blue-400':'bg-green-500':'bg-gray-200'}`}/>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
                  <div className="relative">
                    <input type={showConfirm?'text':'password'} className="input-field pr-10" placeholder="Repeat password"
                      value={form.confirm_password} onChange={set('confirm_password')} autoComplete="new-password"/>
                    <button type="button" onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showConfirm?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>}
                    </button>
                  </div>
                  {form.confirm_password && (
                    <p className={`text-xs mt-1 ${form.password===form.confirm_password?'text-green-600':'text-red-500'}`}>
                      {form.password===form.confirm_password?'✓ Passwords match':'✗ Do not match'}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500 space-y-0.5">
                  <p>🏫 <span className="font-medium text-gray-700">{form.school_name}</span></p>
                  <p>📅 Year <span className="font-medium text-gray-700">{form.active_year}</span></p>
                  <p>📧 <span className="text-gray-700">{form.email||'—'}</span></p>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>setStep(0)} className="btn-secondary px-4 py-3 flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4"/> Back
                  </button>
                  <button onClick={handleSubmit} disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl">
                    {loading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Creating...</>:'Create Account'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Success */}
          {!emailSent && step === 2 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Account Created!</h2>
              <p className="text-gray-500 text-sm mb-6">Welcome to SchoolMS — <strong>{form.school_name}</strong></p>

              {/* Staff credentials */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-left">
                <p className="text-xs font-bold text-blue-700 uppercase mb-2">🔑 Your Staff Login</p>
                <p className="text-xs text-blue-600 mb-2">Use at <strong>/staff-login</strong>:</p>
                <div className="bg-white rounded-lg p-3 border border-blue-100 space-y-1">
                  <p className="text-sm"><span className="text-gray-400 text-xs">Username:</span> <span className="font-mono font-bold text-blue-900">{defaultUsername}</span></p>
                  <p className="text-sm"><span className="text-gray-400 text-xs">Password:</span> <span className="font-mono font-bold text-amber-700">admin123</span></p>
                  <p className="text-xs text-red-500 mt-1">⚠️ Change this after first login!</p>
                </div>
              </div>

              <div className="space-y-2">
                <button onClick={() => navigate('/sms/dashboard')}
                  className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl">
                  Go to Dashboard →
                </button>
                <Link to="/staff-login" className="block text-center text-sm text-blue-600 hover:underline mt-2">
                  Or sign in as Staff
                </Link>
              </div>
            </div>
          )}

          {step < 2 && !emailSent && (
            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-700 font-semibold hover:underline">Sign in</Link>
            </p>
          )}
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">© {new Date().getFullYear()} SchoolMS</p>
      </div>
    </div>
  );
}
