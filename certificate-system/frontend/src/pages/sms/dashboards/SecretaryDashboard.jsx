import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, FileText, Folder, Download,
  ArrowRight, GraduationCap, CheckCircle2, AlertCircle, Printer
} from 'lucide-react';
import { getSmsStudents, getSmsClasses, getTerms, generateClassBulletins, downloadBlob } from '../../../api';
import toast from 'react-hot-toast';

export default function SecretaryDashboard() {
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selClass, setSelClass] = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [genAll,   setGenAll]   = useState(false);

  const school   = JSON.parse(localStorage.getItem('staff_school') || '{}');
  const staff    = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const initials = (staff.full_name || 'S').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    Promise.all([getSmsStudents(), getSmsClasses(), getTerms()])
      .then(([s, c, t]) => {
        setStudents(s.data.data || []);
        setClasses(c.data.data  || []);
        setTerms((t.data.data   || []).filter(x => x.number !== 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePrintAll = async () => {
    if (!selClass || !selTerm) { toast.error('Select class and term first'); return; }
    setGenAll(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t  => t.id === selTerm);
      const res = await generateClassBulletins({
        class_id: selClass, term_id: selTerm,
        academic_year_id: cls?.academic_year_id || '',
      });
      downloadBlob(
        new Blob([res.data], { type: 'application/pdf' }),
        `${cls?.name}_${trm?.name}_bulletins.pdf`
      );
      toast.success('All bulletins downloaded!');
    } catch { toast.error('Failed to generate bulletins'); }
    finally { setGenAll(false); }
  };

  const paid    = students.filter(s => s.fee_status === 'paid').length;
  const issues  = students.filter(s => s.fee_status !== 'paid').length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Header card ─────────────────────────────────── */}
        <div className="bg-[#0a2156] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-lg font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Secretary Dashboard</p>
              <h1 className="text-xl font-bold text-white truncate">{staff.full_name || 'Secretary'}</h1>
              <p className="text-blue-200 text-xs mt-0.5 truncate">{school.school_name} · {school.active_year}</p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Students',    value: loading ? '…' : students.length },
              { label: 'Classes',     value: loading ? '…' : classes.length  },
              { label: 'Fee Issues',  value: loading ? '…' : issues           },
            ].map(s => (
              <div key={s.label} className="bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-white leading-tight">{s.value}</p>
                <p className="text-blue-200 text-[11px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { to:'/sms/students',  icon: UserPlus,      color:'bg-blue-600',   label:'Student Registration', desc:'Register & manage students' },
            { to:'/sms/bulletins', icon: FileText,       color:'bg-violet-600', label:'Print Bulletins',      desc:'Generate term report cards' },
            { to:'/sms/documents', icon: Folder,         color:'bg-emerald-600',label:'School Documents',     desc:'Upload & organise school files' },
            { to:'/sms/students',  icon: Users,          color:'bg-amber-600',  label:'Student List',         desc:'View all registered students' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to}
                className="group flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5 text-white"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0"/>
              </Link>
            );
          })}
        </div>

        {/* ── Quick print bulletins ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Printer className="w-4 h-4 text-violet-600"/>
            </div>
            <p className="font-bold text-gray-900 text-sm">Quick Print — All Bulletins for a Class</p>
          </div>
          <div className="p-5">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-36">
                <select className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
                  value={selClass} onChange={e => setSelClass(e.target.value)}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="relative flex-1 min-w-36">
                <select className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
                  value={selTerm} onChange={e => setSelTerm(e.target.value)}>
                  <option value="">— Select Term —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button onClick={handlePrintAll} disabled={genAll || !selClass || !selTerm}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap">
                {genAll
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating…</>
                  : <><Download className="w-4 h-4"/> Download PDFs</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Fee summary ───────────────────────────────── */}
        {!loading && students.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Fees Paid</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{paid}</p>
              <p className="text-xs text-emerald-500 mt-0.5">
                {students.length > 0 ? Math.round((paid/students.length)*100) : 0}% of students
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600"/>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Fee Issues</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{issues}</p>
              <p className="text-xs text-amber-500 mt-0.5">
                {students.filter(s=>s.fee_status==='partial').length} partial ·{' '}
                {students.filter(s=>s.fee_status==='unpaid').length} unpaid
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
