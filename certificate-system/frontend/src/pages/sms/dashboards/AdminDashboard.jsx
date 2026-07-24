import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Settings, UserCircle, Users, CheckCircle, AlertCircle, ArrowRight, School } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

function StatCard({ icon: Icon, iconBg, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className="w-7 h-7 text-white"/>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function ActionCard({ to, icon: Icon, iconBg, label, desc }) {
  return (
    <Link to={to} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all group">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white"/>
      </div>
      <p className="font-bold text-gray-900 text-sm">{label}</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{desc}</p>
      <div className="flex items-center gap-1 text-xs font-bold text-blue-600 mt-3 group-hover:gap-1.5 transition-all">
        Open <ArrowRight className="w-3.5 h-3.5"/>
      </div>
    </Link>
  );
}

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
  const doneCount = checks.filter(c => c.ok).length;
  const allDone   = doneCount === checks.length;

  return (
    <div className="min-h-screen bg-gray-50/60 p-5 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Welcome header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back, Admin! 👋</h1>
            <p className="text-gray-500 text-sm mt-1">{schoolName} &nbsp;·&nbsp; {activeYear}</p>
          </div>
          <Link to="/settings"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a2156] text-white text-sm font-bold hover:bg-[#0c2a6a] transition-colors shadow-sm">
            <Settings className="w-4 h-4"/> School Settings
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Users}  iconBg="bg-blue-500"  label="Staff Accounts" value={loading?'—':staffCount??0} sub="including owner" />
          <StatCard icon={School} iconBg="bg-violet-500" label="Academic Year"  value={activeYear} sub="current active year" />
          <StatCard icon={CheckCircle} iconBg={allDone?'bg-emerald-500':'bg-amber-500'} label="Setup Progress" value={`${doneCount}/${checks.length}`} sub={allDone?'All complete':'Items remaining'} />
        </div>

        {/* Setup checklist */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm">School Setup Checklist</h2>
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
                <span className={`text-sm flex-1 ${c.ok ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{c.label}</span>
                {!c.ok && <Link to="/settings" className="text-xs text-blue-600 font-semibold hover:underline">Fix →</Link>}
              </div>
            ))}
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionCard to="/sms/admin" icon={Shield}      iconBg="bg-[#0a2156]" label="Staff Management"  desc="Create and manage all staff accounts and their roles" />
          <ActionCard to="/settings"  icon={Settings}    iconBg="bg-slate-600"  label="School Settings"   desc="Logo, signature, stamp, academic year configuration" />
          <ActionCard to="/profile"   icon={UserCircle}  iconBg="bg-slate-500"  label="School Profile"    desc="School name, city, phone, signatory information" />
        </div>

      </div>
    </div>
  );
}
