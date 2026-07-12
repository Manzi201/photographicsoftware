import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Save, RefreshCw, BookOpen, Download, ChevronDown, Eye,
         ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getAcademicYears, getSmsSubjects,
         getSmsStudents, getMarks, bulkUpsertMarks } from '../../api';

const SMS = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api', '/api/sms') ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://photographicsoftware-1.onrender.com/api/sms' : '/api/sms'),
  timeout: 60000,
});
SMS.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

function getSession() {
  try { const s = JSON.parse(localStorage.getItem('staff_data') || '{}'); return { role: s.role || 'teacher', staffId: s.id || null }; }
  catch { return { role: 'teacher', staffId: null }; }
}

function grade(pct) {
  if (pct >= 80) return 'A1'; if (pct >= 70) return 'B2'; if (pct >= 60) return 'C3';
  if (pct >= 50) return 'D4'; if (pct >= 40) return 'E5'; return 'F';
}
const GRADE_COLOR = {
  A1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  B2: 'bg-blue-100 text-blue-700 border-blue-200',
  C3: 'bg-sky-100 text-sky-700 border-sky-200',
  D4: 'bg-amber-100 text-amber-700 border-amber-200',
  E5: 'bg-orange-100 text-orange-700 border-orange-200',
  F:  'bg-red-100 text-red-600 border-red-200',
};
const TERM_STYLE = {
  1: { active: 'bg-blue-600 border-blue-600 text-white shadow-blue-200 shadow-md scale-105', idle: 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50' },
  2: { active: 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200 shadow-md scale-105', idle: 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50' },
  3: { active: 'bg-violet-600 border-violet-600 text-white shadow-violet-200 shadow-md scale-105', idle: 'bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50' },
};

export default function SmsMarks() {
  const session   = useMemo(() => getSession(), []);
  const isTeacher = session.role === 'teacher';
  const isDos     = session.role === 'dos';
  const canEdit   = !isDos;

  // ── State ─────────────────────────────────────────────────
  const [years,     setYears]     = useState([]);
  const [terms,     setTerms]     = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [marksData, setMarksData] = useState({});   // { [studentId]: { [subjectId]: { cat1, exam } } }
  const [dirty,     setDirty]     = useState(false); // unsaved changes flag

  const [selYear,  setSelYear]  = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [selClass, setSelClass] = useState('');
  const [selSubIdx, setSelSubIdx] = useState(0);   // which subject tab is active

  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [dlExcel, setDlExcel] = useState(false);

  const firstInputRef = useRef(null);

  // ── Boot load ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getAcademicYears(), getSmsClasses(), getTerms()])
      .then(([y, c, t]) => {
        const yrs = y.data.data || [];
        setYears(yrs);
        setClasses(c.data.data || []);
        setTerms((t.data.data || []).filter(t => t.number !== 4));
        const cur = yrs.find(yr => yr.is_current);
        if (cur) setSelYear(cur.id);
      }).catch(() => toast.error('Failed to load'));
  }, []);

  // ── Load subjects when class changes ──────────────────────
  useEffect(() => {
    if (!selClass) { setSubjects([]); return; }
    getSmsSubjects({ class_id: selClass }).then(r => {
      let subs = r.data.data || [];
      if (isTeacher && session.staffId) {
        const mine = subs.filter(s => s.teacher?.id === session.staffId || s.teacher_id === session.staffId);
        subs = mine.length > 0 ? mine : subs;
      }
      setSubjects(subs);
      setSelSubIdx(0);
    });
  }, [selClass, isTeacher, session.staffId]);

  // ── Load marks when class + term + subjects ready ─────────
  const loadData = useCallback(async () => {
    if (!selClass || !selTerm || subjects.length === 0) { setStudents([]); setMarksData({}); return; }
    setLoading(true);
    try {
      const [sRes, ...markRes] = await Promise.all([
        getSmsStudents({ class_id: selClass }),
        ...subjects.map(sub => getMarks({ class_id: selClass, term_id: selTerm, subject_id: sub.id })),
      ]);
      const stList = sRes.data.data || [];
      setStudents(stList);
      const md = {};
      stList.forEach(st => { md[st.id] = {}; });
      subjects.forEach((sub, idx) => {
        const mList = markRes[idx]?.data?.data || [];
        stList.forEach(st => {
          const m = mList.find(x => x.student_id === st.id);
          if (!md[st.id]) md[st.id] = {};
          md[st.id][sub.id] = { cat1: m?.cat1 ?? '', exam: m?.exam ?? '' };
        });
      });
      setMarksData(md);
      setDirty(false);
    } catch { toast.error('Failed to load marks'); }
    finally { setLoading(false); }
  }, [selClass, selTerm, subjects]);

  useEffect(() => { loadData(); }, [selClass, selTerm]);

  // Focus first input when subject changes
  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [selSubIdx]);

  // ── Mark update ───────────────────────────────────────────
  const setMark = (stId, subId, field, val) => {
    setMarksData(p => ({
      ...p,
      [stId]: { ...p[stId], [subId]: { ...(p[stId]?.[subId] || {}), [field]: val } },
    }));
    setDirty(true);
  };

  // ── Save current subject ──────────────────────────────────
  const handleSave = async () => {
    if (!selClass || !selTerm || !canEdit) return;
    setSaving(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      for (const sub of subjects) {
        const marks = students.map(st => ({
          student_id: st.id,
          cat1: parseFloat(marksData[st.id]?.[sub.id]?.cat1 || 0),
          exam: (sub.max_exam || 0) > 0 ? parseFloat(marksData[st.id]?.[sub.id]?.exam || 0) : 0,
        }));
        await bulkUpsertMarks({
          marks, subject_id: sub.id, term_id: selTerm,
          class_id: selClass, academic_year_id: cls?.academic_year_id || selYear,
        });
      }
      toast.success(`✅ Marks saved for ${subjects.length} subjects!`);
      setDirty(false);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  // ── Excel export ──────────────────────────────────────────
  const handleExcel = async () => {
    if (!selClass || !selTerm) return;
    setDlExcel(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      const res = await SMS.get('/excel/class-report', {
        params: { class_id: selClass, term_id: selTerm, academic_year_id: selYear || '' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${cls?.name || 'class'}_${trm?.name || 'term'}_marks.xlsx`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Excel downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDlExcel(false); }
  };

  // ── Derived ───────────────────────────────────────────────
  const filteredTerms   = terms.filter(t => !selYear || t.academic_year_id === selYear).sort((a, b) => a.number - b.number);
  const selCls          = classes.find(c => c.id === selClass);
  const selTrmObj       = terms.find(t => t.id === selTerm);
  const activeSub       = subjects[selSubIdx] || null;
  const hasExam         = activeSub ? (activeSub.max_exam || 0) > 0 : false;

  // Per-student total across ALL subjects (for summary column)
  const studentTotals = useMemo(() => {
    const r = {};
    students.forEach(st => {
      let tw = 0, mx = 0;
      subjects.forEach(sub => {
        const m   = marksData[st.id]?.[sub.id];
        const c1  = parseFloat(m?.cat1 || 0);
        const ex  = (sub.max_exam || 0) > 0 ? parseFloat(m?.exam || 0) : 0;
        tw += (c1 + ex) * (sub.coefficient || 1);
        mx += (sub.max_marks || 100) * (sub.coefficient || 1);
      });
      r[st.id] = { pct: mx > 0 ? (tw / mx) * 100 : 0, total: tw, max: mx };
    });
    return r;
  }, [students, subjects, marksData]);

  // Completeness for each subject (how many students have marks entered)
  const subjectProgress = useMemo(() => {
    return subjects.map(sub => {
      const entered = students.filter(st => {
        const m  = marksData[st.id]?.[sub.id];
        const c1 = m?.cat1;
        return c1 !== '' && c1 != null;
      }).length;
      return { id: sub.id, entered, total: students.length };
    });
  }, [subjects, students, marksData]);

  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Page header ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {isDos ? 'Student Reports' : 'Marks Entry'}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                {isDos ? 'View all student marks' : 'Enter marks subject by subject'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isDos && (
              <span className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                <Eye className="w-3.5 h-3.5" /> View only
              </span>
            )}
            {dirty && canEdit && (
              <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5" /> Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* ── Selection card ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Step 1 — Year */}
          <div className="p-5 border-b border-gray-50">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Step 1 — Academic Year
            </label>
            <div className="relative max-w-xs">
              <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelTerm(''); setSelClass(''); setDirty(false); }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                <option value="">— Select Year —</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Step 2 — Term */}
          {selYear && (
            <div className="p-5 border-b border-gray-50">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Step 2 — Term
              </label>
              {filteredTerms.length === 0
                ? <p className="text-sm text-gray-400 italic">No terms for this year</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {filteredTerms.map(t => {
                      const s   = TERM_STYLE[t.number] || TERM_STYLE[1];
                      const act = selTerm === t.id;
                      return (
                        <button key={t.id} onClick={() => { setSelTerm(t.id); setSelClass(''); setDirty(false); }}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${act ? s.active : s.idle}`}>
                          {t.name}
                          {t.is_current && <span className={`w-2 h-2 rounded-full ${act ? 'bg-white/60' : 'bg-green-500'}`} />}
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {/* Step 3 — Class + actions */}
          {selYear && selTerm && (
            <div className="p-5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Step 3 — Class
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-52">
                  <select value={selClass} onChange={e => { setSelClass(e.target.value); setDirty(false); }}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">— Select Class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {selClass && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => loadData()} disabled={loading}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button onClick={handleExcel} disabled={dlExcel}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      {dlExcel ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-600" />}
                      Excel
                    </button>
                    {canEdit && (
                      <button onClick={handleSave} disabled={saving || loading || subjects.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-sm">
                        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save All Marks
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Marks Entry Area ──────────────────────────────── */}
        {selClass && selTerm && subjects.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Context bar */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
              <span className="font-bold text-gray-800 text-sm">{selCls?.name}</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm font-semibold text-gray-500">{selTrmObj?.name}</span>
              <span className="ml-auto text-xs text-gray-400">{students.length} students</span>
              {isDos && (
                <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full">
                  <Eye className="w-3 h-3" /> View only
                </span>
              )}
            </div>

            {/* ── Subject tab bar ───────────────────────────── */}
            <div className="flex items-center gap-0 px-4 pt-3 pb-0 overflow-x-auto border-b border-gray-100">
              {subjects.map((sub, idx) => {
                const prog = subjectProgress[idx];
                const done = prog && prog.total > 0 && prog.entered === prog.total;
                const partial = prog && prog.entered > 0 && prog.entered < prog.total;
                const isActive = selSubIdx === idx;
                return (
                  <button key={sub.id} onClick={() => setSelSubIdx(idx)}
                    className={`relative flex-shrink-0 flex flex-col items-center px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-150 whitespace-nowrap
                      ${isActive
                        ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                    <span>{(sub.name || '').toUpperCase()}</span>
                    <span className={`text-[10px] mt-0.5 font-normal ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                      /{sub.max_marks || 100}
                      {sub.coefficient > 1 ? ` ×${sub.coefficient}` : ''}
                    </span>
                    {/* Progress dot */}
                    {students.length > 0 && (
                      <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full
                        ${done ? 'bg-emerald-500' : partial ? 'bg-amber-400' : 'bg-gray-300'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Active subject nav header ─────────────────── */}
            {activeSub && (
              <div className="flex items-center justify-between px-5 py-3 bg-blue-600">
                <button onClick={() => setSelSubIdx(i => Math.max(0, i - 1))} disabled={selSubIdx === 0}
                  className="flex items-center gap-1 text-blue-200 hover:text-white text-xs font-semibold disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                <div className="text-center">
                  <p className="text-white font-bold text-sm">{(activeSub.name || '').toUpperCase()}</p>
                  <p className="text-blue-200 text-xs mt-0.5">
                    {hasExam
                      ? `TEST /${activeSub.max_test || 0}  +  EXAM /${activeSub.max_exam || 0}  =  TOTAL /${activeSub.max_marks || 100}`
                      : `TEST only — max /${activeSub.max_test || activeSub.max_marks || 100}`}
                    {activeSub.coefficient > 1 ? `  ·  coefficient ×${activeSub.coefficient}` : ''}
                  </p>
                </div>

                <button onClick={() => setSelSubIdx(i => Math.min(subjects.length - 1, i + 1))} disabled={selSubIdx === subjects.length - 1}
                  className="flex items-center gap-1 text-blue-200 hover:text-white text-xs font-semibold disabled:opacity-30 transition-colors">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Student mark rows ─────────────────────────── */}
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block mb-2" />
                <p>Loading marks…</p>
              </div>
            ) : students.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="font-semibold text-gray-500">No students in this class</p>
              </div>
            ) : activeSub ? (
              <div>
                {/* Column headers */}
                <div className={`grid gap-0 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100 px-5 py-2
                  ${hasExam ? 'grid-cols-[2rem_1fr_7rem_7rem_6rem_5rem]' : 'grid-cols-[2rem_1fr_7rem_6rem_5rem]'}`}>
                  <span>#</span>
                  <span>Student</span>
                  <span className="text-center">TEST /{activeSub.max_test || 0}</span>
                  {hasExam && <span className="text-center">EXAM /{activeSub.max_exam || 0}</span>}
                  <span className="text-center">TOTAL /{activeSub.max_marks || 100}</span>
                  <span className="text-center">Overall</span>
                </div>

                <div className="divide-y divide-gray-50">
                  {students.map((st, idx) => {
                    const m       = marksData[st.id]?.[activeSub.id] || {};
                    const c1      = m.cat1 !== '' && m.cat1 != null ? parseFloat(m.cat1) : null;
                    const ex      = hasExam && m.exam !== '' && m.exam != null ? parseFloat(m.exam) : null;
                    const subTot  = c1 != null ? (hasExam ? (c1 + (ex ?? 0)) : c1) : null;
                    const tot     = studentTotals[st.id] || { pct: 0 };
                    const grd     = grade(tot.pct);
                    const maxSub  = activeSub.max_marks || 100;
                    const subPct  = subTot != null ? (subTot / maxSub) * 100 : null;
                    const rowBg   = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

                    const inputBase = `w-full border rounded-xl px-3 py-2.5 text-sm text-center font-semibold
                      focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                      transition-all placeholder-gray-300`;

                    return (
                      <div key={st.id}
                        className={`grid gap-0 items-center px-5 py-2.5 hover:bg-blue-50/30 transition-colors
                          ${hasExam ? 'grid-cols-[2rem_1fr_7rem_7rem_6rem_5rem]' : 'grid-cols-[2rem_1fr_7rem_6rem_5rem]'}
                          ${rowBg}`}>

                        {/* Rank */}
                        <span className="text-xs font-bold text-gray-300">{idx + 1}</span>

                        {/* Student name */}
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                            {(st.last_name || '').toUpperCase()} {st.first_name}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{st.student_id}</p>
                        </div>

                        {/* TEST input */}
                        {canEdit ? (
                          <input
                            ref={idx === 0 ? firstInputRef : null}
                            type="number" min="0" max={activeSub.max_test || activeSub.max_marks || 100}
                            step="0.5" placeholder="—"
                            value={m.cat1 ?? ''}
                            onChange={e => setMark(st.id, activeSub.id, 'cat1', e.target.value)}
                            className={`${inputBase} ${
                              c1 != null && c1 > (activeSub.max_test || activeSub.max_marks || 100)
                                ? 'border-red-300 bg-red-50 text-red-600'
                                : c1 != null ? 'border-blue-200 bg-blue-50/40 text-gray-900' : 'border-gray-200 bg-white text-gray-900'
                            }`}
                          />
                        ) : (
                          <span className="text-center text-sm font-semibold text-gray-700">{c1 != null ? c1 : '—'}</span>
                        )}

                        {/* EXAM input */}
                        {hasExam && (canEdit ? (
                          <input
                            type="number" min="0" max={activeSub.max_exam || 100}
                            step="0.5" placeholder="—"
                            value={m.exam ?? ''}
                            onChange={e => setMark(st.id, activeSub.id, 'exam', e.target.value)}
                            className={`${inputBase} ${
                              ex != null && ex > (activeSub.max_exam || 100)
                                ? 'border-red-300 bg-red-50 text-red-600'
                                : ex != null ? 'border-emerald-200 bg-emerald-50/40 text-gray-900' : 'border-gray-200 bg-white text-gray-900'
                            }`}
                          />
                        ) : (
                          <span className="text-center text-sm font-semibold text-gray-700">{ex != null ? ex : '—'}</span>
                        ))}

                        {/* Subject total */}
                        <div className="text-center">
                          {subTot != null ? (
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-lg
                              ${subPct >= 50 ? 'text-gray-900' : 'text-red-600'}`}>
                              {subTot.toFixed(1)}
                            </span>
                          ) : <span className="text-gray-300 text-sm">—</span>}
                        </div>

                        {/* Overall grade badge */}
                        <div className="text-center">
                          {tot.pct > 0 ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${GRADE_COLOR[grd]}`}>
                              {grd}
                            </span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom save bar */}
                {canEdit && (
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {subjectProgress[selSubIdx]?.entered || 0} / {students.length} marks entered for this subject
                    </p>
                    <button onClick={handleSave} disabled={saving || loading}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
                      {saving
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Save className="w-4 h-4" />}
                      Save All Marks
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {(!selYear || !selTerm || !selClass) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <p className="font-bold text-gray-700 text-base">
              {!selYear ? 'Select academic year first' : !selTerm ? 'Now select a term' : 'Select a class'}
            </p>
            <p className="text-gray-400 text-sm mt-1">Then enter marks subject by subject</p>
          </div>
        )}

        {/* No subjects in class */}
        {selClass && selTerm && !loading && subjects.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <p className="font-semibold text-gray-500">No subjects assigned to this class</p>
            <p className="text-gray-400 text-sm mt-1">Go to Classes &amp; Years → Assign subjects first</p>
          </div>
        )}

      </div>
    </div>
  );
}
