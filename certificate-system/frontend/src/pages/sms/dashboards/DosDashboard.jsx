import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, FileText, TrendingUp, Layers, ArrowUpRight, Plus, Eye } from 'lucide-react';
import { getSmsStudentStats, getSmsClasses, getTerms } from '../../../api';

const SECTIONS = [
  {
    title: 'Academics',
    color: 'purple',
    items: [
      { to:'/sms/classes',   icon:Layers,     label:'Classes & Years',    desc:'Manage classes, subjects, teacher assignments' },
      { to:'/sms/students',  icon:Users,       label:'Students',           desc:'View & manage students' },
      { to:'/sms/marks',     icon:Eye,         label:'Student Marks',      desc:'View all marks (read-only)' },
      { to:'/sms/bulletins', icon:FileText,    label:'Bulletins',          desc:'Download term & annual report cards' },
      { to:'/sms/promotion', icon:TrendingUp,  label:'Promotion',          desc:'Promote or repeat students' },
    ],
  },
];

const ST = { bg:'bg-purple-50', border:'border-purple-100', head:'text-purple-700', icon:'bg-purple-100 text-purple-600' };

export default function DosDashboard() {
  const [stats,   setStats]   = useState({});
  const [classes, setClasses] = useState([]);
  const [terms,   setTerms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');

  useEffect(() => {
    Promise.all([getSmsStudentStats(), getSmsClasses(), getTerms()])
      .then(([s,c,t]) => { setStats(s.data.data||{}); setClasses(c.data.data||[]); setTerms(t.data.data||[]); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const currentTerm = terms.find(t => t.is_current);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-800 via-violet-700 to-purple-700 rounded-2xl p-5 sm:p-6 text-white">
        <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider">Director of Studies</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-0.5">Welcome, {staff.full_name}</h1>
        <p className="text-purple-200 text-sm mt-0.5">
          {school.school_name} · Year {school.active_year}
          {currentTerm ? ` · ${currentTerm.name}` : ''}
        </p>
      </div>

      {/* DoS role note */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
        <Eye className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
        <div>
          <p className="font-semibold text-amber-800 text-sm">Director of Studies — Read-only on Marks</p>
          <p className="text-amber-600 text-xs mt-0.5">You can view all student marks but cannot enter/edit them. Teachers enter marks for their assigned subjects.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total Students', value: stats.total||0,  color:'text-blue-700',   bg:'bg-blue-50' },
          { label:'Classes',        value: classes.length,  color:'text-purple-700', bg:'bg-purple-50' },
          { label:'Current Term',   value: currentTerm?.name||'—', color:'text-green-700', bg:'bg-green-50' },
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white px-4 py-4 shadow-sm text-center`}>
            <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{loading?'…':s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map(sec => (
        <div key={sec.title}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold uppercase tracking-widest ${ST.head}`}>{sec.title}</span>
            <div className={`flex-1 h-px ${ST.border.replace('border-','bg-')}`}/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sec.items.map(item => {
              const Icon=item.icon;
              return (
                <Link key={item.to} to={item.to}
                  className={`flex items-center gap-4 rounded-2xl border ${ST.bg} ${ST.border} px-4 py-3.5 hover:shadow-md transition-all group`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ST.icon}`}>
                    <Icon className="w-5 h-5"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.desc}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors"/>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Classes overview */}
      {classes.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500"/> Classes Overview
            </span>
            <Link to="/sms/classes" className="text-xs text-purple-600 font-semibold hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5"/> Manage
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {classes.slice(0,6).map(cls => (
              <div key={cls.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                  <p className="text-xs text-gray-400">{cls.level||'—'}{cls.academic_year?.name?` · ${cls.academic_year.name}`:''}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/sms/marks?class_id=${cls.id}`} className="btn-secondary text-xs py-1.5">
                    <Eye className="w-3.5 h-3.5"/> View Marks
                  </Link>
                  <Link to={`/sms/bulletins?class_id=${cls.id}`} className="btn-secondary text-xs py-1.5">
                    <FileText className="w-3.5 h-3.5"/> Bulletins
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
