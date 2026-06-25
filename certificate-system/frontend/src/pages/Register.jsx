import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Eye, EyeOff, School } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    school_name: '',
    email: '',
    password: '',
    confirm_password: '',
    active_year: String(new Date().getFullYear()),
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.school_name || !form.email || !form.password) {
      toast.error('Fill in all required fields'); return;
    }
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match'); return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.school_name, form.active_year);
      toast.success(`Welcome! ${form.school_name} account created.`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl mb-4 shadow-lg">
            <Award className="w-9 h-9 text-blue-900" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create School Account</h1>
          <p className="text-blue-300 mt-2">Each school gets its own private account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* School name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                🏫 School Name <span className="text-red-500">*</span>
              </label>
              <input className="input-field font-semibold" placeholder="e.g. GREEN HILLS ACADEMY"
                value={form.school_name} onChange={f('school_name')} autoFocus />
            </div>

            {/* Active year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                📅 Active Academic Year
              </label>
              <input className="input-field" type="number" placeholder="2025"
                value={form.active_year} onChange={f('active_year')} />
              <p className="text-xs text-gray-400 mt-1">Year abanyeshuri mwagiye gufata amafoto</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input type="email" className="input-field" placeholder="admin@yourschool.com"
                value={form.email} onChange={f('email')} />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input-field pr-10"
                  placeholder="At least 6 characters"
                  value={form.password} onChange={f('password')} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input type="password" className="input-field" placeholder="Repeat password"
                value={form.confirm_password} onChange={f('confirm_password')} />
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base font-semibold mt-2">
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating account...</span>
                : <><School className="w-5 h-5" /> Create School Account</>}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </div>

        {/* Info */}
        <p className="text-center text-blue-300 text-xs mt-5">
          Each school's data is completely private and separated
        </p>
      </div>
    </div>
  );
}
