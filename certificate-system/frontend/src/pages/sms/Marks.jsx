import React, { useState, useEffect, useMemo } from 'react';
import { Save, RefreshCw, BookOpen, Info, Download, ChevronDown, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getSmsSubjects, getSmsStudents, getMarks, bulkUpsertMarks } from '../../api';

const SMS = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api','/api/sms') ||
    (typeof window!=='undefined'&&window.location.hostname!=='localhost'
      ?'https://photographicsoftware-1.onrender.com/api/sms':'/api/sms'),
  timeout:60000,
});
SMS.interceptors.request.use(cfg=>{
  const t=localStorage.getItem('staff_token')||localStorage.getItem('cert_token');
  if(t) cfg.headers.Authorization=`Bearer ${t}`;
  return cfg;
});

function getSession() {
  try {
    const staff = JSON.parse(localStorage.getItem('staff_data') || '{}');
    return { role: staff.role || 'teacher', staffId: staff.id || null };
  } catch { return { role:'teacher', staffId:null }; }
}

const GRADE_STYLE = {
  A1:'bg-emerald-100 text-emerald-700',
  B2:'bg-blue-100 text-blue-700',
  C3:'bg-sky-100 text-sky-700',
  D4:'bg-amber-100 text-amber-700',
  E5:'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-600',
};

