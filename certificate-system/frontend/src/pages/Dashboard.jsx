import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Award, Printer, Upload, Search,
  TrendingUp, GraduationCap, Calendar, School
} from 'lucide-react';
import { getStudents, getCertificates } from '../api';
import { useAuth } from '../context/AuthContext';

const CLASS_THEME = {
  'Top Class': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', bar: 'bg-amber-500' },
  'P6':        { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-800',  bar: 'bg-blue-500' },
  'S3':        { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', bar: 'bg-green-500' },
  'S6':        { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800',   bar: 'bg-red-500' },
  'Nursery':   { bg: 'bg-purple-50',border: 'border-purple-200',text: 'text-purple-800',bar: 'bg-purple-500' },
  'Graduation':{ bg: 'bg-orange-50',border: 'border-orange-200',text: 'text-orange-800',bar: 'bg-orange-500' },
};

export default function Dashboard() {
  const { school } = useAuth();
  const [students, setStudents] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStudents(), getCertificates()])
      .then(([sRes, cRes]) => {
        setStudents(sRes.data.data || []);
        setCertificates(cRes.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const byClass = students.reduce((acc, s) => {
    acc[s.class] = (acc[s.class] || 0) + 1;
    return acc;
  }, {});

  const withPhotos = students.filter((s) => s.photo_url).length;
  const withoutPhotos = students.length - withPhotos;

  const stats = [
    { label: 'Total Students', value: students.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Certificates Generated', value: certificates.length, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Classes', value: Object.keys(byClass).length, icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
    { label: 'Active Year', value: school?.active_year || '—', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* School header */}
      <div className="flex items-center gap-4">
        {school?.logo_url ? (
          <img src={school.logo_url} alt="Logo" className="w-14 h-14 rounded-xl object-contain border border-gray-100 bg-white p-1 shadow-sm" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <School className="w-7 h-7 text-white" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{school?.school_name || 'Dashboard'}</h1>
          <p className="text-gray-400 text-sm mt-0.5">Academic Year {school?.active_year} · Overview</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`card border ${s.border} flex items-center gap-4 py-4`}>
              <div className={`${s.bg} p-3 rounded-xl`}>
                <Icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : s.value}</p>
                <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/upload', icon: Upload, label: 'Upload Students', bg: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
            { to: '/search', icon: Search, label: 'Search Student', bg: 'bg-green-50 hover:bg-green-100 text-green-700' },
            { to: '/generate', icon: Award, label: 'Generate Certificate', bg: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
            { to: '/print-all', icon: Printer, label: 'Print All', bg: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
          ].map(({ to, icon: Icon, label, bg }) => (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl ${bg} transition-colors`}>
              <Icon className="w-6 h-6" />
              <span className="text-sm font-medium text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by class — bar chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Students by Class</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{students.length} total</span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : Object.keys(byClass).length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No students yet.</p>
              <Link to="/upload" className="text-blue-600 text-sm hover:underline mt-1 inline-block">Upload students →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
                const theme = CLASS_THEME[cls] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', bar: 'bg-gray-400' };
                const pct = Math.round((count / students.length) * 100);
                return (
                  <div key={cls} className={`${theme.bg} border ${theme.border} rounded-xl px-4 py-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${theme.text}`}>{cls}</span>
                      <span className={`text-sm font-bold ${theme.text}`}>{count} <span className="font-normal text-xs">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                      <div className={`${theme.bar} h-2 rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Photo coverage */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Photo Coverage</h2>
            {loading ? (
              <div className="h-16 bg-gray-100 rounded animate-pulse" />
            ) : students.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No data</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> With Photo
                  </span>
                  <span className="font-semibold text-green-700">{withPhotos}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-700"
                    style={{ width: students.length ? `${(withPhotos / students.length) * 100}%` : '0%' }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /> No Photo
                  </span>
                  <span className="font-semibold text-gray-500">{withoutPhotos}</span>
                </div>
              </div>
            )}
          </div>

          {/* Recent certificates */}
          <div className="card flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Recent Certificates</h2>
              <Link to="/generate" className="text-xs text-blue-600 hover:underline">Generate →</Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : certificates.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No certificates yet</p>
            ) : (
              <div className="space-y-2">
                {certificates.slice(0, 6).map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {cert.students?.first_name} {cert.students?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {cert.template} · #{cert.students?.photo_number}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(cert.generated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
