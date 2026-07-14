import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const { supabase } = useAuth();
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      // Use Supabase's built-in password reset
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* Header band */}
        <div className="bg-[#0a2156] px-8 py-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white"/>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">SchoolMS</p>
            <p className="text-blue-300 text-[11px]">Password Recovery</p>
          </div>
        </div>

        <div className="p-8">
          {!sent ? (
            <>
              <div className="mb-7">
                <h1 className="text-xl font-bold text-gray-900">Forgot your password?</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Enter your school admin email and we'll send a reset link.
                </p>
                <p className="text-amber-600 text-xs mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  ⚠ This only works for school admins (email login). Staff passwords are reset by the admin in Staff Management.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Admin Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input
                      type="email"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all"
                      placeholder="admin@school.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      autoFocus autoComplete="email"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#0a2156] hover:bg-[#0c2a6a] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm text-sm">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Sending…</>
                    : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-1">
                We sent a reset link to
              </p>
              <p className="font-bold text-gray-800 mb-6">{email}</p>
              <p className="text-gray-400 text-xs">
                Didn't receive it? Check spam or try again in a few minutes.
              </p>
            </div>
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
