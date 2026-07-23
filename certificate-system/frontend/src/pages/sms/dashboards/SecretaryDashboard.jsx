import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, FileText, Folder, Download, ArrowRight, Printer } from 'lucide-react';
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
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');
  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');

  useEffect(() => {
    Promise.all([getSmsStudents(), getSmsClasses(), getTerms()])
      .then(([s, c, t]) => {
        setStudents(s.data.data || []);
        setClasses(c.data.data  || []);
        setTerms((t.data.data   || []).filter(x => x.number !== 4));
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handlePrintAll = async () => {
    if (!selClass || !selTerm) { toast.error('Select class and term first'); return; }
    setGenAll(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t  => t.id === selTerm);
      const res = await generateClassBulletins({ class_id: selClass, term_id: selTerm, academic_year_id: cls?.academic_year_id || '' });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `${cls?.name}_${trm?.name}_bulletins.pdf`);
      toast.success('All bulletins downloaded!');
    } catch { toast.error('Failed to generate bulletins'); }
    finally { setGenAll(false); }
  };

  const SEL = 'w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Secretary Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">{staff.full_name} · {school.school_name}</p>
          </div>
          <Link to="/sms/students" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a2156] text-white text-sm font-bold hover:bg-[#0c2a6a] transition-colors shadow-sm">
            <UserPlus className="w-4 h-4"/> Register Student
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label:'Students',  value:loading?'—':students.length, sub:'registered' },
            { label:'Classes',   value:loading?'—':classes.length,  sub:'active' },
            { label:'Terms',     value:loading?'—':terms.length,    sub:'this year' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{s.label}</p>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-2">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { to:'/sms/students',  icon:UserPlus, color:'bg-[#0a2156]', label:'Student Registration', desc:'Register & manage students' },
            { to:'/sms/bulletins', icon:FileText, color:'bg-violet-600',label:'Print Bulletins',      desc:'Generate term report cards' },
            { to:'/sms/documents', icon:Folder,   color:'bg-emerald-600',label:'School Documents',   desc:'Upload & organise school files' },
            { to:'/sms/students',  icon:Users,    color:'bg-amber-600',  label:'Student List',       desc:'View all registered students' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5 text-white"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-all"/>
              </Link>
            );
          })}
        </div>

        {/* Quick print */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <Printer className="w-4 h-4 text-gray-500"/>
            <h2 className="font-semibold text-gray-900">Quick Print — All Bulletins</h2>
          </div>
          <div className="p-5">
            <p className="text-xs text-gray-400 mb-4">Select a class and term to download all bulletins as a PDF</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-36">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Class</label>
                <select className={SEL} value={selClass} onChange={e => setSelClass(e.target.value)}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-36">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Term</label>
                <select className={SEL} value={selTerm} onChange={e => setSelTerm(e.target.value)}>
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

      </div>
    </div>
  );
}