// Custom select component
function Select({ label, value, onChange, disabled, children, hint }) {
  return (
    <div>
      {label && <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <div className="relative">
        <select value={value} onChange={onChange} disabled={disabled}
          className="w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed">
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function SmsMarks() {
  const session    = useMemo(() => getSession(), []);
  const isTeacher  = session.role === 'teacher';

  const [classes,      setClasses]      = useState([]);
  const [allTerms,     setAllTerms]     = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [students,     setStudents]     = useState([]);
  const [marksData,    setMarksData]    = useState({});
  const [selClass,     setSelClass]     = useState('');
  const [selTerm,      setSelTerm]      = useState('');
  const [selSubj,      setSelSubj]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [dlExcel,      setDlExcel]      = useState(false);
  const [noAssignment, setNoAssignment] = useState(false);
  const [savedRows,    setSavedRows]    = useState(new Set());

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms()])
      .then(([c, t]) => {
        setClasses(c.data.data || []);
        const tms = (t.data.data || []).filter(t => t.number !== 4);
        setAllTerms(tms);
        const cur = tms.find(t => t.is_current);
        if (cur) setSelTerm(cur.id);
      })
      .catch(() => toast.error('Failed to load'));
  }, []);

  useEffect(() => {
    if (!selClass) { setSubjects([]); setSelSubj(''); return; }
    getSmsSubjects({ class_id: selClass }).then(r => {
      let subs = r.data.data || [];
      if (isTeacher && session.staffId) {
        const mine = subs.filter(s => s.teacher?.id === session.staffId || s.teacher_id === session.staffId);
        setSubjects(mine.length > 0 ? mine : subs);
        setNoAssignment(mine.length === 0 && subs.length > 0);
      } else { setSubjects(subs); setNoAssignment(false); }
      setSelSubj('');
    });
  }, [selClass, isTeacher, session.staffId]);

  useEffect(() => {
    if (selClass && selTerm && selSubj) loadData();
    else { setStudents([]); setMarksData({}); setSavedRows(new Set()); }
  }, [selClass, selTerm, selSubj]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        getSmsStudents({ class_id: selClass }),
        getMarks({ class_id: selClass, term_id: selTerm, subject_id: selSubj }),
      ]);
      const stList = sRes.data.data || [];
      const mList  = mRes.data.data || [];
      setStudents(stList);
      const md = {};
      stList.forEach(st => {
        const m = mList.find(x => x.student_id === st.id);
        md[st.id] = { cat1: m?.cat1 ?? '', exam: m?.exam ?? '' };
      });
      setMarksData(md);
      setSavedRows(new Set(mList.map(m => m.student_id)));
    } catch { toast.error('Failed to load marks'); }
    finally { setLoading(false); }
  };

  const setMark = (stId, field, val) =>
    setMarksData(p => ({ ...p, [stId]: { ...p[stId], [field]: val } }));

  const handleSave = async () => {
    if (!selClass || !selTerm || !selSubj) { toast.error('Select class, term and subject'); return; }
    setSaving(true);
    try {
      const cls   = classes.find(c => c.id === selClass);
      const marks = students.map(st => ({
        student_id: st.id,
        cat1: parseFloat(marksData[st.id]?.cat1 || 0),
        exam: examEnabled ? parseFloat(marksData[st.id]?.exam || 0) : 0,
      }));
      await bulkUpsertMarks({ marks, subject_id: selSubj, term_id: selTerm, class_id: selClass, academic_year_id: cls?.academic_year_id });
      toast.success(`✅ ${marks.length} marks saved!`);
      setSavedRows(new Set(students.map(s => s.id)));
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleExcelDownload = async () => {
    if (!selClass || !selTerm) { toast.error('Select class and term'); return; }
    setDlExcel(true);
    try {
      const cls = classes.find(c=>c.id===selClass), trm = allTerms.find(t=>t.id===selTerm);
      const res = await SMS.get('/excel/class-report', { params:{ class_id:selClass, term_id:selTerm, academic_year_id: cls?.academic_year_id||'' }, responseType:'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href=url; a.download=`${cls?.name||'class'}_${trm?.name||'term'}_marks.xlsx`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Excel downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDlExcel(false); }
  };

  const sub         = subjects.find(s => s.id === selSubj);
  const maxTest     = sub ? (sub.max_test || 0) : 0;
  const maxExam     = sub ? (sub.max_exam || 0) : 0;
  const maxTot      = maxTest + maxExam || sub?.max_marks || 0;
  const examEnabled = maxExam > 0;
  const entryTerms  = allTerms.filter(t => t.number !== 4);
  const selCls      = classes.find(c => c.id === selClass);
  const selTrmObj   = allTerms.find(t => t.id === selTerm);

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Page header ──────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white"/>
              </div>
              Marks Entry
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-11">
              {isTeacher ? 'Enter marks for your assigned subjects only' : 'Enter marks per subject per term'}
            </p>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2 text-xs text-blue-700 max-w-xs">
              <Info className="w-3.5 h-3.5 shrink-0"/>
              {noAssignment ? 'No subjects assigned yet — showing all. Ask DoS.' : 'You see only subjects assigned to you by DoS'}
            </div>
          )}
        </div>

        {/* ── Config card ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gradient-to-r from-blue-600 to-indigo-600">
            <h2 className="text-white font-semibold text-sm">Select Class, Term & Subject</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Class" value={selClass} onChange={e => { setSelClass(e.target.value); setSelSubj(''); }}>
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
              </Select>

              <Select label="Term (T1/T2/T3 only)" value={selTerm} onChange={e => setSelTerm(e.target.value)}
                hint="Annual is auto-calculated from T1+T2+T3">
                <option value="">— Select Term —</option>
                {entryTerms.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' ✓ Current' : ''}</option>
                ))}
              </Select>

              <Select label={isTeacher ? 'Subject (your subjects)' : 'Subject'}
                value={selSubj} onChange={e => setSelSubj(e.target.value)} disabled={!selClass}>
                <option value="">— Select Subject —</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (max: {(s.max_test||0)+(s.max_exam||0)||s.max_marks||100}){s.coefficient>1?` ×${s.coefficient}`:''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Subject max points */}
            {sub && (
              <div className="flex flex-wrap gap-2.5 pt-1 border-t border-gray-50">
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"/>
                  <span className="text-xs text-gray-500">TEST max</span>
                  <span className="text-sm font-bold text-blue-700 ml-0.5">{maxTest}</span>
                </div>
                {examEnabled && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"/>
                    <span className="text-xs text-gray-500">EXAM max</span>
                    <span className="text-sm font-bold text-emerald-700 ml-0.5">{maxExam}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400"/>
                  <span className="text-xs text-gray-500">TOTAL max</span>
                  <span className="text-sm font-bold text-gray-900 ml-0.5">{maxTot}</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3.5 py-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"/>
                  <span className="text-xs text-gray-500">Coefficient</span>
                  <span className="text-sm font-bold text-purple-700 ml-0.5">×{sub.coefficient||1}</span>
                </div>
                {!examEnabled && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-amber-700">
                    TEST only — no exam
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Marks table ──────────────────────────────── */}
        {students.length > 0 && selSubj && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">{sub?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selCls?.name} · {selTrmObj?.name} · {students.length} students · Max {maxTot} pts
                </p>
              </div>
              <div className="flex gap-2">
                {selClass && selTerm && (
                  <button onClick={handleExcelDownload} disabled={dlExcel}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {dlExcel
                      ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
                      : <Download className="w-3.5 h-3.5 text-emerald-600"/>}
                    Excel
                  </button>
                )}
                <button onClick={loadData} disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/>
                  Refresh
                </button>
                <button onClick={handleSave} disabled={saving || loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors shadow-sm">
                  {saving
                    ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <Save className="w-3.5 h-3.5"/>}
                  Save All
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0a2156] text-white text-xs">
                    <th className="py-3 px-4 text-left w-9 font-semibold">#</th>
                    <th className="py-3 px-3 text-left font-semibold">ID</th>
                    <th className="py-3 px-3 text-left font-semibold">Student Name</th>
                    {/* MAX POINT group */}
                    <th className="py-3 px-2 text-center border-l border-blue-800/50" colSpan={examEnabled?3:2}>
                      <div className="text-[10px] text-blue-300 font-medium">MAX POINT</div>
                      <div className="flex gap-px mt-0.5 justify-center text-[11px]">
                        <span className="px-2">TEST</span>
                        {examEnabled && <span className="px-2 border-l border-blue-800/50">EXAM</span>}
                        <span className="px-2 border-l border-blue-800/50">TOT</span>
                      </div>
                    </th>
                    {/* O.P group */}
                    <th className="py-3 px-2 text-center border-l border-blue-800/50" colSpan={examEnabled?3:2}>
                      <div className="text-[10px] text-green-300 font-medium">O.P (Obtained Points)</div>
                      <div className="flex gap-px mt-0.5 justify-center text-[11px]">
                        <span className="px-2">TEST</span>
                        {examEnabled && <span className="px-2 border-l border-blue-800/50">EXAM</span>}
                        <span className="px-2 border-l border-blue-800/50">TOT</span>
                      </div>
                    </th>
                    <th className="py-3 px-2 text-center font-semibold text-xs border-l border-blue-800/50">%</th>
                    <th className="py-3 px-2 text-center font-semibold text-xs">Grade</th>
                    <th className="py-3 px-2 text-center font-semibold text-xs w-8">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, i) => {
                    const m    = marksData[st.id] || {};
                    const cat1 = parseFloat(m.cat1 || 0);
                    const exam = examEnabled ? parseFloat(m.exam || 0) : 0;
                    const tot  = cat1 + exam;
                    const pct  = maxTot > 0 ? Math.min(100, (tot / maxTot) * 100) : 0;
                    const grd  = pct>=80?'A1':pct>=70?'B2':pct>=60?'C3':pct>=50?'D4':pct>=40?'E5':'F';
                    const isSaved = savedRows.has(st.id);

                    return (
                      <tr key={st.id} className={`border-b border-gray-50 transition-colors ${i%2===0?'bg-white':'bg-gray-50/50'} hover:bg-blue-50/20`}>
                        <td className="py-2.5 px-4 text-gray-300 text-xs font-medium">{i+1}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-blue-600 font-bold">{st.student_id}</td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900 text-sm">{(st.last_name||'').toUpperCase()} {st.first_name}</td>
                        {/* MAX cols */}
                        <td className="py-2.5 px-2 text-center text-xs text-gray-300 font-medium border-l border-gray-100">{maxTest}</td>
                        {examEnabled && <td className="py-2.5 px-2 text-center text-xs text-gray-300 font-medium">{maxExam}</td>}
                        <td className="py-2.5 px-2 text-center text-xs text-gray-400 font-bold">{maxTot}</td>
                        {/* O.P cols */}
                        <td className="py-2 px-2 border-l border-gray-100">
                          <input type="number" min="0" max={maxTest} step="0.5"
                            className="w-14 border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none transition-colors hover:border-gray-300"
                            value={m.cat1??''} onChange={e => setMark(st.id,'cat1',e.target.value)}/>
                        </td>
                        {examEnabled && (
                          <td className="py-2 px-2">
                            <input type="number" min="0" max={maxExam} step="0.5"
                              className="w-14 border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none transition-colors hover:border-gray-300"
                              value={m.exam??''} onChange={e => setMark(st.id,'exam',e.target.value)}/>
                          </td>
                        )}
                        <td className="py-2.5 px-2 text-center font-bold text-gray-900 text-sm">{tot>0?tot.toFixed(1):'—'}</td>
                        <td className="py-2.5 px-2 text-center border-l border-gray-100">
                          <span className="text-xs font-semibold text-gray-500">{tot>0?`${pct.toFixed(1)}%`:'—'}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {tot > 0 && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${GRADE_STYLE[grd]||'bg-gray-100 text-gray-600'}`}>
                              {grd}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {isSaved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto"/>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selClass && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-blue-400"/>
            </div>
            <p className="font-semibold text-gray-700">Select a class, term and subject</p>
            <p className="text-gray-400 text-sm mt-1">to start entering marks</p>
          </div>
        )}
      </div>
    </div>
  );
}
