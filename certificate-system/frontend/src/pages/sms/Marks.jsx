import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Save, RefreshCw, BookOpen, Download, ChevronDown, Eye,
         ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
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
function gradeInfo(pct) {
  if (pct >= 80) return { g: 'A1', bg: 'bg-emerald-500' };
  if (pct >= 70) return { g: 'B2', bg: 'bg-blue-500' };
  if (pct >= 60) return { g: 'C3', bg: 'bg-sky-500' };
  if (pct >= 50) return { g: 'D4', bg: 'bg-amber-500' };
  if (pct >= 40) return { g: 'E5', bg: 'bg-orange-500' };
  return { g: 'F', bg: 'bg-red-500' };
}
const TERM_PILL = {
  1: { on: 'bg-blue-600 text-white border-blue-600',    off: 'bg-white text-blue-700 border-blue-300 hover:bg-blue-600 hover:text-white' },
  2: { on: 'bg-emerald-600 text-white border-emerald-600', off: 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-600 hover:text-white' },
  3: { on: 'bg-violet-600 text-white border-violet-600', off: 'bg-white text-violet-700 border-violet-300 hover:bg-violet-600 hover:text-white' },
};
const SEL_CLS = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all shadow-sm';

export default function SmsMarks() {
  const session   = useMemo(() => getSession(), []);
  const isDos     = session.role === 'dos';
  const canEdit   = !isDos;

  const [years,     setYears]     = useState([]);
  const [terms,     setTerms]     = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [marksData, setMarksData] = useState({});
  const [dirty,     setDirty]     = useState(false);
  const [selYear,   setSelYear]   = useState('');
  const [selTerm,   setSelTerm]   = useState('');
  const [selClass,  setSelClass]  = useState('');
  const [selSubIdx, setSelSubIdx] = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [dlExcel,   setDlExcel]   = useState(false);
  const firstInputRef = useRef(null);

  // ── Boot ─────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getAcademicYears(), getSmsClasses(), getTerms()])
      .then(([y, c, t]) => {
        const yrs = y.data.data || [];
        setYears(yrs);
        setClasses(c.data.data || []);
        setTerms((t.data.data || []).filter(x => x.number !== 4));
        const cur = yrs.find(yr => yr.is_current);
        if (cur) setSelYear(cur.id);
      }).catch(() => toast.error('Failed to load'));
  }, []);

  // ── Subjects ─────────────────────────────────────────────
  // Backend already filters by teacher when role=teacher
  // No need to filter client-side — just load what the API returns
  useEffect(() => {
    if (!selClass) { setSubjects([]); return; }
    getSmsSubjects({ class_id: selClass }).then(r => {
      const subs = r.data.data || [];
      setSubjects(subs);
      setSelSubIdx(0);
    });
  }, [selClass]);

  // ── Marks ─────────────────────────────────────────────────
  // NOTE: subjects is passed as a parameter so the effect below
  // can call it with the freshest value without stale closure issues.
  const loadData = useCallback(async (subsOverride) => {
    const subs = subsOverride ?? subjects;
    if (!selClass || !selTerm || subs.length === 0) {
      setStudents([]);
      setMarksData({});
      return;
    }
    setLoading(true);
    try {
      const [sRes, ...markRes] = await Promise.all([
        getSmsStudents({ class_id: selClass }),
        ...subs.map(sub => getMarks({ class_id: selClass, term_id: selTerm, subject_id: sub.id })),
      ]);
      const stList = sRes.data.data || [];
      setStudents(stList);
      const md = {};
      stList.forEach(st => { md[st.id] = {}; });
      subs.forEach((sub, idx) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selClass, selTerm]);

  // Re-run whenever class or term changes (subjects may still be loading → handled below)
  useEffect(() => { loadData(); }, [selClass, selTerm]);

  // Also re-run when subjects finish loading (fixes race condition)
  useEffect(() => {
    if (selClass && selTerm && subjects.length > 0) {
      loadData(subjects);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  useEffect(() => { setTimeout(() => firstInputRef.current?.focus(), 80); }, [selSubIdx]);

  const setMark = (stId, subId, field, val) => {
    setMarksData(p => ({ ...p, [stId]: { ...p[stId], [subId]: { ...(p[stId]?.[subId] || {}), [field]: val } } }));
    setDirty(true);
  };

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
        await bulkUpsertMarks({ marks, subject_id: sub.id, term_id: selTerm, class_id: selClass, academic_year_id: cls?.academic_year_id || selYear });
      }
      toast.success(`✅ Marks saved — ${subjects.length} subjects`);
      setDirty(false);
      loadData(subjects);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleExcel = async () => {
    if (!selClass || !selTerm) return;
    setDlExcel(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      const res = await SMS.get('/excel/class-report', { params: { class_id: selClass, term_id: selTerm, academic_year_id: selYear || '' }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = `${cls?.name || 'class'}_${trm?.name || 'term'}_marks.xlsx`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Excel downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDlExcel(false); }
  };

  const filteredTerms = terms.filter(t => !selYear || t.academic_year_id === selYear).sort((a, b) => a.number - b.number);
  const selCls        = classes.find(c => c.id === selClass);
  const selTrmObj     = terms.find(t => t.id === selTerm);
  const activeSub     = subjects[selSubIdx] || null;
  const hasExam       = (activeSub?.max_exam || 0) > 0;

  const studentTotals = useMemo(() => {
    const r = {};
    students.forEach(st => {
      let tw = 0, mx = 0;
      subjects.forEach(sub => {
        const m  = marksData[st.id]?.[sub.id];
        const c1 = parseFloat(m?.cat1 || 0);
        const ex = (sub.max_exam || 0) > 0 ? parseFloat(m?.exam || 0) : 0;
        tw += (c1 + ex) * (sub.coefficient || 1);
        mx += (sub.max_marks || 100) * (sub.coefficient || 1);
      });
      r[st.id] = { pct: mx > 0 ? (tw / mx) * 100 : 0 };
    });
    return r;
  }, [students, subjects, marksData]);

  const subjectProgress = useMemo(() => subjects.map(sub => {
    const entered = students.filter(st => { const m = marksData[st.id]?.[sub.id]; return m?.cat1 !== '' && m?.cat1 != null; }).length;
    return { entered, total: students.length };
  }), [subjects, students, marksData]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm">
              <BookOpen className="w-4.5 h-4.5 text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{isDos ? 'Student Marks' : 'Marks Entry'}</h1>
              <p className="text-gray-400 text-xs">{isDos ? 'View all marks — read only' : 'Enter marks per subject'}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {isDos && <span className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-xl"><Eye className="w-3.5 h-3.5"/>View only</span>}
            {dirty && canEdit && <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-xl"><AlertCircle className="w-3.5 h-3.5"/>Unsaved</span>}
          </div>
        </div>

        {/* ── Config card ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

          {/* Year */}
          <div className="p-5 pb-4">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Academic Year</label>
            <div className="relative max-w-xs">
              <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelTerm(''); setSelClass(''); setDirty(false); }} className={SEL_CLS}>
                <option value="">— Select Year —</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Term */}
          {selYear && (
            <div className="px-5 pb-4 border-t border-gray-50 pt-4">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Term</label>
              {filteredTerms.length === 0
                ? <p className="text-sm text-gray-400 italic">No terms — create in Classes &amp; Years</p>
                : <div className="flex flex-wrap gap-2">
                    {filteredTerms.map(t => {
                      const p = TERM_PILL[t.number] || TERM_PILL[1];
                      const on = selTerm === t.id;
                      return (
                        <button key={t.id} onClick={() => { setSelTerm(t.id); setSelClass(''); setDirty(false); }}
                          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${on ? p.on + ' shadow-md scale-105' : p.off}`}>
                          {t.name}
                          {t.is_current && <span className={`w-2 h-2 rounded-full ${on ? 'bg-white/70' : 'bg-green-500'}`} />}
                        </button>
                      );
                    })}
                  </div>}
            </div>
          )}

          {/* Class + action buttons */}
          {selYear && selTerm && (
            <div className="px-5 pb-5 border-t border-gray-50 pt-4">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Class</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-52">
                  <select value={selClass} onChange={e => { setSelClass(e.target.value); setDirty(false); }} className={SEL_CLS}>
                    <option value="">— Select Class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {selClass && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => loadData(subjects)} disabled={loading}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button onClick={handleExcel} disabled={dlExcel}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm">
                      {dlExcel ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-600" />}
                      Excel
                    </button>
                    {canEdit && (
                      <button onClick={handleSave} disabled={saving || loading || subjects.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-sm">
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

        {/* ── Marks panel ───────────────────────────────────── */}
        {selClass && selTerm && subjects.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* ── Subject selector strip ──────────────────── */}
            <div className="bg-[#0a2156] px-4 pt-3 pb-0">
              {/* Class + term label */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">{selCls?.name}</span>
                  <span className="text-blue-300 text-xs">·</span>
                  <span className="text-blue-200 text-xs font-medium">{selTrmObj?.name}</span>
                  <span className="text-blue-300 text-xs ml-1">· {students.length} students</span>
                </div>
                {isDos && <span className="flex items-center gap-1 text-blue-200 text-xs"><Eye className="w-3 h-3"/>View only</span>}
              </div>

              {/* Subject tabs */}
              <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
                {subjects.map((sub, idx) => {
                  const prog    = subjectProgress[idx];
                  const done    = prog?.total > 0 && prog?.entered === prog?.total;
                  const partial = prog?.entered > 0 && prog?.entered < prog?.total;
                  const isAct   = selSubIdx === idx;
                  return (
                    <button key={sub.id} onClick={() => setSelSubIdx(idx)}
                      className={`relative flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all duration-150 border-b-2
                        ${isAct
                          ? 'bg-white text-[#0a2156] border-white'
                          : 'bg-white/10 text-blue-200 border-transparent hover:bg-white/20 hover:text-white'}`}>
                      {done
                        ? <CheckCircle2 className={`w-3 h-3 ${isAct ? 'text-emerald-500' : 'text-emerald-400'}`} />
                        : partial
                          ? <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          : <span className="w-2 h-2 rounded-full bg-white/30 shrink-0" />}
                      <span>{(sub.name || '').toUpperCase()}</span>
                      <span className={`text-[10px] font-normal ${isAct ? 'text-gray-400' : 'text-blue-300'}`}>/{sub.max_marks || 100}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Active subject info bar ──────────────────── */}
            {activeSub && (
              <div className="flex items-center justify-between px-5 py-2.5 bg-blue-50 border-b border-blue-100">
                <button onClick={() => setSelSubIdx(i => Math.max(0, i - 1))} disabled={selSubIdx === 0}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-bold disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <div className="text-center">
                  <span className="font-bold text-[#0a2156] text-sm">{(activeSub.name || '').toUpperCase()}</span>
                  <span className="text-blue-500 text-xs ml-2">
                    {hasExam
                      ? `TEST /${activeSub.max_test || 0} + EXAM /${activeSub.max_exam || 0} = /${activeSub.max_marks || 100}`
                      : `TEST only · max /${activeSub.max_test || activeSub.max_marks || 100}`}
                    {activeSub.coefficient > 1 ? ` · ×${activeSub.coefficient}` : ''}
                  </span>
                </div>
                <button onClick={() => setSelSubIdx(i => Math.min(subjects.length - 1, i + 1))} disabled={selSubIdx === subjects.length - 1}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-bold disabled:opacity-30 transition-colors">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Table ───────────────────────────────────── */}
            {loading ? (
              <div className="py-16 text-center">
                <span className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                <p className="text-gray-400 text-sm mt-3">Loading marks…</p>
              </div>
            ) : students.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="font-semibold">No students in this class</p>
              </div>
            ) : activeSub ? (
              <>
                {/* Column header row */}
                <div className={`grid items-center px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-widest
                  ${hasExam ? 'grid-cols-[2.5rem_1fr_6rem_6rem_5.5rem_4.5rem]' : 'grid-cols-[2.5rem_1fr_6rem_5.5rem_4.5rem]'}`}>
                  <span>#</span>
                  <span>Student</span>
                  <span className="text-center text-blue-600">TEST<br/><span className="font-normal text-gray-400 normal-case tracking-normal">/{activeSub.max_test || 0}</span></span>
                  {hasExam && <span className="text-center text-emerald-600">EXAM<br/><span className="font-normal text-gray-400 normal-case tracking-normal">/{activeSub.max_exam || 0}</span></span>}
                  <span className="text-center text-[#0a2156]">TOTAL<br/><span className="font-normal text-gray-400 normal-case tracking-normal">/{activeSub.max_marks || 100}</span></span>
                  <span className="text-center">Grade</span>
                </div>

                <div className="divide-y divide-gray-50">
                  {students.map((st, idx) => {
                    const m      = marksData[st.id]?.[activeSub.id] || {};
                    const c1     = m.cat1 !== '' && m.cat1 != null ? parseFloat(m.cat1) : null;
                    const ex     = hasExam && m.exam !== '' && m.exam != null ? parseFloat(m.exam) : null;
                    const subTot = c1 != null ? (hasExam ? (c1 + (ex ?? 0)) : c1) : null;
                    const tot    = studentTotals[st.id] || { pct: 0 };
                    const { g, bg } = gradeInfo(tot.pct);
                    const maxT   = activeSub.max_test || activeSub.max_marks || 100;
                    const maxE   = activeSub.max_exam || 100;
                    const maxS   = activeSub.max_marks || 100;
                    const over   = (c1 != null && c1 > maxT) || (hasExam && ex != null && ex > maxE);

                    const INPUT = (val, onChange, maxVal, accentCls) =>
                      canEdit ? (
                        <input type="number" min="0" max={maxVal} step="0.5" placeholder="—"
                          value={val ?? ''} onChange={onChange}
                          className={`w-full border-2 rounded-xl px-2 py-2 text-sm text-center font-bold
                            focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all placeholder-gray-300
                            ${val != null && val !== '' && parseFloat(val) > maxVal
                              ? 'border-red-300 bg-red-50 text-red-600 focus:ring-red-300'
                              : val != null && val !== ''
                                ? `${accentCls} focus:ring-blue-300`
                                : 'border-gray-200 bg-white text-gray-800 focus:border-blue-400 focus:ring-blue-200'}`}
                        />
                      ) : (
                        <span className="block text-center text-sm font-bold text-gray-700">{val != null ? val : '—'}</span>
                      );

                    return (
                      <div key={st.id}
                        className={`grid items-center px-5 py-2 transition-colors
                          ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-gray-50/40 hover:bg-blue-50/30'}
                          ${hasExam ? 'grid-cols-[2.5rem_1fr_6rem_6rem_5.5rem_4.5rem]' : 'grid-cols-[2.5rem_1fr_6rem_5.5rem_4.5rem]'}`}>

                        <span className="text-xs font-bold text-gray-300">{idx + 1}</span>

                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                            {(st.last_name || '').toUpperCase()} {st.first_name}
                          </p>
                          <p className="text-[10px] text-gray-400">{st.student_id}</p>
                        </div>

                        {/* TEST */}
                        {INPUT(m.cat1, e => setMark(st.id, activeSub.id, 'cat1', e.target.value), maxT,
                          'border-blue-300 bg-blue-50/60 text-gray-900')}

                        {/* EXAM */}
                        {hasExam && INPUT(m.exam, e => setMark(st.id, activeSub.id, 'exam', e.target.value), maxE,
                          'border-emerald-300 bg-emerald-50/60 text-gray-900')}

                        {/* Total */}
                        <div className="text-center px-1">
                          {subTot != null ? (
                            <span className={`text-sm font-bold px-2 py-1 rounded-lg block text-center
                              ${over ? 'text-red-600 bg-red-50' : subTot / maxS >= 0.5 ? 'text-[#0a2156] bg-blue-50' : 'text-orange-600 bg-orange-50'}`}>
                              {subTot.toFixed(subTot % 1 === 0 ? 0 : 1)}
                            </span>
                          ) : <span className="text-gray-200 text-sm block text-center">—</span>}
                        </div>

                        {/* Overall grade */}
                        <div className="text-center">
                          {tot.pct > 0 ? (
                            <span className={`text-xs font-bold text-white px-2 py-1 rounded-lg ${bg}`}>{g}</span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save footer */}
                {canEdit && (
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {subjectProgress[selSubIdx]?.entered || 0} / {students.length} filled
                      </span>
                      {subjectProgress[selSubIdx]?.entered === students.length && students.length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                        </span>
                      )}
                    </div>
                    <button onClick={handleSave} disabled={saving || loading}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
                      {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                      Save All Marks
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── Empty / No subjects states ─────────────────────── */}
        {(!selYear || !selTerm || !selClass) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 bg-[#0a2156]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-[#0a2156]/60" />
            </div>
            <p className="font-bold text-gray-700">{!selYear ? 'Select academic year' : !selTerm ? 'Select a term' : 'Select a class'}</p>
            <p className="text-gray-400 text-sm mt-1">Then enter marks subject by subject</p>
          </div>
        )}
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
