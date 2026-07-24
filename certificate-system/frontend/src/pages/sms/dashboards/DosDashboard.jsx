import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, FileText, TrendingUp, Layers, Eye,
  Calendar, ArrowRight, Clock
} from 'lucide-react';
import { getSmsStudentStats, getSmsClasses, getTerms } from '../../../api';

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, label, value, sub, trend }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className="w-7 h-7 text-white"/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        {trend && (
          <p className={`text-xs font-semibold mt-1 ${trend.up ? 'text-emerald-600' : 'text-gray-400'}`}>
            {trend.up ? '↑' : '→'} {trend.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Action card ───────────────────────────────────────────────
function ActionCard({ to, icon: Icon, iconBg, label, desc }) {
  return (
    <Link to={to}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all group">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white"/>
      </div>
      <p className="font-bold text-gray-900 text-sm">{label}</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{desc}</p>
      <div className="flex items-center gap-1 text-xs font-bold text-blue-600 mt-3 group-hover:gap-1.5 transition-all">
        Open <ArrowRight className="w-3.5 h-3.5"/>
      </div>
    </Link>
  );
}

export default function DosDashboard() {
  const [stats,   setStats]   = useState({});
  const [classes, setClasses] = useState([]);
  const [terms,   setTerms]   = useState([]);
  const [loading, setLoading] = useState(true);

  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');

  useEffect(() => {
    Promise.all([getSmsStudentStats(), getSmsClasses(), getTerms()])
      .then(([s, c, t]) => {
        setStats(s.data.data || {});
        setClasses(c.data.data || []);
        setTerms(t.data.data   || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentTerm = terms.find(t => t.is_current);
  const firstName   = (staff.full_name || 'Director').split(' ')[0];

  return (
    <div className="min-h-screen bg-gray-50/60 p-5 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Welcome header ───────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {staff.full_name} &nbsp;·&nbsp; {school.school_name} &nbsp;·&nbsp; {school.active_year}
            </p>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Users} iconBg="bg-blue-500"
            label="Total Students"
            value={loading ? '—' : stats.total || 0}
            sub="enrolled"
            trend={{ up: true, text: 'active this term' }}
          />
          <StatCard
            icon={Layers} iconBg="bg-emerald-500"
            label="Classes"
            value={loading ? '—' : classes.length}
            sub="active classes"
            trend={{ up: false, text: '— 0 change' }}
          />
          <StatCard
            icon={Calendar} iconBg="bg-orange-400"
            label="Current Term"
            value={loading ? '—' : (currentTerm?.name || '—')}
            sub="active term"
            trend={currentTerm?.start_date ? { up: true, text: `${currentTerm.start_date} — ${currentTerm.end_date || '…'}` } : null}
          />
        </div>

        {/* ── Read-only notice ─────────────────────────── */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <Eye className="w-4 h-4 text-amber-600 shrink-0"/>
          <p className="text-sm text-amber-800">
            <span className="font-bold text-amber-900">Read-only on marks.</span>
            {' '}You can view all student marks but cannot enter or edit them — that&apos;s the teachers&apos; responsibility.
          </p>
        </div>

        {/* ── Action cards 3×2 grid ────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard to="/sms/classes"   icon={Layers}     iconBg="bg-violet-500" label="Classes & Years"  desc="View and manage classes, subjects, teachers, assignments" />
          <ActionCard to="/sms/timetable" icon={Calendar}   iconBg="bg-teal-500"   label="Timetable"        desc="View and manage class & teacher schedules" />
          <ActionCard to="/sms/students"  icon={Users}      iconBg="bg-sky-500"    label="Students"         desc="View and manage student records" />
          <ActionCard to="/sms/marks"     icon={BookOpen}   iconBg="bg-amber-500"  label="Student Marks"    desc="View all marks (read-only) by term and subject" />
          <ActionCard to="/sms/bulletins" icon={FileText}   iconBg="bg-blue-500"   label="Bulletins"        desc="View and generate term & annual report cards" />
          <ActionCard to="/sms/promotion" icon={TrendingUp} iconBg="bg-rose-500"   label="Promotion"        desc="Promote or repeat students to next year" />
        </div>

        {/* ── Bottom: Classes overview + Recent ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Classes list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm">Students by Class</h2>
              <Link to="/sms/classes" className="text-xs font-bold text-blue-600 hover:underline">View all</Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse"/>)}</div>
            ) : classes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No classes yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {classes.slice(0, 6).map((cls, i) => {
                  const COLORS = ['bg-blue-500','bg-pink-500','bg-violet-500','bg-orange-400','bg-emerald-500','bg-sky-500'];
                  return (
                    <div key={cls.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLORS[i % COLORS.length]}`}/>
                      <p className="font-semibold text-gray-900 text-sm flex-1">{cls.name}</p>
                      {cls.level && <p className="text-xs text-gray-400">{cls.level}</p>}
                      <Link to={`/sms/marks?class_id=${cls.id}`}
                        className="text-xs text-blue-600 font-semibold hover:underline">Marks</Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent activity placeholder */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm">Quick Links</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { to:'/sms/bulletins', icon:FileText,   color:'text-blue-500',   bg:'bg-blue-50',   label:'Generate Bulletins',    sub:'Download term report cards' },
                { to:'/sms/timetable', icon:Calendar,   color:'text-teal-500',   bg:'bg-teal-50',   label:'View Timetable',         sub:'Class & teacher schedules' },
                { to:'/sms/promotion', icon:TrendingUp, color:'text-rose-500',   bg:'bg-rose-50',   label:'Promotion',              sub:'End-of-year promotions' },
                { to:'/sms/marks',     icon:Eye,        color:'text-amber-500',  bg:'bg-amber-50',  label:'View Marks',             sub:'All classes, all subjects' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${item.color}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.sub}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 group-hover:translate-x-0.5 transition-all"/>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
