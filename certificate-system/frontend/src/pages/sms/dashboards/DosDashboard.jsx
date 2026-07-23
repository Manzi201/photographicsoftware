import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, FileText, TrendingUp, Layers, ArrowRight, Eye, Calendar, Plus } from 'lucide-react';
import { getSmsStudentStats, getSmsClasses, getTerms } from '../../../api';

const NAV = [
  { to:'/sms/classes',   icon:Layers,     label:'Classes & Years',  desc:'Subjects, teachers, assignments' },
  { to:'/sms/timetable', icon:Calendar,   label:'Timetable',        desc:'Class & teacher schedules' },
  { to:'/sms/students',  icon:Users,      label:'Students',         desc:'View & manage students' },
  { to:'/sms/marks',     icon:Eye,        label:'Student Marks',    desc:'View all marks (read-only)' },
  { to:'/sms/bulletins', icon:FileText,   label:'Bulletins',        desc:'Term & annual report cards' },
  { to:'/sms/promotion', icon:TrendingUp, label:'Promotion',        desc:'Promote or repeat students' },
];

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Director of Studies</h1>
          <p className="text-gray-500 text-sm mt-1">{staff.full_name} · {school.school_name} · {school.active_year}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label:'Total Students', value: loading?'—':stats.total||0,        sub:'enrolled',      color:'text-gray-900' },
            { label:'Classes',        value: loading?'—':classes.length,         sub:'active classes', color:'text-gray-900' },
            { label:'Current Term',   value: loading?'—':(currentTerm?.name||'—'), sub:'active term',  color:'text-gray-900' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-2">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Read-only notice */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-8">
          <Eye className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
          <p className="text-sm text-amber-800">
            <span className="font-bold">Read-only on marks.</span>{' '}
            You can view all student marks but cannot enter or edit them — that's the teachers' responsibility.
          </p>
        </div>

        {/* Navigation actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-xl bg-[#0a2156] flex items-center justify-center mb-4">
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

        {/* Classes overview */}
        {classes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Classes Overview</h2>
              <Link to="/sms/classes" className="flex items-center gap-1 text-xs font-bold text-[#0a2156] hover:underline">
                <Plus className="w-3.5 h-3.5"/> Manage
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {classes.slice(0, 6).map(cls => (
                <div key={cls.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cls.level || '—'}{cls.academic_year?.name ? ` · ${cls.academic_year.name}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/sms/marks?class_id=${cls.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                      <Eye className="w-3 h-3"/> Marks
                    </Link>
                    <Link to={`/sms/bulletins?class_id=${cls.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                      <FileText className="w-3 h-3"/> Bulletins
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
