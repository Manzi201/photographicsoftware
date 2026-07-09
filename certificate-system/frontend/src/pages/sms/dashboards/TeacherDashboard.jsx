import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, Users, Layers, Clock,
  ChevronRight, TrendingUp, Star, ArrowRight
} from 'lucide-react';
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
  const entryTerms   = terms.filter(t => t.number !== 4).sort((a,b) => a.number - b.number);
  const initials     = (staff.full_name || 'T').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const TERM_STYLE = {
    1: { bg:'bg-blue-600',   ring:'ring-blue-200',   label:'T1' },
    2: { bg:'bg-emerald-600',ring:'ring-emerald-200', label:'T2' },
    3: { bg:'bg-violet-600', ring:'ring-violet-200',  label:'T3' },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Profile card ─────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-0.5">Teacher Dashboard</p>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{staff.full_name || 'Teacher'}</h1>
              <p className="text-gray-400 text-sm mt-0.5 truncate">
                {school.school_name} &nbsp;·&nbsp; {school.active_year}
                {currentTerm && <>&nbsp;·&nbsp; <span className="text-emerald-600 font-semibold">{currentTerm.name}</span></>}
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { icon: Layers,        label: 'My Classes',     value: loading?'…':classes.length,   color:'text-blue-600',   bg:'bg-blue-50' },
              { icon: Users,         label: 'Total Students', value: loading?'…':students.length,  color:'text-indigo-600', bg:'bg-indigo-50' },
              { icon: Clock,         label: 'Current Term',   value: loading?'…':(currentTerm?.name||'—'), color:'text-emerald-600', bg:'bg-emerald-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl ${s.bg} px-4 py-3.5`}>
                <s.icon className={`w-5 h-5 ${s.color} mb-1.5`}/>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/sms/marks"
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <BookOpen className="w-5 h-5 text-white"/>
            </div>
            <p className="font-bold text-gray-900 text-sm">Enter Marks</p>
            <p className="text-gray-400 text-xs mt-0.5 mb-3">Enter marks for your subjects</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
              Go to marks entry <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"/>
            </span>
          </Link>

          <Link to="/sms/bulletins"
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-purple-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <FileText className="w-5 h-5 text-white"/>
            </div>
            <p className="font-bold text-gray-900 text-sm">View Bulletins</p>
            <p className="text-gray-400 text-xs mt-0.5 mb-3">See student report cards</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600">
              View reports <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"/>
            </span>
          </Link>
        </div>

        {/* ── Term marks entry ──────────────────────────── */}
        {entryTerms.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-500"/>
              </div>
              <p className="font-bold text-gray-900 text-sm">Enter Marks by Term</p>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              {entryTerms.map(t => {
                const ts = TERM_STYLE[t.number] || TERM_STYLE[1];
                return (
                  <Link key={t.id} to={`/sms/marks?term_id=${t.id}`}
                    className={`flex flex-col items-center py-4 px-3 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5
                      ${t.is_current
                        ? `${ts.bg} border-transparent text-white shadow-sm`
                        : `bg-white border-gray-100 text-gray-700 hover:border-gray-200`}`}>
                    <span className={`text-lg font-bold ${t.is_current ? 'text-white' : 'text-gray-900'}`}>{t.name}</span>
                    {t.is_current && (
                      <span className="text-[11px] font-semibold text-white/80 mt-0.5">Current</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── My Classes list ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 text-blue-500"/>
              </div>
              <p className="font-bold text-gray-900 text-sm">My Classes</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
              {classes.length} class{classes.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse"/>)}
            </div>
          ) : classes.length === 0 ? (
            <div className="py-12 text-center">
              <Layers className="w-10 h-10 mx-auto mb-2 text-gray-200"/>
              <p className="text-sm text-gray-400">No classes assigned yet</p>
              <p className="text-xs text-gray-300 mt-1">Contact Director of Studies</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {classes.map(cls => {
                const count = students.filter(s => s.current_class_id === cls.id).length;
                return (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {count} student{count !== 1 ? 's' : ''}
                        {cls.level && ` · ${cls.level}`}
                        {cls.academic_year?.name && ` · ${cls.academic_year.name}`}
                      </p>
                    </div>
                    <Link to={`/sms/marks?class_id=${cls.id}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm opacity-0 group-hover:opacity-100">
                      <BookOpen className="w-3.5 h-3.5"/> Marks
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
