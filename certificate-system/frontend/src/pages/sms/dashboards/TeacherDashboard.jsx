import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Users, ChevronRight, Layers, Clock, TrendingUp } from 'lucide-react';
import { getSmsClasses, getTerms, getSmsStudents } from '../../../api';

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

  const currentTerm  = terms.find(t => t.is_current);
  const entryTerms   = terms.filter(t => t.number !== 4); // T1/T2/T3 only for marks entry

  const initials = (staff.full_name || 'T').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#0f1117]">

      {/* ── Top hero banner ───────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0a2456] via-[#0d2f6e] to-[#0a2456] px-6 pt-8 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sky-300 text-xs font-semibold uppercase tracking-widest">Teacher Dashboard</p>
              <h1 className="text-white text-2xl font-bold mt-0.5">{staff.full_name || 'Teacher'}</h1>
              <p className="text-blue-300 text-sm mt-0.5">
                {school.school_name} · {school.active_year}
                {currentTerm ? ` · ${currentTerm.name}` : ''}
              </p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'My Classes',    value: loading ? '…' : classes.length,  accent: 'from-blue-500 to-indigo-600' },
              { label: 'Total Students',value: loading ? '…' : students.length, accent: 'from-sky-500 to-blue-500' },
              { label: 'Current Term',  value: loading ? '…' : (currentTerm?.name || '—'), accent: 'from-emerald-500 to-teal-600' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-4 border border-white/10">
                <p className={`text-2xl font-bold bg-gradient-to-r ${s.accent} bg-clip-text text-transparent`}>{s.value}</p>
                <p className="text-blue-200 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4 pb-8 space-y-5">

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/sms/marks"
            className="group bg-[#13151c] border border-white/[0.08] rounded-2xl p-5 hover:border-blue-500/50 hover:bg-[#1a1d27] transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5 text-blue-400"/>
            </div>
            <p className="font-semibold text-white text-sm">Enter Marks</p>
            <p className="text-gray-500 text-xs mt-0.5">Enter marks for your subjects</p>
            <div className="flex items-center gap-1 mt-3 text-blue-400 text-xs font-medium">
              Go to marks entry <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"/>
            </div>
          </Link>

          <Link to="/sms/bulletins"
            className="group bg-[#13151c] border border-white/[0.08] rounded-2xl p-5 hover:border-purple-500/50 hover:bg-[#1a1d27] transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-purple-400"/>
            </div>
            <p className="font-semibold text-white text-sm">View Bulletins</p>
            <p className="text-gray-500 text-xs mt-0.5">See student report cards</p>
            <div className="flex items-center gap-1 mt-3 text-purple-400 text-xs font-medium">
              View reports <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"/>
            </div>
          </Link>
        </div>

        {/* Terms selector for marks entry */}
        {entryTerms.length > 0 && (
          <div className="bg-[#13151c] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400"/>
              <span className="text-sm font-semibold text-white">Enter Marks by Term</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {entryTerms.sort((a,b)=>a.number-b.number).map(t => (
                <Link key={t.id} to={`/sms/marks?term_id=${t.id}`}
                  className={`flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-semibold transition-all
                    ${t.is_current
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-[#1a1d27] border-white/[0.06] text-gray-400 hover:border-blue-500/40 hover:text-white'}`}>
                  <span className="text-base font-bold">{t.name}</span>
                  {t.is_current && <span className="text-[10px] text-blue-200 mt-0.5">Current</span>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Classes */}
        <div className="bg-[#13151c] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400"/>
              <span className="text-sm font-semibold text-white">My Classes</span>
            </div>
            <span className="text-xs text-gray-500">{classes.length} class{classes.length !== 1 ? 'es' : ''}</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i=><div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse"/>)}
            </div>
          ) : classes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30"/>
              <p className="text-sm">No classes assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {classes.map(cls => {
                const count = students.filter(s => s.current_class_id === cls.id).length;
                return (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
                    <div>
                      <p className="font-semibold text-white text-sm">{cls.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {count} student{count !== 1 ? 's' : ''}
                        {cls.level ? ` · ${cls.level}` : ''}
                        {cls.academic_year?.name ? ` · ${cls.academic_year.name}` : ''}
                      </p>
                    </div>
                    <Link to={`/sms/marks?class_id=${cls.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/30 transition-colors">
                      <BookOpen className="w-3.5 h-3.5"/> Enter Marks
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
