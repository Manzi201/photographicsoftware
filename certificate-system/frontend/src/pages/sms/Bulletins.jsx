import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Star, RefreshCw, GraduationCap, Users,
  ChevronDown, CheckCircle, BookOpen, FileSpreadsheet, Printer,
  ChevronRight, BarChart2
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

// ── Term colour tokens ────────────────────────────────────────
const TERM_STYLE = {
  1: { active: 'bg-blue-600 border-blue-600 text-white shadow-blue-200',    idle: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'   },
  2: { active: 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200', idle: 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' },
  3: { active: 'bg-violet-600 border-violet-600 text-white shadow-violet-200',    idle: 'border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100'   },
  4: { active: 'bg-amber-500 border-amber-500 text-white shadow-amber-200',       idle: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'       },
};

// ── Step badge ────────────────────────────────────────────────
function StepBadge({ n, done }) {
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
      ${done ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
      {done ? '✓' : n}
    </span>
  );
}

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
  const filteredTerms = terms
    .filter(t => !selYear || t.academic_year_id === selYear)
    .sort((a, b) => a.number - b.number);
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
      toast.success(`✅ ${students.length} bulletins downloaded as PDF!`);
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    } catch (err) {
      toast.error(err.message || 'Failed', { duration: 6000 });
    } finally {
      setGenAll(false);
    }
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
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setGenOne('');
    }
  };

  const handleGenerateAnnual = async () => {
    if (!selClass || !selYear) { toast.error('Select class and year first'); return; }
    setGenAnnual(true);
    try {
      const res = await SMS.get('/excel/annual-report', {
        params: { class_id: selClass, academic_year_id: selYear },
        responseType: 'arraybuffer',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlob(blob, `${selectedClass?.name || 'class'}_annual_report.xlsx`);
      toast.success('✅ Annual Progressive Report downloaded!');
    } catch (err) {
      toast.error(err?.message || 'Failed', { duration: 6000 });
    } finally {
      setGenAnnual(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Report Cards</h1>
              <p className="text-gray-400 text-xs mt-0.5">Generate & download bulletins per term or annual</p>
            </div>
          </div>
          {ready && students.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-sm">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-bold text-gray-700">{students.length}</span>
              <span className="text-sm text-gray-400">students</span>
            </div>
          )}
        </div>

        {/* ── Selection Card ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* ── Step 1: Class + Year ─────────────────────────── */}
          <div className="p-5 border-b border-gray-50">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge n="1" done={!!(selClass && selYear)} />
              <span className="text-sm font-bold text-gray-700">Select Class & Academic Year</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Class */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Class</label>
                <div className="relative">
                  <select
                    value={selClass}
                    onChange={e => setSelClass(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  >
                    <option value="">— Select Class —</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Academic Year */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Academic Year</label>
                <div className="relative">
                  <select
                    value={selYear}
                    onChange={e => setSelYear(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  >
                    <option value="">— Select Year —</option>
                    {years.map(y => (
                      <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 2: Term ─────────────────────────────────── */}
          <div className="p-5 border-b border-gray-50">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge n="2" done={!!selTerm} />
              <span className="text-sm font-bold text-gray-700">Select Term</span>
            </div>

            {filteredTerms.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No terms found — create them in Classes &amp; Years</p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {filteredTerms.map(t => {
                  const style = TERM_STYLE[t.number] || TERM_STYLE[1];
                  const isSelected = selTerm === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelTerm(t.id)}
                      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-200
                        ${isSelected ? `${style.active} shadow-lg scale-105` : `${style.idle}`}`}
                    >
                      {t.number === 4 && (
                        <Star className={`w-3.5 h-3.5 ${isSelected ? 'text-white/90' : 'text-amber-500'}`} />
                      )}
                      <span>{t.name}</span>
                      {t.is_current && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : 'bg-green-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {isAnnual && (
              <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-sm text-amber-700">
                <Star className="w-4 h-4 shrink-0 text-amber-500" />
                Annual report card = average of <strong>Term 1 + Term 2 + Term 3</strong>
              </div>
            )}
          </div>

          {/* ── Step 3: Remarks (optional) ───────────────────── */}
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge n="3" done={false} />
              <span className="text-sm font-bold text-gray-700">Remarks & Conduct <span className="text-gray-400 font-normal text-xs">(optional)</span></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Teacher Remarks</label>
                <input
                  value={remarks.teacher}
                  onChange={e => setRemarks(r => ({ ...r, teacher: e.target.value }))}
                  placeholder="e.g. Good progress"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Head Teacher Remarks</label>
                <input
                  value={remarks.head}
                  onChange={e => setRemarks(r => ({ ...r, head: e.target.value }))}
                  placeholder="e.g. Keep it up"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Conduct</label>
                <div className="relative">
                  <select
                    value={remarks.conduct}
                    onChange={e => setRemarks(r => ({ ...r, conduct: e.target.value }))}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  >
                    {['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ──────────────────────────────────── */}
        {ready && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Download all bulletins for selected term */}
            <button
              onClick={handleGenerateAll}
              disabled={genAll}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                {genAll
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Printer className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="font-bold leading-tight">Print All Bulletins</p>
                <p className="text-blue-200 text-xs mt-0.5">
                  {genAll ? 'Generating PDF…' : `${selectedTerm?.name || 'Term'} · ${students.length} students · PDF`}
                </p>
              </div>
            </button>

            {/* Annual Progressive Report Excel */}
            <button
              onClick={handleGenerateAnnual}
              disabled={genAnnual}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                {genAnnual
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <FileSpreadsheet className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="font-bold leading-tight">Annual Progressive Report</p>
                <p className="text-emerald-200 text-xs mt-0.5">
                  {genAnnual ? 'Generating…' : 'T1 + T2 + T3 average · Excel'}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── Students List ───────────────────────────────────── */}
        {students.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* List header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight">
                    {selectedClass?.name} Students
                  </p>
                  {selectedTerm && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedTerm.name} · {students.length} students
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []))}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Column labels */}
            <div className="grid grid-cols-[32px_40px_1fr_100px_90px] items-center gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              <span>#</span>
              <span></span>
              <span>Student</span>
              <span className="text-center">Last Result</span>
              <span className="text-center">Print</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {students.map((st, idx) => {
                const b     = bulletins.find(bul => bul.student_id === st.id);
                const isGen = genOne === st.id;
                return (
                  <div
                    key={st.id}
                    className="grid grid-cols-[32px_40px_1fr_100px_90px] items-center gap-2 px-5 py-3 hover:bg-gray-50/70 transition-colors group"
                  >
                    {/* Rank */}
                    <span className="text-xs font-bold text-gray-300 text-right">{idx + 1}</span>

                    {/* Avatar */}
                    <div className="w-9 h-10 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shrink-0">
                      {st.photo_url
                        ? <img src={st.photo_url} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 font-bold text-sm">
                            {(st.first_name || '?').charAt(0)}
                          </div>}
                    </div>

                    {/* Name + ID */}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                        {(st.last_name || '').toUpperCase()} {st.first_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{st.student_id}</p>
                    </div>

                    {/* Previous bulletin */}
                    {b ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-0.5">
                          {b.percentage?.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          #{b.rank_in_class}/{b.class_size}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 border border-dashed border-gray-200 rounded-lg px-2 py-0.5">
                          —
                        </span>
                      </div>
                    )}

                    {/* Individual print button */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleGenerateOne(st)}
                        disabled={!selTerm || !selYear || !!genOne}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-40 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                      >
                        {isGen
                          ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty State ─────────────────────────────────────── */}
        {!selClass && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-blue-400" />
            </div>
            <p className="font-bold text-gray-700 text-base">Select a class to get started</p>
            <p className="text-gray-400 text-sm mt-1">
              Choose your class, academic year and term, then download report cards
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
