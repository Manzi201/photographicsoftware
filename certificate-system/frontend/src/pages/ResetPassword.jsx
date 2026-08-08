import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

function pwStrength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 6)         s++;
  if (p.length >= 10)        s++;
  if (/[A-Z]/.test(p))       s++;
  if (/[0-9!@#$%]/.test(p))  s++;
  return s;
}

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [showCf,   setShowCf]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [formError,setFormError]= useState('');

  // Supabase sends: /reset-password#access_token=xxx&refresh_token=yyy&type=recovery
  // We must detect this and show the form immediately — don't wait for session.
  const hash = window.location.hash;
  const isRecoveryLink = hash.includes('type=recovery') || hash.includes('access_token=');

  useEffect(() => {
    if (!isRecoveryLink) return;

    // Parse tokens from hash manually and set the session
    const params = new URLSearchParams(hash.replace('#', ''));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
        .catch(() => {});
    }

    // Also listen for PASSWORD_RECOVERY event (backup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // session is set, form is already visible
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  const strength = pwStrength(password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = [
    'bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'
  ][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (password.length < 6) { setFormError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setFormError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success('Password updated!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setFormError(err.message || 'Failed to update password. The link may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#0a2156] px-8 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">SchoolMS</p>
            <p className="text-blue-300 text-[11px]">Set New Password</p>
          </div>
        </div>

        <div className="p-8">

          {/* No valid token */}
          {!isRecoveryLink && !done && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-500"/>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
              <p className="text-gray-500 text-sm mb-6">
                This link is invalid or has already been used. Request a new one.
              </p>
              <Link to="/forgot-password"
                className="inline-flex items-center gap-2 bg-[#0a2156] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0c2a6a] transition-colors text-sm">
                Request New Link
              </Link>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
              <p className="text-gray-500 text-sm mb-1">Your password has been changed successfully.</p>
              <p className="text-gray-400 text-xs mb-6">Redirecting to sign in…</p>
              <Link to="/login"
                className="inline-flex items-center gap-2 bg-[#0a2156] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0c2a6a] transition-colors text-sm">
                Sign In Now
              </Link>
            </div>
          )}

          {/* Form — shown whenever there's a recovery token in the URL */}
          {isRecoveryLink && !done && (
            <>
              <div className="mb-7">
                <h1 className="text-xl font-bold text-gray-900">Choose a new password</h1>
                <p className="text-gray-400 text-sm mt-1">Enter and confirm your new password below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-11 py-3 text-sm font-medium text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all"
                      placeholder="Min 6 characters"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoFocus autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                    </button>
                  </div>
                  {password && (
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
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input
                      type={showCf ? 'text' : 'password'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-11 py-3 text-sm font-medium text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all"
                      placeholder="Repeat password"
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowCf(!showCf)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCf ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                    </button>
                  </div>
                  {confirm && (
                    <p className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1
                      ${password === confirm ? 'text-emerald-600' : 'text-red-500'}`}>
                      {password === confirm
                        ? <><CheckCircle2 className="w-3 h-3"/>Passwords match</>
                        : <><AlertCircle className="w-3 h-3"/>Passwords do not match</>}
                    </p>
                  )}
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
                    {formError}
                  </div>
                )}

                <button type="submit"
                  disabled={loading || password.length < 6 || password !== confirm}
                  className="w-full flex items-center justify-center gap-2 bg-[#0a2156] hover:bg-[#0c2a6a] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm text-sm disabled:opacity-50">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Updating…</>
                    : 'Set New Password'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-[#0a2156] font-semibold hover:underline">
              <ArrowLeft className="w-4 h-4"/> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
