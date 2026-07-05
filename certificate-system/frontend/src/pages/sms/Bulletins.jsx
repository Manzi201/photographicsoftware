import React, { useState, useEffect } from 'react';
import { FileText, Download, Users, Star, RefreshCw, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getAcademicYears, getSmsStudents, getBulletins, downloadBlob } from '../../api';

// ── Axios instance with auth + blob support ───────────────────
const SMS = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api', '/api/sms') ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://photographicsoftware-1.onrender.com/api/sms' : '/api/sms'),
  timeout: 120000, // 2 min — PDF generation takes time
});
SMS.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

async function fetchPDF(endpoint, body) {
  const res = await SMS.post(endpoint, body, { responseType: 'arraybuffer' });
  // Verify it's actually a PDF (starts with %PDF)
  const bytes = new Uint8Array(res.data).slice(0, 4);
  const header = String.fromCharCode(...bytes);
  if (header !== '%PDF') {
    // It's an error response encoded as arraybuffer
    const text = new TextDecoder().decode(res.data);
    let msg = 'Server error';
    try { msg = JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg);
  }
  return new Blob([res.data], { type: 'application/pdf' });
}

function openAndPrint(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => { win.focus(); win.print(); });
  } else {
    toast.error('Pop-up blocked — allow pop-ups and try again');
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const TERM_COLORS = {
  1: 'border-blue-300 text-blue-700 bg-blue-50',
  2: 'border-green-300 text-green-700 bg-green-50',
  3: 'border-purple-300 text-purple-700 bg-purple-50',
  4: 'border-amber-300 text-amber-700 bg-amber-50',
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
  const [genAll,    setGenAll]    = useState('');   // '' | 'download' | 'print'
  const [genOne,    setGenOne]    = useState('');   // studentId_action
  const [remarks,   setRemarks]   = useState({ teacher: '', head: '', conduct: 'Good' });

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getAcademicYears()])
      .then(([c, t, y]) => {
        setClasses(c.data.data || []);
        setTerms(t.data.data   || []);
        const yrs = y.data.data || [];
        setYears(yrs);
        // Auto-select current year
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
    if (selClass && selTerm) {
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    } else setBulletins([]);
  }, [selClass, selTerm]);

  const selectedTerm = terms.find(t => t.id === selTerm);
  const isAnnual = selectedTerm?.number === 4;

  const handleGenerateAll = async (action = 'download') => {
    if (!selClass || !selTerm || !selYear) { toast.error('Select class, term and year'); return; }
    setGenAll(action);
    try {
      const blob = await fetchPDF('/bulletins/generate-class', {
        term_id: selTerm, class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      const fname = `${cls?.name || 'class'}_${trm?.name || 'term'}_bulletins.pdf`;
      if (action === 'print') {
        openAndPrint(blob);
      } else {
        downloadBlob(blob, fname);
        toast.success(`✅ ${students.length} bulletins downloaded!`);
      }
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    } catch (err) {
      toast.error(err.message || 'Failed to generate bulletins', { duration: 6000 });
      console.error('generateAll error:', err);
    } finally { setGenAll(''); }
  };

  const handleGenerateOne = async (student, action = 'download') => {
    if (!selTerm || !selYear) { toast.error('Select term and year first'); return; }
    setGenOne(student.id + '_' + action);
    try {
      const blob = await fetchPDF('/bulletins/generate', {
        student_id: student.id, term_id: selTerm,
        class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head, conduct: remarks.conduct,
      });
      if (action === 'print') {
        openAndPrint(blob);
      } else {
        downloadBlob(blob, `${student.student_id || student.id}_bulletin.pdf`);
        toast.success('✅ Bulletin downloaded!');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate', { duration: 6000 });
      console.error('generateOne error:', err);
    } finally { setGenOne(''); }
  };

  // Group terms by year for display
  const termsByYear = terms.reduce((acc, t) => {
    const y = years.find(yr => yr.id === t.academic_year_id);
    const key = y?.name || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600"/> Report Cards
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate & download bulletins per term or annual</p>
      </div>

      {/* ── Selectors ─────────────────────────────────────────── */}
      <div className="card mb-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class *</label>
            <select className="select-field" value={selClass} onChange={e => setSelClass(e.target.value)}>
              <option value="">— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year *</label>
            <select className="select-field" value={selYear} onChange={e => setSelYear(e.target.value)}>
              <option value="">— Select Year —</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
            </select>
          </div>
        </div>

        {/* Term selector — visual buttons */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Term *</label>
          <div className="flex flex-wrap gap-2">
            {terms
              .filter(t => !selYear || t.academic_year_id === selYear)
              .sort((a, b) => a.number - b.number)
              .map(t => (
                <button key={t.id} onClick={() => setSelTerm(t.id)}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5
                    ${selTerm === t.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : `bg-white text-gray-600 border-gray-200 hover:border-blue-300 ${TERM_COLORS[t.number]?.split(' ')[0] || ''}`}`}>
                  {t.number === 4 && <Star className="w-3 h-3"/>}
                  {t.name}
                  {t.number === 4 && <span className="text-[10px] opacity-75">(avg T1+T2+T3)</span>}
                  {t.is_current && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>}
                </button>
              ))}
            {terms.filter(t => !selYear || t.academic_year_id === selYear).length === 0 && (
              <p className="text-xs text-gray-400">No terms — create them in Classes &amp; Years</p>
            )}
          </div>
          {isAnnual && (
            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 shrink-0"/>
              Annual report = average of Term 1 + Term 2 + Term 3 marks
            </div>
          )}
        </div>

        {/* Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Teacher Remarks</label>
            <input className="input-field text-sm" value={remarks.teacher}
              onChange={e => setRemarks(r => ({ ...r, teacher: e.target.value }))}
              placeholder="e.g. Good progress"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Head Teacher Remarks</label>
            <input className="input-field text-sm" value={remarks.head}
              onChange={e => setRemarks(r => ({ ...r, head: e.target.value }))}
              placeholder="e.g. Keep it up"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Conduct</label>
            <select className="select-field text-sm" value={remarks.conduct}
              onChange={e => setRemarks(r => ({ ...r, conduct: e.target.value }))}>
              {['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Generate all buttons ──────────────────────────── */}
      {selClass && selTerm && selYear && (
        <div className="flex gap-3 mb-5">
          <button onClick={() => handleGenerateAll('download')} disabled={!!genAll}
            className="btn-primary flex-1 justify-center py-3 text-sm">
            {genAll === 'download'
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating…</>
              : <><Download className="w-4 h-4"/> Download All {students.length} Bulletins</>}
          </button>
          <button onClick={() => handleGenerateAll('print')} disabled={!!genAll}
            className="btn-secondary flex-1 justify-center py-3 text-sm">
            {genAll === 'print'
              ? <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> Preparing…</>
              : <><Printer className="w-4 h-4"/> Print All {students.length}</>}
          </button>
        </div>
      )}

      {/* ── Students list ─────────────────────────────────────── */}
      {students.length > 0 && (
        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {students.length} students
              {selectedTerm && <span className="ml-2 text-xs font-normal text-gray-400">— {selectedTerm.name}</span>}
            </span>
            <button onClick={() => getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []))}
              className="btn-secondary text-xs py-1.5">
              <RefreshCw className="w-3 h-3"/> Refresh
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {students.map(st => {
              const bulletin = bulletins.find(b => b.student_id === st.id);
              return (
                <div key={st.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className="w-9 h-11 rounded-lg overflow-hidden bg-gray-100 border shrink-0">
                    {st.photo_url && <img src={st.photo_url} className="w-full h-full object-cover" alt=""/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{st.first_name} {st.last_name}</p>
                    <p className="text-xs text-gray-400">{st.student_id}</p>
                  </div>
                  {bulletin && (
                    <div className="text-right mr-3 shrink-0">
                      <p className="text-sm font-bold text-blue-700">{bulletin.percentage?.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">
                        Rank {bulletin.rank_in_class}/{bulletin.class_size}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleGenerateOne(st, 'download')}
                      disabled={!selTerm || !selYear || !!genOne}
                      title="Download PDF"
                      className="p-2 rounded-xl border border-gray-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors">
                      {genOne === st.id + '_download'
                        ? <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin block"/>
                        : <Download className="w-3.5 h-3.5"/>}
                    </button>
                    <button onClick={() => handleGenerateOne(st, 'print')}
                      disabled={!selTerm || !selYear || !!genOne}
                      title="Print"
                      className="p-2 rounded-xl border border-gray-200 text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors">
                      {genOne === st.id + '_print'
                        ? <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin block"/>
                        : <Printer className="w-3.5 h-3.5"/>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selClass && (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30"/>
          <p className="text-sm">Select a class and term to generate report cards</p>
        </div>
      )}
    </div>
  );
}
