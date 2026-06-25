import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Eye, EyeOff, LogIn, GraduationCap, BookOpen, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const BG_FEATURES = [
  { icon: GraduationCap, text: 'Generate professional certificates instantly' },
  { icon: Users,         text: 'Manage all students with photos & IDs' },
  { icon: BookOpen,      text: 'Batch print entire classes at once' },
  { icon: Award,         text: 'Custom templates per class level' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — hero / background ──────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        }}>

        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-400 rounded-full opacity-10 blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-yellow-400 rounded-full opacity-5 blur-3xl -translate-x-1/2 -translate-y-1/2" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.3) 40px,rgba(255,255,255,.3) 41px)' }} />

        {/* Top brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg">
            <Award className="w-6 h-6 text-blue-900" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">CertSystem</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
            <GraduationCap className="w-9 h-9 text-blue-900" />
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            School Certificate<br />Management System
          </h1>
          <p className="text-blue-200 text-lg mb-10 leading-relaxed">
            Create, manage and print professional certificates for your students — all in one place.
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {BG_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-blue-100 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-blue-300 text-xs">
          Trusted by schools across Rwanda · Secure · Fast · Private
        </p>
      </div>

      {/* ── RIGHT PANEL — login form ─────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-gray-50">

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-yellow-400" />
          </div>
          <span className="text-gray-900 font-bold text-lg">CertSystem</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900">Sign in</h2>
            <p className="text-gray-500 text-sm mt-1">Enter your school account credentials</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="school@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed text-sm">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
                : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Register link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              New school?{' '}
              <Link to="/register"
                className="text-blue-700 font-semibold hover:underline">
                Create account →
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-12 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} CertSystem · All data is private per school
        </p>
      </div>
    </div>
  );
}
