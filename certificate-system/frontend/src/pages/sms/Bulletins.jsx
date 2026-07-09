import React, { useState, useEffect } from 'react';
import { FileText, Download, Star, RefreshCw, GraduationCap, Users, ChevronDown, CheckCircle, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getAcademicYears, getSmsStudents, getBulletins, downloadBlob } from '../../api';

const SMS = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api', '/api/sms') ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://photographicsoftware-1.onrender.com/api/sms' : '/api/sms'),
  timeout: 120000,
});
SMS.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

async function fetchXLSX(endpoint, body) {
  const res = await SMS.post(endpoint, body, { responseType: 'arraybuffer' });
  const b = new Uint8Array(res.data).slice(0, 4);
  if (b[0] !== 80 || b[1] !== 75) {
    const text = new TextDecoder().decode(res.data);
    let msg = 'Server error'; try { msg = JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  return new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function fetchXLSXGet(endpoint, params) {
  const res = await SMS.get(endpoint, { params, responseType: 'arraybuffer' });
  const b = new Uint8Array(res.data).slice(0, 4);
  if (b[0] !== 80 || b[1] !== 75) {
    const text = new TextDecoder().decode(res.data);
    let msg = 'Server error'; try { msg = JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  return new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const TERM_NUMBER_LABEL = { 1:'T1', 2:'T2', 3:'T3', 4:'Ann.' };
const TERM_COLOR = {
  1: { ring:'ring-blue-200',   bg:'bg-blue-600',    dot:'bg-blue-400'   },
  2: { ring:'ring-green-200',  bg:'bg-green-600',   dot:'bg-green-400'  },
  3: { ring:'ring-purple-200', bg:'bg-purple-600',  dot:'bg-purple-400' },
  4: { ring:'ring-amber-200',  bg:'bg-amber-500',   dot:'bg-amber-400'  },
};

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
  const [remarks,   setRemarks]   = useState({ teacher:'', head:'', conduct:'Good' });
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getAcademicYears()])
      .then(([c,t,y]) => {
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
    if (selClass && selTerm) getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    else setBulletins([]);
  }, [selClass, selTerm]);

  const selectedTerm  = terms.find(t => t.id === selTerm);
  const isAnnual      = selectedTerm?.number === 4;
  const filteredTerms = terms.filter(t => !selYear || t.academic_year_id === selYear).sort((a,b)=>a.number-b.number);
  const selectedClass = classes.find(c => c.id === selClass);
  const ready         = selClass && selTerm && selYear;

  const handleGenerateAll = async () => {
    if (!ready) { toast.error('Select class, term and year'); return; }
    setGenAll(true);
    try {
      const blob = await fetchXLSX('/bulletins/generate-class', {
        term_id: selTerm, class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      downloadBlob(blob, `${selectedClass?.name||'class'}_${selectedTerm?.name||'term'}_bulletins.xlsx`);
      toast.success(`✅ ${students.length} bulletins downloaded!`);
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    } catch (err) { toast.error(err.message || 'Failed', { duration: 6000 }); }
    finally { setGenAll(false); }
  };

  const handleGenerateOne = async (student) => {
    if (!selTerm || !selYear) { toast.error('Select term and year first'); return; }
    setGenOne(student.id);
    try {
      const blob = await fetchXLSX('/bulletins/generate', {
        student_id: student.id, term_id: selTerm, class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      downloadBlob(blob, `${student.student_id||student.id}_bulletin.xlsx`);
      toast.success('✅ Downloaded!');
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setGenOne(''); }
  };

  const handleGenerateAnnual = async () => {
    if (!selClass || !selYear) { toast.error('Select class and year first'); return; }
    setGenAnnual(true);
    try {
      const blob = await fetchXLSXGet('/excel/annual-report', {
        class_id: selClass, academic_year_id: selYear,
      });
      downloadBlob(blob, `${selectedClass?.name||'class'}_annual_report.xlsx`);
      toast.success('✅ Annual Progressive Report downloaded!');
    } catch (err) { toast.error(err.message || 'Failed', { duration: 6000 }); }
    finally { setGenAnnual(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Page header ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white"/>
              </div>
              Report Cards
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-11">Generate & download Excel bulletins per term or annual</p>
          </div>
          {ready && students.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
              <Users className="w-4 h-4 text-blue-500"/>
              <span className="text-sm font-semibold text-blue-700">{students.length} students</span>
            </div>
          )}
        </div>

        {/* ── Config card ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-4 border-b border-gray-50 bg-gradient-to-r from-blue-600 to-indigo-600">
            <h2 className="text-white font-semibold text-sm">Select Class & Term</h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Class + Year row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Class</label>
                <div className="relative">
                  <select value={selClass} onChange={e => setSelClass(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">— Select Class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Academic Year</label>
                <div className="relative">
                  <select value={selYear} onChange={e => setSelYear(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">— Select Year —</option>
                    {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                </div>
              </div>
            </div>

            {/* Term buttons */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Term</label>
              {filteredTerms.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No terms found — create them in Classes &amp; Years</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {filteredTerms.map(t => {
                    const tc = TERM_COLOR[t.number] || TERM_COLOR[1];
                    const isSelected = selTerm === t.id;
                    return (
                      <button key={t.id} onClick={() => setSelTerm(t.id)}
                        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200
                          ${isSelected
                            ? `${tc.bg} border-transparent text-white shadow-lg scale-105`
                            : `bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50`}`}>
                        {t.number === 4 && <Star className={`w-3.5 h-3.5 ${isSelected ? 'text-white/80' : 'text-amber-400'}`}/>}
                        <span>{t.name}</span>
                        {t.number === 4 && (
                          <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>avg T1+T2+T3</span>
                        )}
                        {t.is_current && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : tc.dot}`}/>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {isAnnual && (
                <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-sm text-amber-700">
                  <Star className="w-4 h-4 shrink-0 text-amber-500"/>
                  <span>Annual report card = average of <strong>Term 1 + Term 2 + Term 3</strong></span>
                </div>
              )}
            </div>

            {/* Remarks */}
            <div className="border-t border-gray-100 pt-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Remarks & Conduct (optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Teacher Remarks</label>
                  <input value={remarks.teacher} onChange={e => setRemarks(r=>({...r,teacher:e.target.value}))}
                    placeholder="e.g. Good progress"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Head Teacher Remarks</label>
                  <input value={remarks.head} onChange={e => setRemarks(r=>({...r,head:e.target.value}))}
                    placeholder="e.g. Keep it up"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Conduct</label>
                  <div className="relative">
                    <select value={remarks.conduct} onChange={e => setRemarks(r=>({...r,conduct:e.target.value}))}
                      className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                      {['Excellent','Very Good','Good','Fair','Poor'].map(c=><option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Download buttons ──────────────────────────── */}
        {ready && (
          <div className="space-y-3">
            {/* Term bulletins */}
            <button onClick={handleGenerateAll} disabled={genAll}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5">
              {genAll
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating Excel bulletins…</>
                : <><Download className="w-4 h-4"/> Download All {students.length} Report Cards &nbsp;·&nbsp; .xlsx Excel</>}
            </button>
            {/* Annual Progressive School Report */}
            {selClass && selYear && (
              <button onClick={handleGenerateAnnual} disabled={genAnnual}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5">
                {genAnnual
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating Annual Report…</>
                  : <><BookOpen className="w-4 h-4"/> Download Annual Progressive Report &nbsp;·&nbsp; T1 + T2 + T3</>}
              </button>
            )}
          </div>
        )}

        {/* ── Students list ─────────────────────────────────── */}
        {students.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* List header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600"/>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{students.length} Students</p>
                  {selectedTerm && <p className="text-xs text-gray-400 mt-0.5">{selectedClass?.name} · {selectedTerm.name}</p>}
                </div>
              </div>
              <button onClick={() => getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data||[]))}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors">
                <RefreshCw className="w-3.5 h-3.5"/> Refresh
              </button>
            </div>

            {/* Student rows */}
            <div className="divide-y divide-gray-50">
              {students.map((st, idx) => {
                const b     = bulletins.find(bul => bul.student_id === st.id);
                const isGen = genOne === st.id;
                return (
                  <div key={st.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors group">
                    {/* Rank */}
                    <span className="text-xs font-bold text-gray-300 w-5 text-right shrink-0">{idx+1}</span>

                    {/* Photo */}
                    <div className="w-9 h-11 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                      {st.photo_url
                        ? <img src={st.photo_url} className="w-full h-full object-cover" alt=""/>
                        : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 text-sm font-bold">
                            {(st.first_name||'?').charAt(0)}
                          </div>}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {(st.last_name||'').toUpperCase()} {st.first_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{st.student_id}</p>
                    </div>

                    {/* Previous result badge */}
                    {b ? (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 shrink-0">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-500"/>
                        <div className="text-right">
                          <p className="text-xs font-bold text-blue-700">{b.percentage?.toFixed(1)}%</p>
                          <p className="text-[10px] text-blue-400">#{b.rank_in_class}/{b.class_size}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl border border-dashed border-gray-200 shrink-0">
                        <p className="text-[10px] text-gray-400">Not generated</p>
                      </div>
                    )}

                    {/* Download individual */}
                    <button onClick={() => handleGenerateOne(st)}
                      disabled={!selTerm || !selYear || !!genOne}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 transition-all shadow-sm hover:shadow-md shrink-0 opacity-0 group-hover:opacity-100">
                      {isGen
                        ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                        : <Download className="w-3.5 h-3.5"/>}
                      .xlsx
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!selClass && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-blue-400"/>
            </div>
            <p className="font-semibold text-gray-700">Select a class and term</p>
            <p className="text-gray-400 text-sm mt-1">Then download Excel report cards for all students</p>
          </div>
        )}
      </div>
    </div>
  );
}
