import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Shield, Users, BookOpen, FileText, TrendingUp,
  CreditCard, Bell, Settings, ArrowUpRight,
  GraduationCap, BarChart2, AlertCircle
} from 'lucide-react';
import { getSmsStudentStats, getFinanceSummary, getAcademicYears } from '../../../api';
import { useAuth } from '../../../context/AuthContext';

// Sidebar sections mirrored on dashboard
const SECTIONS = [
  {
    title: 'People',
    color: 'blue',
    items: [
      { to: '/sms/admin',    icon: Shield, label: 'Staff Management', desc: 'Create accounts & roles' },
      { to: '/sms/students', icon: Users,  label: 'Students',         desc: 'Register & manage students' },
    ],
  },
  {
    title: 'Academics',
    color: 'indigo',
    items: [
      { to: '/sms/marks',     icon: BookOpen,   label: 'Marks & Grades', desc: 'Enter & review marks' },
      { to: '/sms/bulletins', icon: FileText,   label: 'Bulletins',      desc: 'Generate report cards' },
      { to: '/sms/promotion', icon: TrendingUp, label: 'Promotion',      desc: 'Promote or repeat students' },
    ],
  },
  {
    title: 'Administration',
    color: 'amber',
    items: [
      { to: '/sms/finance',       icon: CreditCard, label: 'Finance',       desc: 'Fees & payments' },
      { to: '/sms/notifications', icon: Bell,       label: 'Notifications', desc: 'SMS & email to parents' },
      { to: '/settings',          icon: Settings,   label: 'Settings',      desc: 'School info, logo, signature' },
    ],
  },
];

const SECTION_STYLES = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   head: 'text-blue-800',   icon: 'bg-blue-100 text-blue-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', head: 'text-indigo-800', icon: 'bg-indigo-100 text-indigo-600' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-100',  head: 'text-amber-800',  icon: 'bg-amber-100 text-amber-600' },
};

export default function AdminDashboard() {
  const { school } = useAuth();
  const [stats,   setStats]   = useState({});
  const [finance, setFinance] = useState({});
  const [year,    setYear]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSmsStudentStats(), getFinanceSummary(), getAcademicYears()])
      .then(([s, f, y]) => {
        setStats(s.data.data || {});
        setFinance(f.data.data || {});
        const current = (y.data.data || []).find(x => x.is_current) || y.data.data?.[0];
        setYear(current);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const schoolName = school?.school_name || 'School';
  const activeYear = school?.active_year || '—';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 rounded-2xl p-5 sm:p-6 text-white">
        <div className="flex items-center gap-4">
          {school?.logo_url && (
            <img src={school.logo_url} className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1 shrink-0" alt="logo"/>
          )}
          <div className="min-w-0">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Admin Dashboard</p>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{schoolName}</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              Academic Year {activeYear}{year ? ` · ${year.name}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: stats.total || 0,              color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: 'Fees Collected', value: `${(finance.totalCollected || 0).toLocaleString()} RWF`, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Outstanding',    value: `${(finance.totalOutstanding || 0).toLocaleString()} RWF`, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Classes',        value: stats.classes || '—',           color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} px-4 py-4 border border-white shadow-sm`}>
            <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{loading ? '…' : s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Sections ────────────────────────────────────────── */}
      {SECTIONS.map(sec => {
        const st = SECTION_STYLES[sec.color];
        return (
          <div key={sec.title}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${st.head}`}>{sec.title}</span>
              <div className={`flex-1 h-px ${st.border.replace('border-','bg-')}`}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sec.items.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to}
                    className={`flex items-center gap-4 rounded-2xl border ${st.bg} ${st.border} px-4 py-3.5 hover:shadow-md transition-all group`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${st.icon}`}>
                      <Icon className="w-5 h-5"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                      <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors"/>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
