import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Award, Printer, Upload, Search, GraduationCap,
  Calendar, School, ArrowUpRight, BookOpen, Image as ImageIcon,
  CheckCircle2, AlertCircle, TrendingUp, ChevronRight, Settings
} from 'lucide-react';
import { getStudents, getCertificates } from '../api';
import { useAuth } from '../context/AuthContext';

// ── Theme per class ──────────────────────────────────────────
const CLASS_THEME = {
  'Top Class':  { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800',  bar: 'bg-amber-500',  dot: 'bg-amber-400' },
  'P6':         { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',   bar: 'bg-blue-500',   dot: 'bg-blue-400' },
  'S3':         { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800',  bar: 'bg-green-500',  dot: 'bg-green-400' },
  'S6':         { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-800',    bar: 'bg-red-500',    dot: 'bg-red-400' },
  'Nursery':    { bg: 'bg-purple-50', border: 'border-purple-200',text: 'text-purple-800', bar: 'bg-purple-500', dot: 'bg-purple-400' },
  'Graduation': { bg: 'bg-orange-50', border: 'border-orange-200',text: 'text-orange-800', bar: 'bg-orange-500', dot: 'bg-orange-400' },
};
const fallbackTheme = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', bar: 'bg-gray-400', dot: 'bg-gray-400' };

// ── Skeleton loader ───────────────────────────────────────────
const Skeleton = ({ className }) => <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, iconColor, to, loading, suffix }) {
  const content = (
    <div className={`card flex items-center gap-4 py-5 transition-shadow ${to ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className={`${iconBg} p-3 rounded-2xl shrink-0`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        {loading
          ? <Skeleton className="h-7 w-16 mb-1" />
          : <p className="text-2xl font-extrabold text-gray-900 leading-none">
              {value}{suffix && <span className="text-sm font-medium text-gray-400 ml-1">{suffix}</span>}
            </p>}
        <p className="text-xs text-gray-500 mt-1 truncate">{label}</p>
      </div>
      {to && <ArrowUpRight className="w-4 h-4 text-gray-300 shrink-0" />}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

// ── Quick action card ──────────────────────────────────────────
function ActionCard({ to, icon: Icon, label, desc, color, bgColor }) {
  return (
    <Link to={to}
      className={`group flex items-center gap-4 p-4 rounded-2xl border ${bgColor} border-transparent hover:border-current hover:shadow-sm transition-all`}>
      <div className={`w-10 h-10 rounded-xl ${color} bg-white/60 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-gray-500 truncate">{desc}</p>
      </div>
      <ChevronRight className={`w-4 h-4 ${color} opacity-40 ml-auto shrink-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} />
    </Link>
  );
}

export default function Dashboard() {
  const { school } = useAuth();
  const [students,     setStudents]     = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([getStudents(), getCertificates()])
      .then(([sRes, cRes]) => {
        setStudents(sRes.data.data || []);
        setCertificates(cRes.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const byClass     = students.reduce((acc, s) => { acc[s.class] = (acc[s.class] || 0) + 1; return acc; }, {});
  const withPhotos  = students.filter((s) => s.photo_url).length;
  const photoPct    = students.length ? Math.round((withPhotos / students.length) * 100) : 0;
  const isSetupDone = !!(school?.logo_url && school?.signature_url);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO HEADER ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 px-6 pt-8 pb-16 relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-600 rounded-full opacity-20 blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute left-1/3 bottom-0 w-40 h-40 bg-indigo-400 rounded-full opacity-10 blur-2xl" />

        <div className="max-w-7xl mx-auto flex items-start gap-5 relative z-10">
          {/* School logo */}
          <div className="shrink-0">
            {school?.logo_url
              ? <img src={school.logo_url} alt="logo"
                  className="w-16 h-16 rounded-2xl object-contain bg-white p-1 shadow-lg border border-white/20" />
              : <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-lg">
                  <School className="w-8 h-8 text-yellow-400" />
                </div>}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-blue-300 font-medium uppercase tracking-widest">Dashboard</span>
              <span className="text-blue-500">·</span>
              <span className="text-xs text-blue-300">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white truncate">
              {loading ? 'Loading...' : school?.school_name || 'My School'}
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-blue-200 text-sm">
                <Calendar className="w-3.5 h-3.5" /> Year {school?.active_year}
              </span>
              <span className="flex items-center gap-1.5 text-blue-200 text-sm">
                <Users className="w-3.5 h-3.5" /> {loading ? '...' : students.length} students
              </span>
              <span className="flex items-center gap-1.5 text-blue-200 text-sm">
                <GraduationCap className="w-3.5 h-3.5" /> {loading ? '...' : Object.keys(byClass).length} classes
              </span>
            </div>
          </div>

          {/* Settings shortcut */}
          <Link to="/settings"
            className="shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors">
            <Settings className="w-3.5 h-3.5" /> Settings
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT (overlaps hero by negative margin) ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 pb-10 space-y-6 relative z-10">

        {/* ── STATS ROW ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students"        value={students.length}        icon={Users}         iconBg="bg-blue-100"   iconColor="text-blue-600"   to="/search"   loading={loading} />
          <StatCard label="Certificates Issued"   value={certificates.length}   icon={Award}         iconBg="bg-amber-100"  iconColor="text-amber-600"  to="/generate" loading={loading} />
          <StatCard label="Active Classes"        value={Object.keys(byClass).length} icon={BookOpen} iconBg="bg-green-100"  iconColor="text-green-600"  to="/classes"  loading={loading} />
          <StatCard label="Active Year"           value={school?.active_year || '—'} icon={Calendar}  iconBg="bg-purple-100" iconColor="text-purple-600" loading={loading} />
        </div>

        {/* ── SETUP BANNER (shown if school not fully configured) */}
        {!loading && !isSetupDone && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900 text-sm">Complete your school setup</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Upload your school <strong>logo</strong> and <strong>signature</strong> in Settings — they appear on every certificate.
              </p>
            </div>
            <Link to="/settings"
              className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
              Set up now →
            </Link>
          </div>
        )}

        {/* ── QUICK ACTIONS ──────────────────────────────────── */}
        <div className="card !p-5">
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard to="/upload"   icon={Upload}    label="Upload Students"        desc="Add individually or import CSV"   color="text-blue-700"   bgColor="bg-blue-50" />
            <ActionCard to="/search"   icon={Search}    label="Search Student"         desc="Find by name or photo number"    color="text-teal-700"   bgColor="bg-teal-50" />
            <ActionCard to="/generate" icon={Award}     label="Generate Certificate"   desc="Single certificate with preview" color="text-amber-700"  bgColor="bg-amber-50" />
            <ActionCard to="/print-all"icon={Printer}   label="Batch Print All"        desc="Download PDF for entire class"   color="text-purple-700" bgColor="bg-purple-50" />
          </div>
        </div>

        {/* ── TWO COLUMN LAYOUT ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Students by class */}
          <div className="card !p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800">Students by Class</h2>
              {students.length > 0 && (
                <Link to="/classes" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  Manage <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : Object.keys(byClass).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-gray-300" />
                </div>
                <div className="text-center">
                  <p className="text-gray-600 font-medium text-sm">No students yet</p>
                  <p className="text-gray-400 text-xs mt-0.5">Start by uploading your first student list</p>
                </div>
                <Link to="/upload"
                  className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium">
                  Upload Students →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
                  const theme = CLASS_THEME[cls] || fallbackTheme;
                  const pct   = Math.round((count / students.length) * 100);
                  return (
                    <div key={cls} className={`${theme.bg} border ${theme.border} rounded-xl px-4 py-3`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dot}`} />
                        <span className={`text-sm font-bold ${theme.text} flex-1`}>{cls}</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{count}</span>
                        <span className="text-xs text-gray-400">({pct}%)</span>
                      </div>
                      <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden">
                        <div className={`${theme.bar} h-2 rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {/* Total row */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Total</span>
                  <span className="text-sm font-bold text-gray-700">{students.length} students</span>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Photo coverage */}
            <div className="card !p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-400" /> Photo Coverage
                </h2>
                {!loading && students.length > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    photoPct === 100 ? 'bg-green-100 text-green-700'
                    : photoPct > 50  ? 'bg-blue-100 text-blue-700'
                    :                  'bg-red-100 text-red-700'
                  }`}>{photoPct}%</span>
                )}
              </div>

              {loading ? <Skeleton className="h-16" />
               : students.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">No data yet</p>
               : (
                <div className="space-y-3">
                  {/* Big progress bar */}
                  <div>
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-4 rounded-full transition-all duration-1000 ${
                        photoPct === 100 ? 'bg-gradient-to-r from-green-400 to-green-600'
                        : photoPct > 50  ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                        :                  'bg-gradient-to-r from-red-400 to-orange-500'
                      }`} style={{ width: `${photoPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> With Photo
                    </span>
                    <span className="font-bold text-green-700">{withPhotos} / {students.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-500">
                      <AlertCircle className="w-4 h-4 text-gray-400" /> Missing Photo
                    </span>
                    <span className="font-semibold text-gray-500">{students.length - withPhotos}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Recent certificates */}
            <div className="card !p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" /> Recent Certificates
                </h2>
                <Link to="/generate" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  Generate <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : certificates.length === 0 ? (
                <div className="text-center py-6">
                  <Award className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No certificates yet</p>
                  <Link to="/generate"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    Generate first certificate →
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {certificates.slice(0, 7).map((cert) => (
                    <div key={cert.id}
                      className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-1 -mx-1 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {cert.students?.first_name} {cert.students?.last_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {cert.template} · #{cert.students?.photo_number}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">
                        {new Date(cert.generated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  ))}
                  {certificates.length > 7 && (
                    <p className="text-xs text-gray-400 text-center pt-2">
                      +{certificates.length - 7} more certificates
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
