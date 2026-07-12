import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, Users, Layers, Clock,
  ChevronRight, ArrowRight, PenLine, GraduationCap,
  CheckCircle2, Circle
} from 'lucide-react';
import { getSmsClasses, getTerms, getSmsStudents } from '../../../api';

const TERM_META = {
  1: { color: 'from-blue-600 to-blue-700',    light: 'bg-blue-50 border-blue-200 text-blue-700',    dot: 'bg-blue-500',    label: 'Term 1' },
  2: { color: 'from-emerald-600 to-emerald-700', light: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', label: 'Term 2' },
  3: { color: 'from-violet-600 to-violet-700', light: 'bg-violet-50 border-violet-200 text-violet-700', dot: 'bg-violet-500',   label: 'Term 3' },
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
  const entryTerms  = terms.filter(t => t.number !== 4).sort((a, b) => a.number - b.number);
  const initials    = (staff.full_name || 'T').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Profile / Welcome card ────────────────────── */}
        <div className="bg-[#0a2156] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-0.5">Teacher Dashboard</p>
              <h1 className="text-xl font-bold text-white truncate">{staff.full_name || 'Teacher'}</h1>
              <p className="text-blue-200 text-xs mt-0.5 truncate">
                {school.school_name}
                {currentTerm && <> · <span className="text-emerald-300 font-semibold">{currentTerm.name} — Active</span></>}
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs text-blue-300">{school.active_year}</span>
              <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {loading ? '…' : `${classes.length} Classes`}
              </span>
            </div>
          </div>

          {/* Quick stats inside header */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'My Classes',     value: loading ? '…' : classes.length,  sub: 'assigned' },
              { label: 'Students',       value: loading ? '…' : students.length, sub: 'total' },
              { label: 'Current Term',   value: loading ? '…' : (currentTerm?.name || '—'), sub: 'active' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-white leading-tight">{s.value}</p>
                <p className="text-blue-200 text-[11px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/sms/marks"
            className="group flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <PenLine className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">Enter Marks</p>
              <p className="text-gray-400 text-xs mt-0.5">Enter by subject</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0"/>
          </Link>

          <Link to="/sms/bulletins"
            className="group flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-violet-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">Report Cards</p>
              <p className="text-gray-400 text-xs mt-0.5">View bulletins</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all shrink-0"/>
          </Link>
        </div>

        {/* ── Enter Marks by Term ───────────────────────── */}
        {entryTerms.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
              <div className="w-7 h-7 rounded-lg bg-[#0a2156]/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#0a2156]"/>
              </div>
              <p className="font-bold text-gray-900 text-sm">Enter Marks by Term</p>
            </div>

            <div className="p-4 grid grid-cols-3 gap-3">
              {entryTerms.map(t => {
                const m = TERM_META[t.number] || TERM_META[1];
                return (
                  <Link key={t.id} to="/sms/marks"
                    className={`relative flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md
                      ${t.is_current
                        ? `bg-gradient-to-br ${m.color} border-transparent text-white shadow-sm`
                        : `bg-white ${m.light} hover:shadow-sm`}`}>

                    {/* Current badge */}
                    {t.is_current && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full">
                        Active
                      </span>
                    )}

                    {/* Term number circle */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                      ${t.is_current ? 'bg-white/20 text-white' : m.light + ' border-0'}`}>
                      {t.number}
                    </div>

                    <p className={`font-bold text-sm ${t.is_current ? 'text-white' : ''}`}>{t.name}</p>
                    <span className={`flex items-center gap-1 text-xs font-semibold
                      ${t.is_current ? 'text-white/80' : 'text-gray-400'}`}>
                      <PenLine className="w-3 h-3"/> Enter marks
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── My Classes ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Layers className="w-4 h-4 text-blue-600"/>
              </div>
              <p className="font-bold text-gray-900 text-sm">My Classes</p>
            </div>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
              {classes.length} class{classes.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse"/>)}
            </div>
          ) : classes.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6 text-gray-300"/>
              </div>
              <p className="font-semibold text-gray-500 text-sm">No classes assigned</p>
              <p className="text-xs text-gray-400 mt-1">Contact Director of Studies</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {classes.map((cls, idx) => {
                const count = students.filter(s => s.current_class_id === cls.id).length;
                const colors = [
                  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
                  'bg-amber-500', 'bg-rose-600', 'bg-sky-600',
                ];
                const bg = colors[idx % colors.length];
                return (
                  <div key={cls.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">

                    {/* Class avatar */}
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {(cls.name || '?').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-tight">{cls.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className={`inline-flex items-center gap-1 font-semibold ${count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          <Users className="w-3 h-3"/> {count} student{count !== 1 ? 's' : ''}
                        </span>
                        {cls.level && <span className="ml-2 text-gray-400">· {cls.level}</span>}
                        {cls.academic_year?.name && <span className="ml-2 text-gray-400">· {cls.academic_year.name}</span>}
                      </p>
                    </div>

                    {/* Marks button */}
                    <Link to="/sms/marks"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2156] text-white text-xs font-bold hover:bg-[#0c2a6a] transition-colors shadow-sm opacity-0 group-hover:opacity-100">
                      <PenLine className="w-3 h-3"/> Marks
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
