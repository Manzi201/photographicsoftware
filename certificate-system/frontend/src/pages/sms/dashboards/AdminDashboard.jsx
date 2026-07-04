import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, Award, CreditCard, TrendingUp, Bell, Settings, ArrowUpRight, Shield, GraduationCap } from 'lucide-react';
import { getSmsStudentStats, getFinanceSummary, getAcademicYears } from '../../../api';
import { useAuth } from '../../../context/AuthContext';

export default function AdminDashboard() {
  const { school } = useAuth();
  const [stats,    setStats]    = useState({});
  const [finance,  setFinance]  = useState({});
  const [year,     setYear]     = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([getSmsStudentStats(), getFinanceSummary(), getAcademicYears()]).then(([s,f,y]) => {
      setStats(s.data.data||{});
      setFinance(f.data.data||{});
      const current = (y.data.data||[]).find(x=>x.is_current) || y.data.data?.[0];
      setYear(current);
    }).finally(() => setLoading(false));
  }, []);

  const modules = [
    { to:'/sms/admin',         icon:Shield,       label:'Staff Management',  desc:'Create staff accounts & roles',     color:'text-red-600',    bg:'bg-red-50' },
    { to:'/sms/students',      icon:Users,        label:'Registration',      desc:'Register & manage students',        color:'text-blue-600',   bg:'bg-blue-50' },
    { to:'/sms/marks',         icon:BookOpen,     label:'Marks & Grades',    desc:'Enter & review marks',             color:'text-indigo-600', bg:'bg-indigo-50' },
    { to:'/sms/bulletins',     icon:GraduationCap,label:'Bulletins',         desc:'Generate report cards',            color:'text-green-600',  bg:'bg-green-50' },
    { to:'/sms/promotion',     icon:TrendingUp,   label:'Promotion',         desc:'Promote or repeat students',       color:'text-purple-600', bg:'bg-purple-50' },
    { to:'/sms/finance',       icon:CreditCard,   label:'Finance',           desc:'Fees & payments',                  color:'text-amber-600',  bg:'bg-amber-50' },
    { to:'/sms/notifications', icon:Bell,         label:'Notifications',     desc:'SMS & email to parents',           color:'text-teal-600',   bg:'bg-teal-50' },
    { to:'/generate',          icon:Award,        label:'Certificates',      desc:'Generate student certificates',    color:'text-orange-600', bg:'bg-orange-50' },
    { to:'/settings',          icon:Settings,     label:'Settings',          desc:'School info, logo, signature',     color:'text-gray-600',   bg:'bg-gray-50' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-800 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center gap-4">
          {school?.logo_url && <img src={school.logo_url} className="w-14 h-14 rounded-xl object-contain bg-white p-1" alt="logo"/>}
          <div>
            <p className="text-blue-300 text-sm font-medium">Admin Dashboard</p>
            <h1 className="text-2xl font-bold">{school?.school_name||'School'}</h1>
            <p className="text-blue-200 text-sm">Year: {school?.active_year} · {year?.name||'—'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Students', value: loading?'…':stats.total||0,  color:'text-blue-700',  bg:'bg-blue-50' },
          { label:'Boys',           value: loading?'…':stats.boys||0,   color:'text-blue-600',  bg:'bg-blue-50' },
          { label:'Girls',          value: loading?'…':stats.girls||0,  color:'text-pink-600',  bg:'bg-pink-50' },
          { label:'Fees Collected', value: loading?'…':`RWF ${((finance.totalCollected||0)).toLocaleString()}`, color:'text-green-700', bg:'bg-green-50' },
          { label:'Fee Outstanding',value: loading?'…':`RWF ${((finance.totalOutstanding||0)).toLocaleString()}`, color:'text-red-600', bg:'bg-red-50' },
          { label:'Fully Paid',     value: loading?'…':finance.paidCount||0,    color:'text-green-600', bg:'bg-green-50' },
          { label:'Partial',        value: loading?'…':finance.partialCount||0, color:'text-amber-600', bg:'bg-amber-50' },
          { label:'Unpaid',         value: loading?'…':finance.unpaidCount||0,  color:'text-red-600',   bg:'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`card ${s.bg} border-0 py-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Module grid */}
      <h2 className="font-bold text-gray-800 mb-3">All Modules</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {modules.map(m => {
          const Icon = m.icon;
          return (
            <Link key={m.to} to={m.to} className="card hover:shadow-md transition-shadow flex items-center gap-4">
              <div className={`${m.bg} p-3 rounded-xl shrink-0`}><Icon className={`w-5 h-5 ${m.color}`}/></div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{m.label}</p>
                <p className="text-xs text-gray-400 truncate">{m.desc}</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 ml-auto shrink-0"/>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
