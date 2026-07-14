import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, GraduationCap, Building2, Calendar,
  Phone, MapPin, Check, ChevronRight, ChevronLeft,
  User, Mail, ArrowRight, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// ── Step indicator ────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['School Info', 'Admin Account'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done   ? 'bg-[#0a2156] border-[#0a2156] text-white'
                : active ? 'bg-white border-[#0a2156] text-[#0a2156]'
                :          'bg-white border-gray-200 text-gray-400'}`}>
                {done ? <Check className="w-4 h-4"/> : i + 1}
              </div>
              <span className={`text-[11px] font-semibold whitespace-nowrap
                ${active ? 'text-[#0a2156]' : done ? 'text-blue-400' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-2 transition-colors ${i < current ? 'bg-[#0a2156]' : 'bg-gray-200'}`}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Input wrapper ─────────────────────────────────────────────
function Field({ label, icon: Icon, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10"/>}
        <div className={Icon ? '[&>input]:pl-10 [&>select]:pl-10' : ''}>{children}</div>
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step,       setStep]       = useState(0);
  const [emailSent,  setEmailSent]  = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [loading,    setLoading]    = useState(false);

  const [form, setForm] = useState({
    school_name: '', active_year: String(new Date().getFullYear()),
    school_phone: '', school_address: '',
    admin_name: '', email: '', password: '', confirm_password: '',
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const pwStrength = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6)  s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    return s;
  };
  const strength = pwStrength(form.password);
  const strengthLabel = ['Too short','Weak','Fair','Good','Strong'][strength];
  const strengthColor = ['bg-gray-200','bg-red-400','bg-amber-400','bg-blue-400','bg-emerald-500'][strength];

  const validate0 = () => {
    if (!form.school_name.trim()) { toast.error('Enter school name'); return false; }
    return true;
  };
  const validate1 = () => {
    if (!form.admin_name.trim())  { toast.error('Enter your full name'); return false; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Enter a valid email'); return false;
    }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  const handleNext = () => { if (step === 0 && validate0()) setStep(1); };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate1()) return;
    setLoading(true);
    try {
      await register(form.email, form.password, form.school_name, form.active_year);
      setStep(2);
    } catch (err) {
      if (err.message === 'CHECK_EMAIL') { setEmailSent(true); return; }
      const msg = err.message?.includes('already')
        ? 'Email already registered — sign in instead.'
        : err.message || 'Registration failed';
      toast.error(msg, { duration: 5000 });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex">

        {/* ── Left: Brand panel ─────────────────────────── */}
        <div className="hidden md:flex flex-col w-[42%] bg-[#0a2156] p-10 relative overflow-hidden">
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

          {/* Content */}
          <div className="relative z-10 flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-blue-400/15 border border-blue-400/20 rounded-full px-3 py-1.5 mb-6 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-blue-300"/>
              <span className="text-blue-200 text-xs font-semibold">Free to get started</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Set up your<br/>
              <span className="text-blue-300">school</span> in minutes
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-8">
              One account for your entire school. Create staff accounts, manage students, and generate reports.
            </p>
            <div className="space-y-3.5">
              {[
                ['2 minutes','to set up your school account'],
                ['5 roles',  'Admin, DoS, Teacher, Secretary, Finance'],
                ['PDF & Excel','report cards generated automatically'],
              ].map(([bold, rest]) => (
                <div key={bold} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-blue-300"/>
                  </div>
                  <span className="text-blue-100 text-sm">
                    <span className="font-bold text-white">{bold}</span> {rest}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-blue-400 text-[11px]">
            © {new Date().getFullYear()} SchoolMS · Secure &amp; private
          </p>
        </div>

        {/* ── Right: Form ───────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-10 overflow-y-auto">

          {/* Mobile brand */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#0a2156] rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-gray-900">SchoolMS</span>
          </div>

          {/* Email confirmation state */}
          {emailSent && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-blue-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm your email</h2>
              <p className="text-gray-500 text-sm mb-1">Check your inbox at</p>
              <p className="font-bold text-gray-800 mb-6">{form.email}</p>
              <p className="text-gray-400 text-xs mb-6">Click the confirmation link, then sign in.</p>
              <Link to="/login"
                className="inline-flex items-center gap-2 bg-[#0a2156] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0c2a6a] transition-colors">
                Go to Sign In <ArrowRight className="w-4 h-4"/>
              </Link>
            </div>
          )}

          {/* STEP 0: School Info */}
          {!emailSent && step === 0 && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create School Account</h1>
                <p className="text-gray-400 text-sm mt-1">Tell us about your school first</p>
              </div>
              <Steps current={0}/>
              <div className="space-y-4">
                <Field label="School Name *" icon={Building2}>
                  <input className={INPUT} placeholder="e.g. GREEN HILLS ACADEMY"
                    value={form.school_name} onChange={set('school_name')} autoFocus/>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Academic Year *" icon={Calendar}>
                    <input type="number" className={INPUT} min="2020" max="2099"
                      value={form.active_year} onChange={set('active_year')}/>
                  </Field>
                  <Field label="School Phone" icon={Phone}>
                    <input className={INPUT} placeholder="0788 000 000"
                      value={form.school_phone} onChange={set('school_phone')}/>
                  </Field>
                </div>
                <Field label="Location" icon={MapPin}>
                  <input className={INPUT} placeholder="e.g. Kigali, Gasabo"
                    value={form.school_address} onChange={set('school_address')}/>
                </Field>

                {/* Preview */}
                {form.school_name && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Preview</p>
                    <p className="font-bold text-gray-900 uppercase text-sm truncate">{form.school_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Year {form.active_year}{form.school_address ? ` · ${form.school_address}` : ''}
                    </p>
                  </div>
                )}

                <button onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 bg-[#0a2156] hover:bg-[#0c2a6a] text-white font-bold py-3.5 rounded-xl transition-colors text-sm mt-2">
                  Next: Admin Account <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </>
          )}

          {/* STEP 1: Admin Account */}
          {!emailSent && step === 1 && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Your Admin Account</h1>
                <p className="text-gray-400 text-sm mt-1">You will be the school administrator</p>
              </div>
              <Steps current={1}/>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Your Full Name *" icon={User}>
                  <input className={INPUT} placeholder="e.g. Jean Paul Manzi"
                    value={form.admin_name} onChange={set('admin_name')} autoFocus autoCapitalize="words"/>
                </Field>
                <Field label="Email Address *" icon={Mail}>
                  <input type="email" className={INPUT} placeholder="admin@school.com"
                    value={form.email} onChange={set('email')} autoComplete="email"/>
                </Field>
                <Field label="Password *">
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className={`${INPUT} pr-11`}
                      placeholder="Min 6 characters"
                      value={form.password} onChange={set('password')} autoComplete="new-password"/>
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors
                            ${strength >= i ? strengthColor : 'bg-gray-200'}`}/>
                        ))}
                      </div>
                      <p className={`text-[11px] font-semibold
                        ${strength <= 1 ? 'text-red-500' : strength <= 2 ? 'text-amber-500' : strength <= 3 ? 'text-blue-500' : 'text-emerald-500'}`}>
                        {strengthLabel}
                      </p>
                    </div>
                  )}
                </Field>
                <Field label="Confirm Password *">
                  <div className="relative">
                    <input type={showConf ? 'text' : 'password'} className={`${INPUT} pr-11`}
                      placeholder="Repeat password"
                      value={form.confirm_password} onChange={set('confirm_password')} autoComplete="new-password"/>
                    <button type="button" onClick={() => setShowConf(!showConf)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConf ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                    </button>
                  </div>
                  {form.confirm_password && (
                    <p className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1
                      ${form.password === form.confirm_password ? 'text-emerald-600' : 'text-red-500'}`}>
                      {form.password === form.confirm_password
                        ? <><Check className="w-3 h-3"/> Passwords match</>
                        : '✗ Passwords do not match'}
                    </p>
                  )}
                </Field>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)}
                    className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-colors">
                    <ChevronLeft className="w-4 h-4"/> Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0a2156] hover:bg-[#0c2a6a] text-white font-bold py-3.5 rounded-xl transition-colors text-sm">
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Creating…</>
                      : 'Create Account'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* STEP 2: Success */}
          {!emailSent && step === 2 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600"/>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Account Created!</h2>
              <p className="text-gray-500 text-sm mb-6">
                <strong>{form.school_name}</strong> is ready to use.
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-5 text-left space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">What was set up</p>
                {[
                  `School: ${form.school_name}`,
                  `Admin: ${form.admin_name || form.email}`,
                  `Academic Year: ${form.active_year}`,
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-emerald-600"/>
                    </div>
                    <span className="text-gray-700">{t}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6 text-left">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2.5">Next steps</p>
                {[
                  'Go to Settings → upload logo & signature',
                  'Create classes in Classes & Years',
                  'Register students',
                  'Create staff accounts (teachers, secretary, finance)',
                ].map((t, i) => (
                  <p key={i} className="text-sm text-blue-800 py-0.5">
                    <span className="font-bold text-blue-500 mr-1">{i+1}.</span>{t}
                  </p>
                ))}
              </div>
              <button onClick={() => navigate('/sms/dashboard')}
                className="w-full flex items-center justify-center gap-2 bg-[#0a2156] hover:bg-[#0c2a6a] text-white font-bold py-3.5 rounded-xl transition-colors text-sm">
                Go to Dashboard <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          )}

          {/* Sign in link */}
          {step < 2 && !emailSent && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-[#0a2156] font-bold hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
