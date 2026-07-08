import React, { useState, useEffect } from 'react';
import { FileText, Download, Star, RefreshCw, ChevronRight, GraduationCap } from 'lucide-react';
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
  const bytes = new Uint8Array(res.data).slice(0, 4);
  if (bytes[0] !== 80 && bytes[1] !== 75) { // not PK (xlsx)
    const text = new TextDecoder().decode(res.data);
    let msg = 'Server error';
    try { msg = JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  return new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const TERM_ACTIVE  = 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30';
const TERM_DEFAULT = 'bg-[#1a1d27] border-white/[0.08] text-gray-400 hover:border-blue-500/40 hover:text-white';

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
  const [remarks,   setRemarks]   = useState({ teacher: '', head: '', conduct: 'Good' });

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
      .catch(() => toast.error('Failed to load'));
  }, []);

  useEffect(() => {
    if (selClass) getSmsStudents({ class_id: selClass }).then(r => setStudents(r.data.data || []));
    else setStudents([]);
  }, [selClass]);

  useEffect(() => {
    if (selClass && selTerm) getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    else setBulletins([]);
  }, [selClass, selTerm]);

  const selectedTerm = terms.find(t => t.id === selTerm);
  const isAnnual     = selectedTerm?.number === 4;
  const filteredTerms= terms.filter(t => !selYear || t.academic_year_id === selYear).sort((a,b)=>a.number-b.number);

  const handleGenerateAll = async () => {
    if (!selClass || !selTerm || !selYear) { toast.error('Select class, term and year'); return; }
    setGenAll(true);
    try {
      const blob = await fetchXLSX('/bulletins/generate-class', {
        term_id: selTerm, class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      downloadBlob(blob, `${cls?.name||'class'}_${trm?.name||'term'}_bulletins.xlsx`);
      toast.success(`✅ ${students.length} bulletins downloaded as Excel!`);
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
      toast.success('✅ Bulletin downloaded!');
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setGenOne(''); }
  };

  const ready = selClass && selTerm && selYear;

  return (
    <div className="min-h-screen bg-[#0f1117]">

      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0a2456] via-[#0d2f6e] to-[#0a2456] px-6 pt-8 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-400"/>
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Report Cards</h1>
              <p className="text-blue-300 text-xs mt-0.5">Generate & download bulletins per term or annual</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4 pb-8 space-y-4">

        {/* Config card */}
        <div className="bg-[#13151c] border border-white/[0.08] rounded-2xl p-5 space-y-5">

          {/* Class + Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Class *</label>
              <select value={selClass} onChange={e => setSelClass(e.target.value)}
                className="w-full bg-[#1a1d27] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition-colors">
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Academic Year *</label>
              <select value={selYear} onChange={e => setSelYear(e.target.value)}
                className="w-full bg-[#1a1d27] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition-colors">
                <option value="">— Select Year —</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
              </select>
            </div>
          </div>

          {/* Term buttons */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Term *</label>
            {filteredTerms.length === 0 ? (
              <p className="text-xs text-gray-600">No terms — create them in Classes &amp; Years</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTerms.map(t => (
                  <button key={t.id} onClick={() => setSelTerm(t.id)}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5
                      ${selTerm === t.id ? TERM_ACTIVE : TERM_DEFAULT}`}>
                    {t.number === 4 && <Star className="w-3 h-3"/>}
                    {t.name}
                    {t.number === 4 && <span className="text-[10px] opacity-70">(avg T1+T2+T3)</span>}
                    {t.is_current && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>}
                  </button>
                ))}
              </div>
            )}
            {isAnnual && (
              <div className="mt-2 flex items-center gap-2 bg-amber-900/20 border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-400">
                <Star className="w-3.5 h-3.5 shrink-0"/>
                Annual = average of Term 1 + Term 2 + Term 3
              </div>
            )}
          </div>

          {/* Remarks */}
          <div className="border-t border-white/[0.06] pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['Teacher Remarks', 'teacher', 'e.g. Good progress'],
              ['Head Teacher Remarks', 'head', 'e.g. Keep it up'],
            ].map(([lbl, key, ph]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">{lbl}</label>
                <input value={remarks[key]} onChange={e => setRemarks(r => ({...r,[key]:e.target.value}))}
                  placeholder={ph}
                  className="w-full bg-[#1a1d27] border border-white/[0.08] text-white rounded-xl px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/60 transition-colors"/>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Conduct</label>
              <select value={remarks.conduct} onChange={e => setRemarks(r => ({...r,conduct:e.target.value}))}
                className="w-full bg-[#1a1d27] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition-colors">
                {['Excellent','Very Good','Good','Fair','Poor'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Download all */}
        {ready && (
          <button onClick={handleGenerateAll} disabled={genAll}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-900/30">
            {genAll
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating Excel…</>
              : <><Download className="w-4 h-4"/> Download All {students.length} Report Cards (.xlsx)</>}
          </button>
        )}

        {/* Students list */}
        {students.length > 0 && (
          <div className="bg-[#13151c] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                {students.length} students
                {selectedTerm && <span className="text-xs font-normal text-gray-500">— {selectedTerm.name}</span>}
              </span>
              <button onClick={() => getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []))}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors">
                <RefreshCw className="w-3.5 h-3.5"/>
              </button>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {students.map(st => {
                const b = bulletins.find(bul => bul.student_id === st.id);
                const isGen = genOne === st.id;
                return (
                  <div key={st.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                    {/* Photo */}
                    <div className="w-9 h-11 rounded-lg overflow-hidden bg-white/5 border border-white/[0.06] shrink-0">
                      {st.photo_url
                        ? <img src={st.photo_url} className="w-full h-full object-cover" alt=""/>
                        : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">
                            {(st.first_name||'?').charAt(0)}
                          </div>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">
                        {st.last_name?.toUpperCase()} {st.first_name}
                      </p>
                      <p className="text-xs text-gray-500">{st.student_id}</p>
                    </div>

                    {/* Previous result */}
                    {b && (
                      <div className="text-right mr-2 shrink-0">
                        <p className="text-sm font-bold text-blue-400">{b.percentage?.toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-600">Rank {b.rank_in_class}/{b.class_size}</p>
                      </div>
                    )}

                    {/* Download individual */}
                    <button onClick={() => handleGenerateOne(st)}
                      disabled={!selTerm || !selYear || !!genOne}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/30 disabled:opacity-40 transition-colors shrink-0">
                      {isGen
                        ? <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                        : <Download className="w-3.5 h-3.5"/>}
                      .xlsx
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selClass && (
          <div className="text-center py-16 text-gray-600">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20"/>
            <p className="text-sm font-medium">Select a class and term to generate report cards</p>
          </div>
        )}
      </div>
    </div>
  );
}
