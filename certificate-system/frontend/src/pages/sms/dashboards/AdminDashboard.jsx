import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Settings, UserCircle, Users, CheckCircle, AlertCircle, ArrowRight, School } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export default function AdminDashboard() {
  const { school } = useAuth();
  const [staffCount, setStaffCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../../../api').then(({ default: api }) =>
      api.get('/sms/admin/staff')
        .then(r => setStaffCount((r.data?.data || []).length + 1))
        .catch(() => setStaffCount(1))
        .finally(() => setLoading(false))
    );
  }, []);

  const schoolName = school?.school_name || 'My School';
  const activeYear = school?.active_year || '—';
  const checks = [
    { label: 'School name set',  ok: !!(school?.school_name && school.school_name !== 'My School') },
    { label: 'Logo uploaded',    ok: !!school?.logo_url },
    { label: 'Signature set',    ok: !!school?.signature_url },
    { label: 'Signatory name',   ok: !!(school?.signatory_name && school.signatory_name !== 'Head Teacher') },
  ];
  const allDone = checks.every(c => c.ok);
  const doneCount = checks.filter(c => c.ok).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">{schoolName} · Year {activeYear}</p>
          </div>
          <Link to="/settings" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a2156] text-white text-sm font-bold hover:bg-[#0c2a6a] transition-colors shadow-sm">
            <Settings className="w-4 h-4"/> Settings
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Staff Accounts</p>
            <p className="text-4xl font-bold text-gray-900">{loading ? '—' : staffCount ?? 0}</p>
            <p className="text-xs text-gray-400 mt-2">Including school owner</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Academic Year</p>
            <p className="text-4xl font-bold text-gray-900">{activeYear}</p>
            <p className="text-xs text-gray-400 mt-2">Current active year</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:col-span-1 col-span-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Setup Progress</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-gray-900">{doneCount}</p>
              <p className="text-lg text-gray-400 mb-1">/ {checks.length}</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">{allDone ? 'All complete' : 'Items remaining'}</p>
          </div>
        </div>

        {/* Setup checklist */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">School Setup</h2>
            {allDone
              ? <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5"/> Complete</span>
              : <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5"/> Incomplete</span>}
          </div>
          <div className="divide-y divide-gray-50">
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                  ${c.ok ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {c.ok ? '✓' : '○'}
                </span>
                <span className={`text-sm ${c.ok ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{c.label}</span>
                {!c.ok && <Link to="/settings" className="ml-auto text-xs text-blue-600 font-semibold hover:underline">Fix →</Link>}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { to:'/sms/admin', icon:Shield,      color:'bg-[#0a2156]', label:'Staff Management', desc:'Create & manage staff accounts and roles' },
            { to:'/settings',  icon:Settings,     color:'bg-slate-600', label:'School Settings',  desc:'Logo, signature, academic year' },
            { to:'/profile',   icon:UserCircle,   color:'bg-slate-500', label:'School Profile',   desc:'School name, city, signatory info' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5 text-white"/>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-1 text-xs font-bold text-[#0a2156] mt-4 group-hover:gap-1.5 transition-all">
                  Open <ArrowRight className="w-3.5 h-3.5"/>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}
