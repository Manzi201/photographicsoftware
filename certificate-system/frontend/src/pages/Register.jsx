import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, GraduationCap, Building2, Calendar,
  Phone, MapPin, Check, ChevronRight, ChevronLeft, User, Mail
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AuthHero from '../components/AuthHero';

function StepBar({ current, total }) {
  const labels = ['School Info', 'Admin Account', 'Done'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current, active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done?'bg-blue-600 border-blue-600 text-white':active?'bg-white border-blue-600 text-blue-600':'bg-white border-gray-200 text-gray-400'}`}>
                {done?<Check className="w-4 h-4"/>:i+1}
              </div>
              <span className={`text-xs mt-1 font-medium whitespace-nowrap ${active?'text-blue-700':done?'text-blue-500':'text-gray-400'}`}>{labels[i]}</span>
            </div>
            {i < total-1 && <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < current?'bg-blue-500':'bg-gray-200'}`}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Field({ label, hint, icon: Icon, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>}
        <div className={Icon ? 'pl-9' : ''}>{children}</div>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [form, setForm] = useState({
    school_name: '',
    active_year: String(new Date().getFullYear()),
    school_phone: '',
    school_address: '',
    email: '',
    password: '',
    confirm_password: '',
    admin_name: '',
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const validateStep0 = () => {
    if (!form.school_name.trim()) { toast.error('Enter school name'); return false; }
    return true;
  };
  const validateStep1 = () => {
    if (!form.admin_name.trim()) { toast.error('Enter your full name'); return false; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter valid email'); return false; }
    if (form.password.length < 6) { toast.error('Password min 6 characters'); return false; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  const handleNext = () => {
    if (step===0 && !validateStep0()) return;
    if (step===1 && !validateStep1()) return;
    setStep(s=>s+1);
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    try {
      await register(form.email, form.password, form.school_name, form.active_year);
      setStep(2);
    } catch (err) {
      if (err.message==='CHECK_EMAIL') { setEmailSent(true); return; }
      const msg = err.message?.includes('already')?'Email already registered. Sign in instead.':err.message||'Registration failed';
      toast.error(msg, { duration: 5000 });
    } finally { setLoading(false); }
  };

  const defaultUsername = form.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'');

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <AuthHero />

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 bg-white min-h-screen lg:min-h-0 overflow-y-auto">

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          <span className="font-bold text-lg text-gray-900">SchoolMS</span>
        </div>

        <div className="w-full max-w-sm py-8">

          {/* Email confirmation */}
          {emailSent && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-blue-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm your email</h2>
              <p className="text-gray-500 text-sm mb-6">Check <strong>{form.email}</strong> and click the confirmation link.</p>
              <Link to="/login" className="btn-primary w-full justify-center py-3 flex items-center gap-2">Go to Sign In →</Link>
            </div>
          )}

          {/* STEP 0 — School Info */}
          {!emailSent && step===0 && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create School Account</h1>
                <p className="text-gray-500 text-sm mt-1">Set up your school management system</p>
              </div>
              <StepBar current={0} total={3}/>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">School Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9 font-semibold uppercase"
                      placeholder="e.g. GREEN HILLS ACADEMY"
                      value={form.school_name} onChange={set('school_name')} autoFocus/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Year *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9" type="number" min="2020" max="2099"
                      value={form.active_year} onChange={set('active_year')}/>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Current academic year for students</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">School Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9" placeholder="e.g. 0788 000 000"
                      value={form.school_phone} onChange={set('school_phone')}/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Location / Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9" placeholder="e.g. Kigali, Gasabo"
                      value={form.school_address} onChange={set('school_address')}/>
                  </div>
                </div>

                {form.school_name && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
                    <p className="text-xs text-blue-500 font-medium mb-1">Preview:</p>
                    <p className="font-bold text-blue-900 uppercase truncate">{form.school_name}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Year {form.active_year} {form.school_address && `· ${form.school_address}`}</p>
                  </div>
                )}

                <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl">
                  Next: Admin Account <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </>
          )}

          {/* STEP 1 — Admin Account */}
          {!emailSent && step===1 && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Admin Account</h1>
                <p className="text-gray-500 text-sm mt-1">Your account — you will be the school administrator</p>
              </div>
              <StepBar current={1} total={3}/>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input className="input-field pl-9" placeholder="e.g. Jean Paul Manzi"
                      value={form.admin_name} onChange={set('admin_name')} autoFocus autoCapitalize="words"/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input type="email" className="input-field pl-9" placeholder="admin@school.com"
                      value={form.email} onChange={set('email')} autoComplete="email"/>
                  </div>
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
                        <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length>=i*3?i<=1?'bg-red-400':i<=2?'bg-amber-400':i<=3?'bg-blue-400':'bg-green-500':'bg-gray-200'}`}/>
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
                    <p className={`text-xs mt-1 flex items-center gap-1 ${form.password===form.confirm_password?'text-green-600':'text-red-500'}`}>
                      {form.password===form.confirm_password?<><Check className="w-3 h-3"/>Passwords match</>:'✗ Do not match'}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={()=>setStep(0)} className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">
                    <ChevronLeft className="w-4 h-4"/> Back
                  </button>
                  <button onClick={handleSubmit} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl">
                    {loading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Creating...</>:<>Create Account</>}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 — Success */}
          {!emailSent && step===2 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Check className="w-8 h-8 text-green-600"/>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Account Created!</h2>
              <p className="text-gray-500 text-sm mb-6">
                <strong>{form.school_name}</strong> is ready to use.
              </p>

              {/* What was set up */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-5 text-left space-y-2.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">✅ What was set up</p>
                <div className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0"/>
                  <span className="text-gray-700">School account: <strong>{form.school_name}</strong></span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0"/>
                  <span className="text-gray-700">Admin account: <strong>{form.admin_name || form.email}</strong></span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0"/>
                  <span className="text-gray-700">Year: <strong>{form.active_year}</strong></span>
                </div>
              </div>

              {/* Next steps */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-left">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">🚀 Next steps</p>
                {[
                  ['1', 'Go to Settings → upload logo & signature'],
                  ['2', 'Create classes (Director of Studies)'],
                  ['3', 'Register students (Secretary)'],
                  ['4', 'Create staff accounts for teachers, secretary, finance'],
                ].map(([n,t])=>(
                  <p key={n} className="text-sm text-blue-800 py-0.5">
                    <span className="font-bold text-blue-600">{n}.</span> {t}
                  </p>
                ))}
              </div>

              <button onClick={() => navigate('/sms/dashboard')}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl mb-3">
                Go to Dashboard →
              </button>
            </div>
          )}

          {step < 2 && !emailSent && (
            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account? <Link to="/login" className="text-blue-700 font-semibold hover:underline">Sign in</Link>
            </p>
          )}
        </div>

        <p className="pb-6 text-xs text-gray-400 text-center">© {new Date().getFullYear()} SchoolMS</p>
      </div>
    </div>
  );
}
