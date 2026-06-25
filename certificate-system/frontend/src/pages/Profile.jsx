import React, { useState } from 'react';
import { UserCircle, Mail, Building2, Calendar, Shield, LogOut, Key, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Profile() {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPwd.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { current_password: pwdForm.current, new_password: pwdForm.newPwd });
      toast.success('Password changed successfully');
      setChangingPwd(false);
      setPwdForm({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const infoRows = [
    { icon: Mail, label: 'Email Address', value: user?.email },
    { icon: Building2, label: 'School Name', value: school?.school_name },
    { icon: Calendar, label: 'Active Year', value: school?.active_year },
    { icon: Shield, label: 'Account ID', value: user?.id?.slice(0, 8) + '...' },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">Your account and school information</p>
      </div>

      {/* Avatar + name */}
      <div className="card mb-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white uppercase shrink-0 shadow-md">
          {school?.school_name?.charAt(0) || user?.email?.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{school?.school_name || 'My School'}</h2>
          <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full mt-2">
            <CheckCircle className="w-3 h-3" /> Active Account
          </span>
        </div>
      </div>

      {/* Info table */}
      <div className="card mb-5">
        <h2 className="font-semibold text-gray-800 mb-4">Account Details</h2>
        <div className="divide-y divide-gray-50">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 py-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" /> Security
          </h2>
          <button onClick={() => setChangingPwd(!changingPwd)}
            className="text-sm text-blue-600 hover:underline font-medium">
            {changingPwd ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {changingPwd ? (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" className="input-field" placeholder="••••••••"
                value={pwdForm.current} onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" className="input-field" placeholder="At least 6 characters"
                value={pwdForm.newPwd} onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" className="input-field" placeholder="Repeat new password"
                value={pwdForm.confirm} onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Changing...' : 'Update Password'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-400">Password last changed: unknown</p>
        )}
      </div>

      {/* Logout */}
      <div className="card border-red-100 bg-red-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Sign Out</p>
            <p className="text-sm text-gray-500 mt-0.5">You will be redirected to the login page</p>
          </div>
          <button onClick={handleLogout} className="btn-danger">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
