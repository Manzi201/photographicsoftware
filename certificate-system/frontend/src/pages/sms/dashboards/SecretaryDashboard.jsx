import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Upload, Search, Award, Printer,
  FileText, Folder, GraduationCap, Download, ArrowUpRight
} from 'lucide-react';
import { getSmsStudents, getSmsClasses, getTerms, generateClassBulletins, downloadBlob } from '../../../api';
import toast from 'react-hot-toast';

// Mirrors the Secretary sidebar sections
const SECTIONS = [
  {
    title: 'Students',
    color: 'blue',
    items: [
      { to: '/sms/students', icon: UserPlus, label: 'Registration',      desc: 'Register & manage students' },
      { to: '/upload',       icon: Upload,   label: 'Upload Photos/CSV', desc: 'Batch upload photos or CSV' },
      { to: '/search',       icon: Search,   label: 'Search Student',    desc: 'Find student by name or ID' },
    ],
  },
  {
    title: 'Certificates',
    color: 'amber',
    items: [
      { to: '/generate',            icon: Award,         label: 'Generate Certificate', desc: 'Print individual certificate' },
      { to: '/print-all',           icon: Printer,       label: 'Print All',            desc: 'Batch print by class' },
      { to: '/templates/Top Class', icon: GraduationCap, label: 'Top Class',            desc: 'Top class template' },
      { to: '/templates/P6',        icon: GraduationCap, label: 'P6',                   desc: 'Primary 6 template' },
      { to: '/templates/S3',        icon: GraduationCap, label: 'S3',                   desc: 'Senior 3 template' },
      { to: '/templates/S6',        icon: GraduationCap, label: 'S6',                   desc: 'Senior 6 template' },
    ],
  },
  {
    title: 'Report Cards',
    color: 'purple',
    items: [
      { to: '/sms/bulletins', icon: FileText, label: 'Print Bulletins', desc: 'Generate & download report cards' },
    ],
  },
  {
    title: 'Documents',
    color: 'green',
    items: [
      { to: '/sms/documents', icon: Folder, label: 'School Documents', desc: 'Upload & organise school files' },
    ],
  },
];

const SECTION_STYLES = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   head: 'text-blue-700',   icon: 'bg-blue-100 text-blue-600' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-100',  head: 'text-amber-700',  icon: 'bg-amber-100 text-amber-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-100', head: 'text-purple-700', icon: 'bg-purple-100 text-purple-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-100',  head: 'text-green-700',  icon: 'bg-green-100 text-green-600' },
};

export default function SecretaryDashboard() {
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selClass, setSelClass] = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [genAll,   setGenAll]   = useState(false);

  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');
  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');

  useEffect(() => {
    Promise.all([getSmsStudents(), getSmsClasses(), getTerms()])
      .then(([s, c, t]) => {
        setStudents(s.data.data || []);
        setClasses(c.data.data  || []);
        setTerms(t.data.data    || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePrintAll = async () => {
    if (!selClass || !selTerm) { toast.error('Select class and term first'); return; }
    setGenAll(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      const res = await generateClassBulletins({ class_id: selClass, term_id: selTerm, academic_year_id: cls?.academic_year_id || '' });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `${cls?.name}_${trm?.name}_bulletins.pdf`);
      toast.success('All bulletins downloaded!');
    } catch { toast.error('Failed to generate bulletins'); }
    finally { setGenAll(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-green-800 via-teal-700 to-green-700 rounded-2xl p-5 sm:p-6 text-white">
        <p className="text-green-300 text-xs font-semibold uppercase tracking-wider">Secretary Dashboard</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{school.school_name || 'School'}</h1>
        <p className="text-green-200 text-sm mt-0.5">Welcome, {staff.full_name} · Year {school.active_year}</p>
      </div>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Students', value: students.length,  color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: 'Classes',        value: classes.length,   color: 'text-teal-700',  bg: 'bg-teal-50' },
          { label: 'Fee Issues',     value: students.filter(s => s.fee_status !== 'paid').length, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white px-4 py-4 shadow-sm text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '…' : s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick print all bulletins ─────────────────────── */}
      <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4 sm:p-5">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4"/> Quick: Print All Bulletins for a Class
        </h3>
        <div className="flex gap-3 flex-wrap">
          <select className="select-field flex-1 min-w-36 text-sm" value={selClass} onChange={e => setSelClass(e.target.value)}>
            <option value="">— Class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select-field flex-1 min-w-36 text-sm" value={selTerm} onChange={e => setSelTerm(e.target.value)}>
            <option value="">— Term —</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={handlePrintAll} disabled={genAll || !selClass || !selTerm}
            className="btn-primary text-sm whitespace-nowrap">
            {genAll ? 'Generating…' : <><Download className="w-4 h-4"/> Download PDFs</>}
          </button>
        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
    </div>
  );
}
