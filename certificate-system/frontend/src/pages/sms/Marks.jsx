import React, { useState, useEffect, useMemo } from 'react';
import { Save, RefreshCw, BookOpen, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsClasses, getTerms, getSmsSubjects, getSmsStudents, getMarks, bulkUpsertMarks } from '../../api';

// ── Get current session info ─────────────────────────────────
function getSession() {
  try {
    const staff  = JSON.parse(localStorage.getItem('staff_data')  || '{}');
    const school = JSON.parse(localStorage.getItem('staff_school')|| '{}');
    return { role: staff.role || 'teacher', staffId: staff.id || null, school };
  } catch { return { role: 'teacher', staffId: null, school: {} }; }
}

export default function SmsMarks() {
  const session = useMemo(() => getSession(), []);
  const isTeacher = session.role === 'teacher';
  const isDos     = session.role === 'dos' || session.role === 'admin' || session.role === 'secretary';

  const [classes,   setClasses]   = useState([]);
  const [allTerms,  setAllTerms]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [marksData, setMarksData] = useState({});
  const [selClass,  setSelClass]  = useState('');
  const [selTerm,   setSelTerm]   = useState('');
  const [selSubj,   setSelSubj]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [noAssignment, setNoAssignment] = useState(false);

  // Load classes and terms on mount
  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms()])
      .then(([c, t]) => {
        const cls = c.data.data || [];
        const tms = (t.data.data || []).filter(t => t.number !== 4); // exclude Annual from marks entry
        setClasses(cls);
        setAllTerms(tms);
        // Auto-select current term
        const cur = tms.find(t => t.is_current);
        if (cur) setSelTerm(cur.id);
      })
      .catch(() => toast.error('Failed to load classes/terms'));
  }, []);

  // Load subjects when class changes — filter by teacher if role=teacher AND assignments exist
  useEffect(() => {
    if (!selClass) { setSubjects([]); setSelSubj(''); return; }
    getSmsSubjects({ class_id: selClass }).then(r => {
      let subs = r.data.data || [];
      if (isTeacher && session.staffId) {
        // Filter to subjects assigned to this teacher
        const mySubjects = subs.filter(s => s.teacher?.id === session.staffId || s.teacher_id === session.staffId);
        // If DoS hasn't assigned any yet, show all with a note (don't lock out teacher)
        setSubjects(mySubjects.length > 0 ? mySubjects : subs);
        setNoAssignment(mySubjects.length === 0 && subs.length > 0);
      } else {
        setSubjects(subs);
        setNoAssignment(false);
      }
      setSelSubj('');
    });
  }, [selClass, isTeacher, session.staffId]);

  // Load marks when class+term+subject selected
  useEffect(() => {
    if (selClass && selTerm && selSubj) loadData();
    else { setStudents([]); setMarksData({}); }
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
        md[st.id] = { cat1: m?.cat1 ?? '', cat2: m?.cat2 ?? '', exam: m?.exam ?? '' };
      });
      setMarksData(md);
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
      const sub   = subjects.find(s => s.id === selSubj);
      const maxM  = sub?.max_marks || 100;
      const marks = students.map(st => ({
        student_id: st.id,
        cat1: parseFloat(marksData[st.id]?.cat1 || 0),
        cat2: parseFloat(marksData[st.id]?.cat2 || 0),
        exam: parseFloat(marksData[st.id]?.exam || 0),
      }));
      await bulkUpsertMarks({
        marks, subject_id: selSubj, term_id: selTerm,
        class_id: selClass, academic_year_id: cls?.academic_year_id,
      });
      toast.success(`✅ ${marks.length} marks saved!`);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const sub = subjects.find(s => s.id === selSubj);
  // Max per section: cat1 = TEST max, cat2+exam = EX max
  const maxTest = sub ? Math.round((sub.max_marks || 100) / 2) : 0;
  const maxEx   = sub ? (sub.max_marks || 100) - maxTest : 0;
  const maxTot  = sub?.max_marks || 100;

  // Terms filtered — exclude Annual (number=4)
  const entryTerms = allTerms.filter(t => t.number !== 4);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600"/> Marks Entry
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isTeacher ? 'Enter marks for your assigned subjects only' : 'Enter marks per subject per term'}
          </p>
        </div>
        {isTeacher && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700">
            <Info className="w-3.5 h-3.5 shrink-0"/>
            {noAssignment
              ? 'No subjects assigned to you yet — showing all. Ask Director of Studies to assign your subjects.'
              : 'You see only subjects assigned to you by the Director of Studies'}
          </div>
        )}
      </div>

      {/* ── Selectors ─────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class *</label>
            <select className="select-field" value={selClass} onChange={e => { setSelClass(e.target.value); setSelSubj(''); }}>
              <option value="">— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Term * (T1/T2/T3 only)</label>
            <select className="select-field" value={selTerm} onChange={e => setSelTerm(e.target.value)}>
              <option value="">— Select Term —</option>
              {entryTerms.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_current ? ' ✓ Current' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-0.5">Annual is auto-calculated from T1+T2+T3</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Subject *{isTeacher ? ' (your subjects)' : ''}
            </label>
            <select className="select-field" value={selSubj} onChange={e => setSelSubj(e.target.value)} disabled={!selClass}>
              <option value="">— Select Subject —</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (max: {s.max_marks || 100}){s.coefficient > 1 ? ` ×${s.coefficient}` : ''}
                </option>
              ))}
            </select>
            {selClass && subjects.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {isTeacher ? '⚠ No subjects in this class — contact Director of Studies' : '⚠ No subjects — go to Classes & Years to add subjects'}
              </p>
            )}
            {selClass && noAssignment && subjects.length > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                ⚠ No subjects assigned to you yet — showing all (ask DoS to assign subjects to you)
              </p>
            )}
          </div>
        </div>

        {/* Max points display */}
        {sub && (
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs">
              <span className="text-gray-500">TEST max:</span>
              <span className="font-bold text-blue-700 ml-1">{maxTest}</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs">
              <span className="text-gray-500">EX max:</span>
              <span className="font-bold text-blue-700 ml-1">{maxEx}</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs">
              <span className="text-gray-500">TOTAL max:</span>
              <span className="font-bold text-blue-700 ml-1">{maxTot}</span>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs">
              <span className="text-gray-500">Coefficient:</span>
              <span className="font-bold text-purple-700 ml-1">×{sub.coefficient || 1}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Marks table ───────────────────────────────────────── */}
      {students.length > 0 && selSubj && (
        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-700">{sub?.name}</span>
              <span className="ml-2 text-xs text-gray-400">
                Max: {maxTot} pts · {students.length} students
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={loadData} disabled={loading} className="btn-secondary text-xs py-1.5">
                <RefreshCw className="w-3.5 h-3.5"/> Refresh
              </button>
              <button onClick={handleSave} disabled={saving || loading} className="btn-primary text-xs py-1.5">
                {saving ? 'Saving…' : <><Save className="w-3.5 h-3.5"/> Save All</>}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a2156] text-white text-xs">
                  <th className="py-2 px-3 text-left w-8">#</th>
                  <th className="py-2 px-3 text-left">ID</th>
                  <th className="py-2 px-3 text-left">Student Name</th>
                  {/* MAX POINT columns (readonly) */}
                  <th className="py-2 px-2 text-center border-l border-blue-700">
                    <div className="text-[10px] text-blue-300">MAX POINT</div>
                    <div>TEST</div>
                  </th>
                  <th className="py-2 px-2 text-center">
                    <div className="text-[10px] text-blue-300 invisible">MAX</div>
                    <div>EX</div>
                  </th>
                  <th className="py-2 px-2 text-center">
                    <div className="text-[10px] text-blue-300 invisible">MAX</div>
                    <div>TOT</div>
                  </th>
                  {/* O.P (obtained points) columns (editable) */}
                  <th className="py-2 px-2 text-center border-l border-blue-700">
                    <div className="text-[10px] text-green-300">O.P</div>
                    <div>TEST</div>
                  </th>
                  <th className="py-2 px-2 text-center">
                    <div className="text-[10px] text-green-300 invisible">O.P</div>
                    <div>EX</div>
                  </th>
                  <th className="py-2 px-2 text-center font-bold">TOT</th>
                  <th className="py-2 px-2 text-center">%</th>
                  <th className="py-2 px-2 text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => {
                  const m    = marksData[st.id] || {};
                  const cat1 = parseFloat(m.cat1 || 0);
                  const cat2 = parseFloat(m.cat2 || 0);
                  const exam = parseFloat(m.exam || 0);
                  const tot  = cat1 + cat2 + exam;
                  const pct  = sub ? Math.min(100, (tot / (sub.max_marks || 100)) * 100) : 0;
                  const grd  = pct >= 80 ? 'A1' : pct >= 70 ? 'B2' : pct >= 60 ? 'C3' : pct >= 50 ? 'D4' : pct >= 40 ? 'E5' : 'F';
                  const opEx = cat2 + exam; // EX = cat2 + exam combined

                  return (
                    <tr key={st.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/30`}>
                      <td className="py-2 px-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-2 px-3 font-mono text-xs text-blue-600">{st.student_id}</td>
                      <td className="py-2 px-3 font-medium text-gray-900">{st.first_name} {st.last_name}</td>
                      {/* MAX points — readonly display */}
                      <td className="py-2 px-2 text-center text-xs text-gray-400 border-l border-gray-100">{maxTest}</td>
                      <td className="py-2 px-2 text-center text-xs text-gray-400">{maxEx}</td>
                      <td className="py-2 px-2 text-center text-xs text-gray-400">{maxTot}</td>
                      {/* O.P — editable */}
                      <td className="py-2 px-1 border-l border-gray-100">
                        <input type="number" min="0" max={maxTest} step="0.5"
                          className="w-14 border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-center focus:ring-2 focus:ring-blue-400 focus:outline-none"
                          value={m.cat1 ?? ''} onChange={e => setMark(st.id, 'cat1', e.target.value)}/>
                      </td>
                      <td className="py-2 px-1">
                        <input type="number" min="0" max={maxEx} step="0.5"
                          className="w-14 border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-center focus:ring-2 focus:ring-blue-400 focus:outline-none"
                          value={m.exam ?? ''} onChange={e => setMark(st.id, 'exam', e.target.value)}/>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-gray-800 text-xs">{tot.toFixed(1)}</td>
                      <td className="py-2 px-2 text-center text-xs text-gray-500">{pct.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                          ${grd === 'A1' ? 'bg-green-100 text-green-700' :
                            grd === 'F'  ? 'bg-red-100 text-red-700' :
                            grd === 'E5' ? 'bg-orange-100 text-orange-700' :
                                           'bg-blue-100 text-blue-700'}`}>
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

      {!selClass && (
        <div className="text-center py-12 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30"/>
          <p className="text-sm">Select a class, term and subject to enter marks</p>
        </div>
      )}
    </div>
  );
}
