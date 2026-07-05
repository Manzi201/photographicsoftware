import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award, Eye, EyeOff, School, ChevronRight,
  ChevronLeft, Check, GraduationCap, Mail, Lock,
  Calendar, Building2, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// ── Step indicator ─────────────────────────────────────────────
function StepBar({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <React.Fragment key={i}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 border-2
              ${done   ? 'bg-green-500 border-green-500 text-white'
              : active ? 'bg-blue-700 border-blue-700 text-white scale-110 shadow-md'
              :          'bg-white border-gray-200 text-gray-400'}`}>
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < total - 1 && (
              <div className={`h-0.5 w-10 rounded transition-all duration-500 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Field component ────────────────────────────────────────────
function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [emailSent, setEmailSent] = useState(false); // email confirmation needed
  const [form, setForm] = useState({
    school_name: '',
    active_year: String(new Date().getFullYear()),
    email: '',
    password: '',
    confirm_password: '',
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // ── Step validation ─────────────────────────────────────────
  const validateStep0 = () => {
    if (!form.school_name.trim()) { toast.error('Enter your school name'); return false; }
    if (!form.active_year || isNaN(form.active_year)) { toast.error('Enter a valid year'); return false; }
    return true;
  };

  const validateStep1 = () => {
    if (!form.email.trim()) { toast.error('Enter your email address'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter a valid email address'); return false; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    try {
      await register(form.email, form.password, form.school_name, form.active_year);
      setStep(2); // success — logged in directly
    } catch (err) {
      if (err.message === 'CHECK_EMAIL') {
        // Supabase requires email confirmation
        setEmailSent(true);
        return;
      }
      const msg =
        err.message?.includes('already registered') || err.message?.includes('already been registered')
          ? 'An account with this email already exists. Please sign in instead.'
          : err.message || 'Registration failed. Please try again.';
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  // Step labels
  const STEPS = ['School Info', 'Account', 'Done'];

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #4f46e5 100%)' }}>

        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-400 rounded-full opacity-10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-300 rounded-full opacity-10 blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 right-0 w-56 h-56 bg-yellow-400 rounded-full opacity-5 blur-3xl" />

        {/* Grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px)' }} />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg">
            <Award className="w-6 h-6 text-blue-900" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">SchoolMS</span>
        </div>

        {/* Center */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Free to get started
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Set up your<br />school in minutes
          </h1>
          <p className="text-blue-200 text-base leading-relaxed mb-10">
            Join schools already using SchoolMS to manage students, grades, fees and certificates.
          </p>

          {/* Step preview */}
          <div className="space-y-4">
            {[
              { num: '01', title: 'School Info', desc: 'Name and academic year' },
              { num: '02', title: 'Create Account', desc: 'Email and secure password' },
              { num: '03', title: 'Start Generating', desc: 'Upload students & print!' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="text-yellow-400 font-bold text-xs">{s.num}</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{s.title}</p>
                  <p className="text-blue-300 text-xs">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-blue-400 text-xs">
          Your school data is 100% private and isolated
        </p>
      </div>

      {/* ── RIGHT PANEL — form ─────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-gray-50 overflow-y-auto">

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-yellow-400" />
          </div>
          <span className="text-gray-900 font-bold text-lg">SchoolMS</span>
        </div>

        <div className="w-full max-w-sm">

          {/* ── EMAIL CONFIRMATION SCREEN ──────────────────── */}
          {emailSent && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-1">We sent a confirmation link to:</p>
              <p className="font-bold text-gray-800 mb-6">{form.email}</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left space-y-2">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Next steps</p>
                <p className="text-sm text-blue-800">1. Open your email inbox</p>
                <p className="text-sm text-blue-800">2. Click the confirmation link</p>
                <p className="text-sm text-blue-800">3. Come back and sign in</p>
              </div>
              <Link to="/login"
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm text-sm">
                Go to Sign In →
              </Link>
              <p className="text-xs text-gray-400 mt-4">
                Didn't receive it? Check spam folder or{' '}
                <button onClick={() => setEmailSent(false)} className="text-blue-600 hover:underline">try again</button>
              </p>
            </div>
          )}

          {!emailSent && step < 2 && (
            <>
              {/* Step bar */}
              <StepBar current={step} total={3} />

              {/* Step heading */}
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-extrabold text-gray-900">
                  {step === 0 ? 'Your School' : 'Create Account'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {step === 0
                    ? 'Tell us about your school'
                    : 'Set up your login credentials'}
                </p>
              </div>
            </>
          )}

          {/* ── STEP 0: School Info ─────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <Field label="🏫 School Name" required
                hint="This appears on every certificate you generate">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="input-field pl-9 font-semibold uppercase tracking-wide"
                    placeholder="e.g. GREEN HILLS ACADEMY"
                    value={form.school_name}
                    onChange={set('school_name')}
                    autoFocus
                  />
                </div>
              </Field>

              <Field label="📅 Active Academic Year" required
                hint="Default year for photos taken with the mobile app">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="input-field pl-9"
                    type="number"
                    placeholder={String(new Date().getFullYear())}
                    value={form.active_year}
                    onChange={set('active_year')}
                    min="2000" max="2099"
                  />
                </div>
              </Field>

              {/* Preview card */}
              {form.school_name && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs text-blue-400 font-medium mb-1">Certificate will show:</p>
                  <p className="font-bold text-blue-900 text-sm uppercase tracking-wide truncate">
                    {form.school_name}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">Academic Year {form.active_year}</p>
                </div>
              )}

              <button onClick={handleNext}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm text-sm">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── STEP 1: Account credentials ─────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Email Address" required
                hint="Used to log in to this account">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    className="input-field pl-9"
                    placeholder="admin@yourschool.com"
                    value={form.email}
                    onChange={set('email')}
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </Field>

              <Field label="Password" required hint="At least 6 characters">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field pl-9 pr-10"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength bar */}
                {form.password && (
                  <div className="mt-2 flex gap-1">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        form.password.length >= i * 3
                          ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-yellow-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-500'
                          : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Confirm Password" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={`input-field pl-9 pr-10 ${
                      form.confirm_password && form.password !== form.confirm_password
                        ? 'border-red-300 focus:ring-red-400' : ''
                    }`}
                    placeholder="Repeat password"
                    value={form.confirm_password}
                    onChange={set('confirm_password')}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.confirm_password && form.password !== form.confirm_password && (
                  <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                )}
                {form.confirm_password && form.password === form.confirm_password && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </Field>

              {/* Summary */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700 text-xs mb-1">Account summary:</p>
                <p>🏫 <span className="text-gray-800 font-medium">{form.school_name}</span></p>
                <p>📅 Year <span className="text-gray-800 font-medium">{form.active_year}</span></p>
                <p>📧 <span className="text-gray-800">{form.email || '—'}</span></p>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={handleBack}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm text-sm disabled:opacity-60">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</>
                    : <><School className="w-4 h-4" /> Create Account</>}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Success ─────────────────────────────── */}
          {step === 2 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Account Created!</h2>
              <p className="text-gray-500 text-sm mb-1">
                Welcome to SchoolMS
              </p>
              <p className="font-bold text-gray-800 text-lg mb-6">{form.school_name}</p>

              <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 text-left space-y-2">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">What's next</p>
                {[
                  '⚙️ Go to Settings → upload your school logo & signature',
                  '📋 Add students via Upload or CSV import',
                  '🎓 Generate certificates for each class',
                ].map((t) => (
                  <p key={t} className="text-sm text-green-800">{t}</p>
                ))}
              </div>

              {/* Admin credentials box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">🔑 Your Staff Login Credentials</p>
                <p className="text-xs text-blue-600 mb-2">Use these to login at <strong>/staff-login</strong> or share with staff:</p>
                <div className="bg-white rounded-lg p-3 space-y-1 border border-blue-100">
                  <p className="text-sm"><span className="text-gray-500 text-xs">Username:</span> <span className="font-mono font-bold text-blue-900">{form.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'')}</span></p>
                  <p className="text-sm"><span className="text-gray-500 text-xs">Password:</span> <span className="font-mono font-bold text-amber-700">admin123</span></p>
                  <p className="text-xs text-red-500 mt-1">⚠️ Change this password after first login!</p>
                </div>
              </div>

              <button onClick={() => navigate('/')}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm text-sm">
                <GraduationCap className="w-4 h-4" /> Go to Dashboard
              </button>
            </div>
          )}

          {/* Sign in link */}
          {step < 2 && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-700 font-semibold hover:underline">Sign in</Link>
            </p>
          )}
        </div>

        <p className="mt-10 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} CertSystem · Data is private and isolated per school
        </p>
      </div>
    </div>
  );
}
