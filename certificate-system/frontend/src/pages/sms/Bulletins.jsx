import React, { useState, useEffect } from 'react';
import { FileText, Download, Users, Star, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsClasses, getTerms, getAcademicYears, getSmsStudents, getBulletins, generateBulletin, generateClassBulletins, downloadBlob } from '../../api';

const TERM_COLORS = {
  1: 'bg-blue-100 text-blue-700 border-blue-200',
  2: 'bg-green-100 text-green-700 border-green-200',
  3: 'bg-purple-100 text-purple-700 border-purple-200',
  4: 'bg-amber-100 text-amber-700 border-amber-200',
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

  const handleGenerateAll = async () => {
    if (!selClass || !selTerm || !selYear) { toast.error('Select class, term and year'); return; }
    setGenAll(true);
    try {
      const res = await generateClassBulletins({
        term_id: selTerm, class_id: selClass,
        academic_year_id: selYear, ...remarks,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head,
      });
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }),
        `${cls?.name || 'class'}_${trm?.name || 'term'}_bulletins.pdf`);
      toast.success('✅ All bulletins downloaded!');
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data || []));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate');
    } finally { setGenAll(false); }
  };

  const handleGenerateOne = async (student) => {
    if (!selTerm || !selYear) { toast.error('Select term and year first'); return; }
    setGenOne(student.id);
    try {
      const res = await generateBulletin({
        student_id: student.id, term_id: selTerm,
        class_id: selClass, academic_year_id: selYear,
        teacher_remarks: remarks.teacher, head_remarks: remarks.head,
        conduct: remarks.conduct,
      });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }),
        `${student.student_id || student.id}_bulletin.pdf`);
      toast.success('✅ Bulletin downloaded!');
    } catch { toast.error('Failed to generate'); }
    finally { setGenOne(''); }
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

      {/* ── Generate all button ───────────────────────────────── */}
      {selClass && selTerm && selYear && (
        <button onClick={handleGenerateAll} disabled={genAll}
          className="w-full btn-primary py-3 mb-5 justify-center text-sm">
          {genAll
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating PDFs…</>
            : <><Users className="w-4 h-4"/> Download All {students.length} Bulletins — {selectedTerm?.name}</>}
        </button>
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
              const isGen = genOne === st.id;
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
                  <button onClick={() => handleGenerateOne(st)}
                    disabled={!selTerm || !selYear || isGen}
                    className="btn-secondary text-xs py-1.5 shrink-0">
                    {isGen
                      ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
                      : <><Download className="w-3.5 h-3.5"/> PDF</>}
                  </button>
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
