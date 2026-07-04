import React, { useState, useEffect } from 'react';
import { FileText, Download, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsClasses, getTerms, getAcademicYears, getSmsStudents, getBulletins, generateBulletin, generateClassBulletins, downloadBlob } from '../../api';

export default function SmsBulletins() {
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [years,    setYears]    = useState([]);
  const [students, setStudents] = useState([]);
  const [bulletins,setBulletins]= useState([]);
  const [selClass, setSelClass] = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [selYear,  setSelYear]  = useState('');
  const [genAll,   setGenAll]   = useState(false);
  const [remarks,  setRemarks]  = useState({ teacher: '', head: '', conduct: 'Good' });
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getAcademicYears()]).then(([c,t,y]) => {
      setClasses(c.data.data||[]); setTerms(t.data.data||[]); setYears(y.data.data||[]);
    });
  }, []);

  useEffect(() => {
    if (selClass) getSmsStudents({ class_id: selClass }).then(r => setStudents(r.data.data||[]));
  }, [selClass]);

  useEffect(() => {
    if (selClass && selTerm) getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data||[]));
  }, [selClass, selTerm]);

  const handleGenerateAll = async () => {
    if (!selClass || !selTerm || !selYear) { toast.error('Select class, term and year'); return; }
    setLoading(true);
    try {
      const res = await generateClassBulletins({ term_id: selTerm, class_id: selClass, academic_year_id: selYear, ...remarks });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const cls  = classes.find(c => c.id === selClass);
      const trm  = terms.find(t => t.id === selTerm);
      downloadBlob(blob, `${cls?.name||'class'}_${trm?.name||'term'}_bulletins.pdf`);
      toast.success('All bulletins downloaded!');
      getBulletins({ class_id: selClass, term_id: selTerm }).then(r => setBulletins(r.data.data||[]));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleGenerateOne = async (student) => {
    if (!selTerm || !selYear) { toast.error('Select term and year'); return; }
    try {
      const res = await generateBulletin({ student_id: student.id, term_id: selTerm, class_id: selClass, academic_year_id: selYear, ...remarks });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      downloadBlob(blob, `${student.student_id}_bulletin.pdf`);
      toast.success('Bulletin downloaded!');
    } catch (err) { toast.error('Failed to generate'); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Cards (Bulletins)</h1>
        <p className="text-gray-500 mt-0.5">Generate and download student report cards</p>
      </div>

      {/* Selection */}
      <div className="card mb-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
            <select className="select-field" value={selClass} onChange={e => setSelClass(e.target.value)}>
              <option value="">— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Term</label>
            <select className="select-field" value={selTerm} onChange={e => setSelTerm(e.target.value)}>
              <option value="">— Select Term —</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <select className="select-field" value={selYear} onChange={e => setSelYear(e.target.value)}>
              <option value="">— Select Year —</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Teacher Remarks</label>
            <input className="input-field" value={remarks.teacher} onChange={e => setRemarks(r=>({...r,teacher:e.target.value}))} placeholder="e.g. Good progress"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Head Remarks</label>
            <input className="input-field" value={remarks.head} onChange={e => setRemarks(r=>({...r,head:e.target.value}))} placeholder="e.g. Keep it up"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Conduct</label>
            <select className="select-field" value={remarks.conduct} onChange={e => setRemarks(r=>({...r,conduct:e.target.value}))}>
              {['Excellent','Very Good','Good','Fair','Poor'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {selClass && selTerm && (
        <div className="flex gap-3 mb-5">
          <button onClick={handleGenerateAll} disabled={loading}
            className="btn-primary flex-1 justify-center py-3">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating...</>
              : <><Users className="w-4 h-4"/> Download All ({students.length}) Bulletins</>}
          </button>
        </div>
      )}

      {/* Students list */}
      {students.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 bg-gray-50 border-b">
            <span className="text-sm font-semibold text-gray-700">{students.length} students</span>
          </div>
          <div className="divide-y divide-gray-50">
            {students.map(st => {
              const bulletin = bulletins.find(b => b.student_id === st.id);
              return (
                <div key={st.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="w-9 h-11 rounded-lg overflow-hidden bg-gray-100 border shrink-0">
                    {st.photo_url && <img src={st.photo_url} className="w-full h-full object-cover"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{st.first_name} {st.last_name}</p>
                    <p className="text-xs text-gray-400">{st.student_id}</p>
                  </div>
                  {bulletin && (
                    <div className="text-right mr-4">
                      <p className="text-sm font-bold text-blue-700">{bulletin.percentage?.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">Rank {bulletin.rank_in_class}/{bulletin.class_size}</p>
                    </div>
                  )}
                  <button onClick={() => handleGenerateOne(st)}
                    disabled={!selTerm || !selYear}
                    className="btn-secondary text-xs py-1.5 shrink-0">
                    <Download className="w-3.5 h-3.5"/> PDF
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
