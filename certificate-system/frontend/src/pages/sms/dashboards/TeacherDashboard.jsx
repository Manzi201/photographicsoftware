import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Users, Layers, ArrowRight, PenLine, GraduationCap, Calendar } from 'lucide-react';
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
        setClasses(c.data.data || []);
        setTerms(t.data.data   || []);
        setStudents(s.data.data|| []);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const currentTerm = terms.find(t => t.is_current);
  const entryTerms  = terms.filter(t => t.number !== 4).sort((a, b) => a.number - b.number);
  const TERM_COLOR  = { 1:'bg-blue-600', 2:'bg-emerald-600', 3:'bg-violet-600' };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{staff.full_name} · {school.school_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label:'My Classes',   value:loading?'—':classes.length,              sub:'assigned to you' },
            { label:'Students',     value:loading?'—':students.length,             sub:'in my classes' },
            { label:'Active Term',  value:loading?'—':(currentTerm?.name || '—'),  sub:school.active_year||'' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{s.label}</p>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-2">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { to:'/sms/marks',     icon:PenLine,      color:'bg-[#0a2156]', label:'Enter Marks',   desc:'Enter marks per subject' },
            { to:'/sms/bulletins', icon:GraduationCap,color:'bg-violet-600',label:'Report Cards',  desc:'View term bulletins' },
            { to:'/sms/timetable', icon:Calendar,     color:'bg-sky-600',   label:'My Timetable',  desc:'View your schedule' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5 text-white"/>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                <div className="flex items-center gap-1 text-xs font-bold text-[#0a2156] mt-4 group-hover:gap-1.5 transition-all">
                  Open <ArrowRight className="w-3.5 h-3.5"/>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Enter marks by term */}
        {entryTerms.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Enter Marks by Term</h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              {entryTerms.map(t => {
                const bg = TERM_COLOR[t.number] || 'bg-gray-600';
                const isActive = t.is_current;
                return (
                  <Link key={t.id} to="/sms/marks"
                    className={`relative flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-xl border-2 transition-all hover:shadow-sm
                      ${isActive ? 'border-[#0a2156] bg-[#0a2156]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    {isActive && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">Active</span>
                    )}
                    <div className={`w-10 h-10 rounded-xl ${isActive ? 'bg-white/20' : bg} flex items-center justify-center`}>
                      <span className={`text-lg font-bold ${isActive ? 'text-white' : 'text-white'}`}>{t.number}</span>
                    </div>
                    <p className={`font-bold text-sm ${isActive ? 'text-white' : 'text-gray-900'}`}>{t.name}</p>
                    <p className={`text-xs flex items-center gap-1 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                      <PenLine className="w-3 h-3"/> Enter marks
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* My classes list */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">My Classes</h2>
            <span className="text-xs text-gray-400">{classes.length} class{classes.length !== 1 ? 'es' : ''}</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse"/>)}</div>
          ) : classes.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30"/>
              <p className="text-sm font-medium">No classes assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {classes.map(cls => {
                const count = students.filter(s => s.current_class_id === cls.id).length;
                return (
                  <div key={cls.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-[#0a2156] flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(cls.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {count} student{count !== 1 ? 's' : ''}
                        {cls.level && ` · ${cls.level}`}
                      </p>
                    </div>
                    <Link to="/sms/marks"
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2156] text-white text-xs font-bold transition-all">
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
