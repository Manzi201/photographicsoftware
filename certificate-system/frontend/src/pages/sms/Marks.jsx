import React, { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsClasses, getTerms, getSmsSubjects, getSmsStudents, getMarks, bulkUpsertMarks } from '../../api';

export default function SmsMarks() {
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [marksData,setMarksData]= useState({});
  const [selClass, setSelClass] = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [selSubj,  setSelSubj]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms()]).then(([c,t]) => {
      setClasses(c.data.data || []);
      setTerms(t.data.data   || []);
    }).catch(err => {
      const msg = err.code === 'ECONNABORTED' ? 'Server waking up, please wait 30s and refresh' : (err.response?.data?.error || 'Failed to load');
      toast.error(msg);
    });
  }, []);

  useEffect(() => {
    if (selClass) getSmsSubjects({ class_id: selClass }).then(r => setSubjects(r.data.data || []));
  }, [selClass]);

  useEffect(() => {
    if (selClass && selTerm && selSubj) loadData();
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
        md[st.id] = { cat1: m?.cat1??'', cat2: m?.cat2??'', exam: m?.exam??'', total: m?.total, percentage: m?.percentage, grade: m?.grade };
      });
      setMarksData(md);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const setMark = (stId, field, val) => {
    setMarksData(p => ({ ...p, [stId]: { ...p[stId], [field]: val } }));
  };

  const handleSave = async () => {
    if (!selClass || !selTerm || !selSubj) { toast.error('Select class, term and subject'); return; }
    setSaving(true);
    try {
      const cls = classes.find(c => c.id === selClass);
      const marks = students.map(st => ({
        student_id: st.id,
        cat1: marksData[st.id]?.cat1 || 0,
        cat2: marksData[st.id]?.cat2 || 0,
        exam: marksData[st.id]?.exam || 0,
      }));
      await bulkUpsertMarks({ marks, subject_id: selSubj, term_id: selTerm, class_id: selClass, academic_year_id: cls?.academic_year_id });
      toast.success(`${marks.length} marks saved!`);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const sub = subjects.find(s => s.id === selSubj);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Marks Entry</h1>
        <p className="text-gray-500 mt-0.5">Enter marks per subject per term</p>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="grid grid-cols-3 gap-4">
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
            <select className="select-field" value={selSubj} onChange={e => setSelSubj(e.target.value)} disabled={!selClass}>
              <option value="">— Select Subject —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Marks table */}
      {students.length > 0 && selSubj && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {sub?.name} — Max: {sub?.max_marks || 100} marks ({students.length} students)
            </span>
            <div className="flex gap-2">
              <button onClick={loadData} disabled={loading} className="btn-secondary text-xs py-1.5">
                <RefreshCw className="w-3.5 h-3.5"/> Refresh
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5">
                {saving ? 'Saving...' : <><Save className="w-3.5 h-3.5"/> Save All</>}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-900 text-white">
                  {['#','Student ID','Name','CA1','CA2','Exam','Total','%','Grade'].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => {
                  const m = marksData[st.id] || {};
                  const c1 = parseFloat(m.cat1||0), c2 = parseFloat(m.cat2||0), ex = parseFloat(m.exam||0);
                  const tot = c1+c2+ex;
                  const pct = sub ? Math.min(100,(tot/(sub.max_marks||100))*100).toFixed(1) : '—';
                  const grd = !sub ? '—' : pct>=80?'A1':pct>=70?'B2':pct>=60?'C3':pct>=50?'D4':pct>=40?'E5':'F';
                  return (
                    <tr key={st.id} className={`border-b ${i%2===0?'bg-white':'bg-gray-50'}`}>
                      <td className="py-2 px-3 text-gray-400 text-xs">{i+1}</td>
                      <td className="py-2 px-3 font-mono text-xs text-blue-600">{st.student_id}</td>
                      <td className="py-2 px-3 font-medium">{st.first_name} {st.last_name}</td>
                      {['cat1','cat2','exam'].map(field => (
                        <td key={field} className="py-2 px-3">
                          <input type="number" min="0" max={sub?.max_marks||100} step="0.5"
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                            value={m[field]??''} onChange={e => setMark(st.id, field, e.target.value)}/>
                        </td>
                      ))}
                      <td className="py-2 px-3 font-bold text-gray-800">{tot.toFixed(1)}</td>
                      <td className="py-2 px-3 text-gray-500">{pct}%</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded
                          ${grd==='A1'?'bg-green-100 text-green-700':grd==='F'?'bg-red-100 text-red-700':'bg-blue-100 text-blue-700'}`}>
                          {grd}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!selClass && <p className="text-center text-gray-400 py-10">Select a class, term, and subject to enter marks</p>}
    </div>
  );
}
