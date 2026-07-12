import React, { useState, useEffect } from 'react';
import {
  Download, Star, RefreshCw, GraduationCap, Users,
  ChevronDown, FileSpreadsheet, Printer, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getAcademicYears, getSmsStudents, getBulletins, downloadBlob } from '../../api';

const SMS = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL?.replace('/api', '/api/sms') ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://photographicsoftware-1.onrender.com/api/sms'
      : '/api/sms'),
  timeout: 120000,
});
SMS.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

async function fetchPDF(endpoint, body) {
  const res = await SMS.post(endpoint, body, { responseType: 'arraybuffer' });
  const b = new Uint8Array(res.data).slice(0, 4);
  const header = String.fromCharCode(...b);
  if (header !== '%PDF') {
    const text = new TextDecoder().decode(res.data);
    let msg = 'Server error';
    try { msg = JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  return new Blob([res.data], { type: 'application/pdf' });
}

const TERM_BTN = {
  1: { sel: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200',   unsel: 'bg-white text-blue-700 border-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-600' },
  2: { sel: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200', unsel: 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-600' },
  3: { sel: 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200',    unsel: 'bg-white text-violet-700 border-violet-300 hover:bg-violet-600 hover:text-white hover:border-violet-600' },
  4: { sel: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200',       unsel: 'bg-white text-amber-600 border-amber-300 hover:bg-amber-500 hover:text-white hover:border-amber-500' },
};

const SEL = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm';

export default function SmsBulletins() {
  const [classes,   setClasses]   = useState([]);
  const [terms,     setTerms]     = useState([]);
  const [years,     setYears]     = useState([]);
  const [students,  setStudents]  = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [selClass,  setSelClass]  = useState('');
  const [selTerm,   setSelTerm]   = useState('');
  const [selYear,   setSelYear]   = useState('');
  const [genAll,    setGenAll]    = useState(false);
  const [genOne,    setGenOne]    = useState('');
  const [genAnnual, setGenAnnual] = useState(false);
  const [remarks,   setRemarks]   = useState({ teacher: '', head: '', conduct: 'Good' });
  const [loading,   setLoading]   = useState(true);
  const [showRemarks, setShowRemarks] = useState(false);

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getAcademicYears()])
      .then(([c, t, y]) => {
        setClasses(c.data.data || []);
        setTerms(t.data.data   || []);
        const yrs = y.data.data || [];
        setYears(yrs);
        const cur = yrs.find(yr => yr.is_current);
        if (cur) setSelYear(cur.id);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selClass) getSmsStudents({ class_id: selClass }).then(r => setStudents(r.data.data || []));
    else setStudents([]);
  }, [selClass]);

  useEffect(() => {
    if (selClass && selTerm)
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    else setBulletins([]);
  }, [selClass, selTerm]);

  const selectedTerm  = terms.find(t => t.id === selTerm);
  const isAnnual      = selectedTerm?.number === 4;
  const filteredTerms = terms.filter(t => !selYear || t.academic_year_id === selYear).sort((a, b) => a.number - b.number);
  const selectedClass = classes.find(c => c.id === selClass);
  const ready         = selClass && selTerm && selYear;

  const handleGenerateAll = async () => {
    if (!ready) { toast.error('Select class, term and year'); return; }
    setGenAll(true);
    try {
      const blob = await fetchPDF('/bulletins/generate-class', {
        term_id: selTerm, class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      downloadBlob(blob, `${selectedClass?.name || 'class'}_${selectedTerm?.name || 'term'}_bulletins.pdf`);
      toast.success(`✅ ${students.length} bulletins downloaded!`);
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    } catch (err) { toast.error(err.message || 'Failed', { duration: 6000 }); }
    finally { setGenAll(false); }
  };

  const handleGenerateOne = async (student) => {
    if (!selTerm || !selYear) { toast.error('Select term and year first'); return; }
    setGenOne(student.id);
    try {
      const blob = await fetchPDF('/bulletins/generate', {
        student_id: student.id, term_id: selTerm, class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      downloadBlob(blob, `${student.student_id || student.id}_bulletin.pdf`);
      toast.success('✅ Downloaded!');
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setGenOne(''); }
  };

  const handleGenerateAnnual = async () => {
    if (!selClass || !selYear) { toast.error('Select class and year first'); return; }
    setGenAnnual(true);
    try {
      const res = await SMS.get('/excel/annual-report', {
        params: { class_id: selClass, academic_year_id: selYear },
        responseType: 'arraybuffer',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `${selectedClass?.name || 'class'}_annual_report.xlsx`);
      toast.success('✅ Annual Report downloaded!');
    } catch (err) { toast.error(err?.message || 'Failed', { duration: 6000 }); }
    finally { setGenAnnual(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Report Cards</h1>
              <p className="text-gray-400 text-xs">Generate & print bulletins per class</p>
            </div>
          </div>
          {ready && students.length > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-600 text-white rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm">
              <Users className="w-3.5 h-3.5" />
              {students.length} students
            </div>
          )}
        </div>

        {/* ── Main config card ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

          {/* Row 1 — Class + Year ──────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 pb-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Class</label>
              <div className="relative">
                <select value={selClass} onChange={e => setSelClass(e.target.value)} className={SEL}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Academic Year</label>
              <div className="relative">
                <select value={selYear} onChange={e => setSelYear(e.target.value)} className={SEL}>
                  <option value="">— Select Year —</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2 — Term buttons ──────────────────────────── */}
          <div className="px-5 pb-5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Term</label>
            {filteredTerms.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No terms — create them in Classes &amp; Years</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTerms.map(t => {
                  const s  = TERM_BTN[t.number] || TERM_BTN[1];
                  const on = selTerm === t.id;
                  return (
                    <button key={t.id} onClick={() => setSelTerm(t.id)}
                      className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${on ? s.sel : s.unsel}`}>
                      {t.number === 4 && <Star className="w-3.5 h-3.5" />}
                      {t.name}
                      {t.is_current && <span className={`w-2 h-2 rounded-full ${on ? 'bg-white/70' : 'bg-green-500'}`} />}
                    </button>
                  );
                })}
              </div>
            )}
            {isAnnual && (
              <p className="mt-2.5 text-xs text-amber-600 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Annual = average of Term 1 + Term 2 + Term 3
              </p>
            )}
          </div>

          {/* Row 3 — Remarks toggle ────────────────────────── */}
          <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Remarks &amp; Conduct <span className="italic">(optional)</span></span>
            <button onClick={() => setShowRemarks(v => !v)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              {showRemarks ? 'Hide' : 'Add remarks'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRemarks ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showRemarks && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 pb-5 pt-1 border-t border-gray-50">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Teacher Remarks</label>
                <input value={remarks.teacher} onChange={e => setRemarks(r => ({ ...r, teacher: e.target.value }))}
                  placeholder="e.g. Good progress"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Head Teacher Remarks</label>
                <input value={remarks.head} onChange={e => setRemarks(r => ({ ...r, head: e.target.value }))}
                  placeholder="e.g. Keep it up"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Conduct</label>
                <div className="relative">
                  <select value={remarks.conduct} onChange={e => setRemarks(r => ({ ...r, conduct: e.target.value }))}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    {['Excellent','Very Good','Good','Fair','Poor'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Action buttons ────────────────────────────────── */}
        {ready && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={handleGenerateAll} disabled={genAll}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#0a2156] hover:bg-[#0c2a6a] disabled:opacity-60 text-white transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                {genAll ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Printer className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className="font-bold text-sm leading-tight">Print All Bulletins</p>
                <p className="text-blue-200 text-xs mt-0.5">
                  {genAll ? 'Generating PDF…' : `${selectedTerm?.name} · ${students.length} students · PDF`}
                </p>
              </div>
            </button>

            <button onClick={handleGenerateAnnual} disabled={genAnnual}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                {genAnnual ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className="font-bold text-sm leading-tight">Annual Progressive Report</p>
                <p className="text-emerald-200 text-xs mt-0.5">
                  {genAnnual ? 'Generating…' : 'T1 + T2 + T3 average · Excel'}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── Students list ─────────────────────────────────── */}
        {students.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* List header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <span className="font-bold text-gray-900 text-sm">{selectedClass?.name}</span>
                  {selectedTerm && <span className="text-gray-400 text-xs ml-1.5">· {selectedTerm.name} · {students.length} students</span>}
                </div>
              </div>
              <button onClick={() => getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []))}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-blue-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-blue-50">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Column header */}
            <div className="grid grid-cols-[28px_36px_1fr_90px_80px] gap-2 items-center px-5 py-2 bg-gray-50/80 border-b border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase">#</span>
              <span />
              <span className="text-[10px] font-bold text-gray-400 uppercase">Student</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Result</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Print</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {students.map((st, idx) => {
                const b     = bulletins.find(bul => bul.student_id === st.id);
                const isGen = genOne === st.id;
                return (
                  <div key={st.id}
                    className="grid grid-cols-[28px_36px_1fr_90px_80px] gap-2 items-center px-5 py-2.5 hover:bg-blue-50/20 transition-colors group">

                    <span className="text-xs font-bold text-gray-300">{idx + 1}</span>

                    <div className="w-8 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 shrink-0">
                      {st.photo_url
                        ? <img src={st.photo_url} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 font-bold text-xs">
                            {(st.first_name || '?').charAt(0)}
                          </div>}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                        {(st.last_name || '').toUpperCase()} {st.first_name}
                      </p>
                      <p className="text-[10px] text-gray-400">{st.student_id}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                      {b ? (
                        <>
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-0.5">
                            {b.percentage?.toFixed(1)}%
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">#{b.rank_in_class}/{b.class_size}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-300 border border-dashed border-gray-200 rounded-lg px-2 py-0.5">—</span>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <button onClick={() => handleGenerateOne(st)}
                        disabled={!selTerm || !selYear || !!genOne}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-xs font-bold disabled:opacity-40 transition-all shadow-sm opacity-0 group-hover:opacity-100">
                        {isGen
                          ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Download className="w-3 h-3" />}
                        PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!selClass && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-7 h-7 text-blue-400" />
            </div>
            <p className="font-bold text-gray-700">Select a class to get started</p>
            <p className="text-gray-400 text-sm mt-1">Choose class, year and term — then download report cards</p>
          </div>
        )}

      </div>
    </div>
  );
}
