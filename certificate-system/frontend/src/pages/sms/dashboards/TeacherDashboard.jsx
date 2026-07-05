import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, ArrowUpRight, Users } from 'lucide-react';
import { getSmsClasses, getTerms, getSmsStudents } from '../../../api';

// Mirrors Teacher sidebar sections
const SECTIONS = [
  {
    title: 'Academics',
    color: 'blue',
    items: [
      { to: '/sms/marks',     icon: BookOpen,  label: 'Enter Marks',    desc: 'Enter marks for your subjects' },
      { to: '/sms/bulletins', icon: FileText,  label: 'View Bulletins', desc: 'See student report cards' },
    ],
  },
];

const SECTION_STYLES = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', head: 'text-blue-700', icon: 'bg-blue-100 text-blue-600' },
};

export default function TeacherDashboard() {
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getSmsStudents()])
      .then(([c, t, s]) => {
        setClasses(c.data.data  || []);
        setTerms(t.data.data    || []);
        setStudents(s.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentTerm = terms.find(t => t.is_current);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-800 via-blue-700 to-indigo-700 rounded-2xl p-5 sm:p-6 text-white">
        <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">Teacher Dashboard</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-0.5">Welcome, {staff.full_name}</h1>
        <p className="text-indigo-200 text-sm mt-0.5">
          {school.school_name} · Year {school.active_year}
          {currentTerm ? ` · ${currentTerm.name}` : ''}
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'My Classes',     value: classes.length,  color: 'text-blue-700',   bg: 'bg-blue-50' },
          { label: 'Total Students', value: students.length, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Current Term',   value: currentTerm?.name || '—', color: 'text-green-700', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white px-4 py-4 shadow-sm text-center`}>
            <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{loading ? '…' : s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Sections ──────────────────────────────────────── */}
      {SECTIONS.map(sec => {
        const st = SECTION_STYLES[sec.color];
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

      {/* ── My classes list ───────────────────────────────── */}
      {classes.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500"/> My Classes
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {classes.map(cls => {
              const count = students.filter(s => s.current_class_id === cls.id).length;
              return (
                <div key={cls.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                    <p className="text-xs text-gray-400">{count} students</p>
                  </div>
                  <Link to={`/sms/marks?class_id=${cls.id}`} className="btn-secondary text-xs py-1.5">
                    <BookOpen className="w-3.5 h-3.5"/> Enter Marks
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
