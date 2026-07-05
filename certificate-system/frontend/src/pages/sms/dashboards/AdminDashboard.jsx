import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Settings, UserCircle, Users, ArrowUpRight, School, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

// Admin ONLY manages staff + school settings
// All academic/finance work belongs to DoS, Secretary, Finance, Teacher
const SECTIONS = [
  {
    title: 'Management',
    color: 'red',
    items: [
      {
        to: '/sms/admin',
        icon: Shield,
        label: 'Staff Management',
        desc: 'Create & manage staff accounts and roles',
      },
    ],
  },
  {
    title: 'School',
    color: 'blue',
    items: [
      {
        to: '/settings',
        icon: Settings,
        label: 'School Settings',
        desc: 'Logo, signature, stamp, academic year',
      },
      {
        to: '/profile',
        icon: UserCircle,
        label: 'School Profile',
        desc: 'School name, city, signatory info',
      },
    ],
  },
];

const STYLES = {
  red:  { bg: 'bg-red-50',  border: 'border-red-100',  head: 'text-red-700',  icon: 'bg-red-100 text-red-600' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', head: 'text-blue-700', icon: 'bg-blue-100 text-blue-600' },
};

export default function AdminDashboard() {
  const { school } = useAuth();
  const [staffCount, setStaffCount] = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    // Just load staff count for the summary card
    import('../../../api').then(({ default: api }) =>
      api.get('/sms/admin/staff')
        .then(r => setStaffCount((r.data?.data || []).length))
        .catch(() => setStaffCount(0))
        .finally(() => setLoading(false))
    );
  }, []);

  const schoolName = school?.school_name || 'My School';
  const activeYear = school?.active_year || '—';

  // Check what's configured
  const checks = [
    { label: 'School name',  ok: !!(school?.school_name && school.school_name !== 'My School') },
    { label: 'Logo uploaded', ok: !!school?.logo_url },
    { label: 'Signature',    ok: !!school?.signature_url },
    { label: 'Signatory',    ok: !!(school?.signatory_name && school.signatory_name !== 'Head Teacher') },
  ];
  const allDone = checks.every(c => c.ok);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-blue-900 rounded-2xl p-5 sm:p-6 text-white">
        <div className="flex items-center gap-4">
          {school?.logo_url
            ? <img src={school.logo_url} className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1 shrink-0" alt="logo"/>
            : <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <School className="w-7 h-7 text-white/60"/>
              </div>
          }
          <div className="min-w-0">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Administrator</p>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{schoolName}</h1>
            <p className="text-gray-300 text-sm mt-0.5">Academic Year {activeYear}</p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 shadow-sm">
          <p className="text-3xl font-bold text-red-600">{loading ? '…' : staffCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Users className="w-3.5 h-3.5"/> Staff accounts
          </p>
        </div>
        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-5 py-4 shadow-sm">
          <p className="text-3xl font-bold text-blue-600">{activeYear}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active school year</p>
        </div>
      </div>

      {/* ── School setup checklist ────────────────────────── */}
      <div className={`rounded-2xl border p-4 sm:p-5 ${allDone ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
        <h3 className={`font-semibold text-sm mb-3 flex items-center gap-2 ${allDone ? 'text-green-800' : 'text-amber-800'}`}>
          {allDone
            ? <><CheckCircle className="w-4 h-4 text-green-600"/> School setup complete</>
            : <><AlertCircle className="w-4 h-4 text-amber-500"/> Complete your school setup</>
          }
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                ${c.ok ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {c.ok ? '✓' : '○'}
              </span>
              <span className={c.ok ? 'text-gray-600 line-through' : 'text-gray-700'}>{c.label}</span>
            </div>
          ))}
        </div>
        {!allDone && (
          <Link to="/settings" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-amber-700 hover:text-amber-900">
            Go to Settings → <ArrowUpRight className="w-3.5 h-3.5"/>
          </Link>
        )}
      </div>

      {/* ── Sections ──────────────────────────────────────── */}
      {SECTIONS.map(sec => {
        const st = STYLES[sec.color];
        return (
          <div key={sec.title}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${st.head}`}>{sec.title}</span>
              <div className={`flex-1 h-px ${st.border.replace('border-', 'bg-')}`}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sec.items.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to}
                    className={`flex items-center gap-4 rounded-2xl border ${st.bg} ${st.border} px-4 py-4 hover:shadow-md transition-all group`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${st.icon}`}>
                      <Icon className="w-5 h-5"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 shrink-0 transition-colors"/>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Reminder ──────────────────────────────────────── */}
      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-center">
        <p className="text-sm text-gray-500">
          Academic work is managed by{' '}
          <span className="font-semibold text-gray-700">Director of Studies</span>,{' '}
          <span className="font-semibold text-gray-700">Secretary</span>,{' '}
          <span className="font-semibold text-gray-700">Teachers</span> &{' '}
          <span className="font-semibold text-gray-700">Finance</span> staff.
        </p>
        <p className="text-xs text-gray-400 mt-1">Create their accounts in Staff Management →</p>
      </div>
    </div>
  );
}
