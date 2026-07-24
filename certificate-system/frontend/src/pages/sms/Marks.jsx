import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Save, RefreshCw, BookOpen, Download, ChevronDown, Eye,
         ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
         Users, PenLine } from 'lucide-react';
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
  try {
    const s = JSON.parse(localStorage.getItem('staff_data') || '{}');
    return { role: s.role || 'teacher', staffId: s.id || null, name: s.full_name || '' };
  } catch { return { role: 'teacher', staffId: null, name: '' }; }
}
function gradeInfo(pct) {
  if (pct >= 80) return { g: 'A1', bg: 'bg-emerald-500', text: 'text-emerald-600' };
  if (pct >= 70) return { g: 'B2', bg: 'bg-blue-500',    text: 'text-blue-600' };
  if (pct >= 60) return { g: 'C3', bg: 'bg-sky-500',     text: 'text-sky-600' };
  if (pct >= 50) return { g: 'D4', bg: 'bg-amber-500',   text: 'text-amber-600' };
  if (pct >= 40) return { g: 'E5', bg: 'bg-orange-500',  text: 'text-orange-600' };
  return { g: 'F', bg: 'bg-red-500', text: 'text-red-600' };
}
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

  // Boot
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

  // Subjects when class changes
  useEffect(() => {
    if (!selClass) { setSubjects([]); setSelSubIdx(0); return; }
    getSmsSubjects({ class_id: selClass }).then(r => {
      setSubjects(r.data.data || []);
      setSelSubIdx(0);
    });
  }, [selClass]);

  // Load marks
  const loadData = useCallback(async (subsOverride) => {
    const subs = subsOverride ?? subjects;
    if (!selClass || !selTerm || subs.length === 0) {
      setStudents([]); setMarksData({}); return;
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
  }, [selClass, selTerm]);

  useEffect(() => { loadData(); }, [selClass, selTerm]);
  useEffect(() => {
    if (selClass && selTerm && subjects.length > 0) loadData(subjects);
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
      toast.success(`✅ Marks saved — ${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`);
      setDirty(false);
      loadData(subjects);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleSaveSubject = async () => {
    if (!selClass || !selTerm || !canEdit || !activeSub) return;
    setSaving(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const marks = students.map(st => ({
        student_id: st.id,
        cat1: parseFloat(marksData[st.id]?.[activeSub.id]?.cat1 || 0),
        exam: (activeSub.max_exam || 0) > 0 ? parseFloat(marksData[st.id]?.[activeSub.id]?.exam || 0) : 0,
      }));
      await bulkUpsertMarks({ marks, subject_id: activeSub.id, term_id: selTerm, class_id: selClass, academic_year_id: cls?.academic_year_id || selYear });
      toast.success(`✅ ${activeSub.name} marks saved`);
      setDirty(false);
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
      const a = document.createElement('a'); a.href = url;
      a.download = `${cls?.name || 'class'}_${trm?.name || 'term'}_marks.xlsx`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Excel downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDlExcel(false); }
  };

  const filteredClasses = classes.filter(c => !selYear || !c.academic_year_id || c.academic_year_id === selYear);
  const filteredTerms   = terms.filter(t => !selYear || t.academic_year_id === selYear).sort((a, b) => a.number - b.number);
  const selCls          = classes.find(c => c.id === selClass);
  const selTrmObj       = terms.find(t => t.id === selTerm);
  const activeSub       = subjects[selSubIdx] || null;
  const hasExam         = (activeSub?.max_exam || 0) > 0;

  const subjectProgress = useMemo(() => subjects.map(sub => {
    const entered = students.filter(st => {
      const m = marksData[st.id]?.[sub.id];
      return m?.cat1 !== '' && m?.cat1 != null;
    }).length;
    return { entered, total: students.length };
  }), [subjects, students, marksData]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {isDos ? 'Student Marks' : 'Marks Entry'}
              </h1>
              <p className="text-gray-400 text-xs">
                {isDos ? 'View all marks — read only' : 'Enter student marks by subject'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {isDos && <span className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-xl"><Eye className="w-3.5 h-3.5"/>View only</span>}
            {dirty && canEdit && <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-xl"><AlertCircle className="w-3.5 h-3.5"/>Unsaved changes</span>}
            {selClass && canEdit && (
              <button onClick={handleSave} disabled={saving || loading || subjects.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save className="w-4 h-4"/>}
                Save All
              </button>
            )}
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Academic Year */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Academic Year</label>
              <div className="relative">
                <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelTerm(''); setSelClass(''); setDirty(false); }} className={SEL_CLS}>
                  <option value="">— All Years —</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-gray-100 self-end mb-0.5"/>
            {/* Term */}
            <div className="flex-shrink-0">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Term</label>
              {filteredTerms.length === 0
                ? <p className="text-sm text-gray-400 italic py-2">Select a year</p>
                : <div className="flex gap-1.5">
                    {filteredTerms.map(t => {
                      const COLORS = { 1: 'bg-blue-600 border-blue-600', 2: 'bg-emerald-600 border-emerald-600', 3: 'bg-violet-600 border-violet-600' };
                      const on = selTerm === t.id;
                      return (
                        <button key={t.id} onClick={() => { setSelTerm(t.id); setSelClass(''); setDirty(false); }}
                          className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                            ${on ? (COLORS[t.number] || 'bg-gray-600 border-gray-600') + ' text-white shadow-md scale-105'
                                 : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                          {t.name}
                          {t.is_current && <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block ${on ? 'bg-white/70' : 'bg-green-500'}`}/>}
                        </button>
                      );
                    })}
                  </div>}
            </div>
            <div className="hidden sm:block w-px h-10 bg-gray-100 self-end mb-0.5"/>
            {/* Class */}
            <div className="flex-1 min-w-[170px]">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Class</label>
              <div className="relative">
                <select value={selClass} onChange={e => { setSelClass(e.target.value); setDirty(false); }}
                  disabled={!selTerm} className={SEL_CLS + (!selTerm ? ' opacity-50 cursor-not-allowed' : '')}>
                  <option value="">{selTerm ? '— Select Class —' : '— Select term first —'}</option>
                  {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            {selClass && (
              <>
                <div className="hidden sm:block w-px h-10 bg-gray-100 self-end mb-0.5"/>
                <div className="flex gap-2 self-end">
                  <button onClick={() => loadData(subjects)} disabled={loading}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/> Refresh
                  </button>
                  <button onClick={handleExcel} disabled={dlExcel}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm">
                    {dlExcel ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> : <Download className="w-3.5 h-3.5 text-emerald-600"/>}
                    Excel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Main panel: sidebar + marks table ───────────── */}
        {selClass && selTerm && (
          <div className="flex gap-4 items-start">

            {/* Subject sidebar */}
            <div className="w-52 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-[#0a2156]">
                <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Subjects</p>
                <p className="text-white text-sm font-bold mt-0.5">{selCls?.name}</p>
              </div>
              {loading ? (
                <div className="p-3 space-y-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse"/>)}
                </div>
              ) : subjects.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400 font-medium">No subjects assigned</p>
                  <p className="text-[10px] text-gray-300 mt-1">Go to Classes → assign subjects</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {subjects.map((sub, idx) => {
                    const prog = subjectProgress[idx];
                    const done = prog?.total > 0 && prog?.entered === prog?.total;
                    const partial = prog?.entered > 0 && !done;
                    const isAct = selSubIdx === idx;
                    return (
                      <button key={sub.id} onClick={() => setSelSubIdx(idx)}
                        className={`w-full text-left px-4 py-3 transition-all
                          ${isAct ? 'bg-[#0a2156]/5 border-r-2 border-[#0a2156]' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-bold truncate ${isAct ? 'text-[#0a2156]' : 'text-gray-700'}`}>
                            {(sub.name || '').toUpperCase()}
                          </span>
                          {done
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>
                            : partial
                              ? <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"/>
                              : <span className="w-2 h-2 rounded-full bg-gray-200 shrink-0"/>}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-gray-400">/{sub.max_marks || 100}</span>
                          {prog?.total > 0 && (
                            <span className="text-[10px] text-gray-400">{prog.entered}/{prog.total}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Nav arrows */}
              {subjects.length > 1 && (
                <div className="flex border-t border-gray-100">
                  <button onClick={() => setSelSubIdx(i => Math.max(0, i - 1))} disabled={selSubIdx === 0}
                    className="flex-1 flex items-center justify-center py-2.5 text-gray-400 hover:text-[#0a2156] hover:bg-gray-50 disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4"/>
                  </button>
                  <div className="w-px bg-gray-100"/>
                  <button onClick={() => setSelSubIdx(i => Math.min(subjects.length - 1, i + 1))} disabled={selSubIdx === subjects.length - 1}
                    className="flex-1 flex items-center justify-center py-2.5 text-gray-400 hover:text-[#0a2156] hover:bg-gray-50 disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </div>

            {/* Right panel — marks table */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Subject header bar */}
              {activeSub ? (
                <div className="flex items-center justify-between px-5 py-3 bg-[#0a2156]">
                  <div>
                    <p className="text-white font-bold text-sm">{(activeSub.name || '').toUpperCase()}</p>
                    <p className="text-blue-200 text-xs mt-0.5">
                      {hasExam
                        ? `TEST /${activeSub.max_test || 0}  +  EXAM /${activeSub.max_exam || 0}  =  /${activeSub.max_marks || 100}`
                        : `TEST only · max /${activeSub.max_test || activeSub.max_marks || 100}`}
                      {activeSub.coefficient > 1 ? `  ·  ×${activeSub.coefficient}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-blue-200 text-xs flex items-center gap-1">
                      <Users className="w-3.5 h-3.5"/>{students.length} students
                    </span>
                    {isDos && <span className="flex items-center gap-1 text-blue-200 text-xs"><Eye className="w-3 h-3"/>View only</span>}
                    {canEdit && (
                      <button onClick={handleSaveSubject} disabled={saving || loading}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors">
                        {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save className="w-3.5 h-3.5"/>}
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 bg-gray-100 text-sm text-gray-400">
                  {loading ? 'Loading subjects…' : 'Select a subject from the left'}
                </div>
              )}

              {/* Column headers */}
              {activeSub && !loading && students.length > 0 && (
                <div className={`grid items-center px-5 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-widest
                  ${hasExam ? 'grid-cols-[2rem_1fr_7rem_7rem_6rem_5rem]' : 'grid-cols-[2rem_1fr_7rem_6rem_5rem]'}`}>
                  <span>#</span>
                  <span>Student</span>
                  <span className="text-center text-blue-600">TEST<br/><span className="font-normal text-gray-400 normal-case tracking-normal">/{activeSub.max_test || 0}</span></span>
                  {hasExam && <span className="text-center text-emerald-600">EXAM<br/><span className="font-normal text-gray-400 normal-case tracking-normal">/{activeSub.max_exam || 0}</span></span>}
                  <span className="text-center text-[#0a2156]">TOTAL<br/><span className="font-normal text-gray-400 normal-case tracking-normal">/{activeSub.max_marks || 100}</span></span>
                  <span className="text-center">Grade</span>
                </div>
              )}

              {/* Body */}
              {loading ? (
                <div className="py-16 text-center">
                  <span className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block"/>
                  <p className="text-gray-400 text-sm mt-3">Loading marks…</p>
                </div>
              ) : !activeSub ? (
                <div className="py-20 text-center text-gray-400">
                  <PenLine className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                  <p className="text-sm font-medium">Select a subject to enter marks</p>
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                  <p className="font-semibold text-sm">No students in this class</p>
                  <p className="text-xs mt-1">Register students first in Student Registration</p>
                </div>
              ) : (
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
                    const overT  = c1 != null && c1 > maxT;
                    const overE  = hasExam && ex != null && ex > maxE;

                    const INPUT = (val, onChange, maxVal, accentCls, refProp) =>
                      canEdit ? (
                        <input
                          ref={refProp || null}
                          type="number" min="0" max={maxVal} step="0.5" placeholder="—"
                          value={val ?? ''}
                          onChange={onChange}
                          onFocus={e => e.target.select()}
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
                        className={`grid items-center px-5 py-2.5 transition-colors
                          ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-gray-50/40 hover:bg-blue-50/30'}
                          ${hasExam ? 'grid-cols-[2rem_1fr_7rem_7rem_6rem_5rem]' : 'grid-cols-[2rem_1fr_7rem_6rem_5rem]'}`}>

                        <span className="text-xs font-bold text-gray-300">{idx + 1}</span>

                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                            {(st.last_name || '').toUpperCase()} {st.first_name}
                          </p>
                          <p className="text-[10px] text-gray-400">{st.student_id}</p>
                        </div>

                        {INPUT(m.cat1, e => setMark(st.id, activeSub.id, 'cat1', e.target.value), maxT,
                          'border-blue-300 bg-blue-50/60 text-gray-900',
                          idx === 0 ? firstInputRef : null)}

                        {hasExam && INPUT(m.exam, e => setMark(st.id, activeSub.id, 'exam', e.target.value), maxE,
                          'border-emerald-300 bg-emerald-50/60 text-gray-900', null)}

                        <div className="text-center px-1">
                          {subTot != null ? (
                            <span className={`text-sm font-bold px-2 py-1 rounded-lg block text-center
                              ${overT || overE ? 'text-red-600 bg-red-50'
                                : subTot / maxS >= 0.5 ? 'text-[#0a2156] bg-blue-50'
                                : 'text-orange-600 bg-orange-50'}`}>
                              {subTot.toFixed(subTot % 1 === 0 ? 0 : 1)}
                            </span>
                          ) : <span className="text-gray-200 text-sm block text-center">—</span>}
                        </div>

                        <div className="text-center">
                          {tot.pct > 0
                            ? <span className={`text-xs font-bold text-white px-2 py-1 rounded-lg ${bg}`}>{g}</span>
                            : <span className="text-gray-200 text-xs">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer: progress + save button */}
              {activeSub && canEdit && students.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${subjectProgress[selSubIdx]?.total > 0 ? (subjectProgress[selSubIdx].entered / subjectProgress[selSubIdx].total) * 100 : 0}%` }}/>
                      </div>
                      <span className="text-xs text-gray-400">
                        {subjectProgress[selSubIdx]?.entered || 0}/{students.length} filled
                      </span>
                    </div>
                    {subjectProgress[selSubIdx]?.entered === students.length && students.length > 0 && (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5"/> Complete
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selSubIdx < subjects.length - 1 && (
                      <button onClick={() => { handleSaveSubject(); setTimeout(() => setSelSubIdx(i => i + 1), 400); }}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                        Save &amp; Next <ChevronRight className="w-3.5 h-3.5"/>
                      </button>
                    )}
                    <button onClick={handleSaveSubject} disabled={saving || loading}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
                      {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save className="w-4 h-4"/>}
                      Save Marks
                    </button>
                  </div>
                </div>
              )}
            </div>{/* end right panel */}
          </div>
        )}

        {/* ── Empty states ─────────────────────────────────────── */}
        {(!selYear || !selTerm || !selClass) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 bg-[#0a2156]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-[#0a2156]/60"/>
            </div>
            <p className="font-bold text-gray-700">
              {!selYear ? 'Select an academic year' : !selTerm ? 'Select a term' : 'Select a class'}
            </p>
            <p className="text-gray-400 text-sm mt-1">Then enter marks subject by subject</p>
          </div>
        )}

      </div>
    </div>
  );
}
