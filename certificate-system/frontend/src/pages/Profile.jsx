import React, { useState } from 'react';
import { User, Lock, School, CheckCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Profile() {
  const { user, school } = useAuth();
  const [tab, setTab] = useState('info');
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.newPw || pwForm.newPw.length < 6) { toast.error('Password must be at least 6 chars'); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      // Use Supabase client-side to update password
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Account Info', icon: School },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-gray-500 mt-1">Manage your school account and security settings</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{school?.school_name}</p>
              <p className="text-gray-500 text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Info fields */}
          {[
            { label: 'School Name', value: school?.school_name },
            { label: 'Email Address', value: user?.email },
            { label: 'Active Academic Year', value: school?.active_year },
            { label: 'Signatory / Head Teacher', value: school?.signatory_name },
            { label: 'Account Created', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-500 font-medium">{label}</span>
              <span className="text-sm font-semibold text-gray-800">{value || '—'}</span>
            </div>
          ))}

          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              Your data is private and only visible to your account
            </p>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-5">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { key: 'newPw', label: 'New Password', placeholder: 'At least 6 characters' },
              { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder={placeholder}
                    value={pwForm[key]}
                    onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating...</>
                  : <><Lock className="w-4 h-4" /> Update Password</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
