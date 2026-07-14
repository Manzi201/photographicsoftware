import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Check, ChevronDown, ChevronRight,
  GraduationCap, Calendar, BookOpen, Users, Layers, Star, Clock,
  Tag, Link as LinkIcon, RefreshCw, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAcademicYears, createAcademicYear, updateAcademicYear, deleteAcademicYear,
  getTerms, createTerm, updateTerm, deleteTerm,
  getSmsClasses, createSmsClass, updateSmsClass, deleteSmsClass,
  getSmsSubjects, createSmsSubject, updateSmsSubject, deleteSmsSubject,
  getStaff, assignSubjectToAllClasses, setTeacherForSubject,
} from '../../api';
import axios from 'axios';

const SMS_API = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api','/api/sms') ||
    (typeof window!=='undefined'&&window.location.hostname!=='localhost'
      ? 'https://photographicsoftware-1.onrender.com/api/sms' : '/api/sms'),
  timeout: 30000,
});
SMS_API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Year Modal ────────────────────────────────────────────────
function YearModal({ year, onSave, onClose }) {
  const [form, setForm] = useState({ name: year?.name||'', start_date: year?.start_date||'', end_date: year?.end_date||'', is_current: year?.is_current||false });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const save = async () => {
    if (!form.name.trim()) { toast.error('Year name required'); return; }
    setLoading(true);
    try { year ? await updateAcademicYear(year.id, form) : await createAcademicYear(form); toast.success(year?'Updated!':'Created!'); onSave(); }
    catch(err){ toast.error(err.response?.data?.error||'Error'); } finally { setLoading(false); }
  };
  return (
    <Modal title={year?'Edit Academic Year':'New Academic Year'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Year Name *</label>
          <input className="input-field" value={form.name} onChange={f('name')} placeholder="e.g. 2026-2027" autoFocus/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
            <input type="date" className="input-field" value={form.start_date} onChange={f('start_date')}/></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
            <input type="date" className="input-field" value={form.end_date} onChange={f('end_date')}/></div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.is_current} onChange={e=>setForm(p=>({...p,is_current:e.target.checked}))}/>
          <span className="text-sm font-medium text-gray-700">Set as current year</span>
        </label>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">{loading?'Saving…':<><Check className="w-4 h-4"/>Save</>}</button>
      </div>
    </Modal>
  );
}

// ── Term Modal ────────────────────────────────────────────────
function TermModal({ term, years, onSave, onClose }) {
  const TERM_TYPES = [
    { label:'Term 1', number:1 }, { label:'Term 2', number:2 },
    { label:'Term 3', number:3 }, { label:'Annual',  number:4 },
  ];

  // Resolve preset year: could come from _preset_year (new from year row) or academic_year_id (editing)
  const presetYearId = term?._preset_year || term?.academic_year_id || years.find(y=>y.is_current)?.id || years[0]?.id || '';

  const [form, setForm] = useState({
    name: term?.name || '',
    number: term?.number || 1,
    academic_year_id: presetYearId,
    start_date: term?.start_date || '',
    end_date:   term?.end_date   || '',
    is_current: term?.is_current || false,
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const save = async () => {
    if (!form.name.trim())           { toast.error('Term name required'); return; }
    if (!form.academic_year_id)      { toast.error('Select an academic year'); return; }
    setLoading(true);
    try {
      // editing: term has an id and no _preset_year
      if (term?.id && !term._preset_year) {
        await updateTerm(term.id, form);
      } else {
        await createTerm(form);
      }
      toast.success(term?.id && !term._preset_year ? 'Updated!' : 'Created!');
      onSave();
    } catch(err){ toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const pickType = tt => setForm(p=>({...p, name:tt.label, number:tt.number}));

  return (
    <Modal title={term?.id && !term._preset_year ? 'Edit Term' : 'New Term'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Quick Select</label>
          <div className="grid grid-cols-2 gap-2">
            {TERM_TYPES.map(tt=>(
              <button key={tt.number} type="button" onClick={()=>pickType(tt)}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all text-left
                  ${form.number===tt.number
                    ? tt.number===4
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-600 text-white border-blue-600'
                    : tt.number===4
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {tt.label}
                {tt.number===4 && (
                  <span className={`block text-[10px] mt-0.5 ${form.number===4 ? 'text-white/80' : 'text-amber-500'}`}>
                    Average of T1 + T2 + T3
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Term Name *</label>
          <input className="input-field" value={form.name} onChange={f('name')} placeholder="e.g. Term 1" autoFocus/>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year *</label>
          <select className="select-field" value={form.academic_year_id} onChange={f('academic_year_id')}>
            <option value="">— Select Year —</option>
            {years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
            <input type="date" className="input-field" value={form.start_date} onChange={f('start_date')}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
            <input type="date" className="input-field" value={form.end_date} onChange={f('end_date')}/>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-blue-600"
            checked={form.is_current} onChange={e=>setForm(p=>({...p,is_current:e.target.checked}))}/>
          <span className="text-sm font-medium text-gray-700">Set as current term</span>
        </label>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Class Modal ───────────────────────────────────────────────
function ClassModal({ cls, years, staffList, onSave, onClose }) {
  const [form, setForm] = useState({
    name: cls?.name||'', level: cls?.level||'', level_order: cls?.level_order||1,
    section: cls?.section||'A', capacity: cls?.capacity||40,
    academic_year_id: cls?.academic_year_id||years.find(y=>y.is_current)?.id||'',
    class_teacher_id: cls?.class_teacher_id||'',
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const save = async () => {
    if (!form.name.trim()) { toast.error('Class name required'); return; }
    setLoading(true);
    try { cls?.id ? await updateSmsClass(cls.id, form) : await createSmsClass(form); toast.success(cls?.id?'Updated!':'Created!'); onSave(); }
    catch(err){ toast.error(err.response?.data?.error||'Error'); } finally { setLoading(false); }
  };
  return (
    <Modal title={cls?.id?'Edit Class':'New Class'} onClose={onClose}>
      <div className="p-6 grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Class Name *</label>
          <input className="input-field" value={form.name} onChange={f('name')} placeholder="e.g. P1A, S3B" autoFocus/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Level</label>
          <input className="input-field" value={form.level} onChange={f('level')} placeholder="e.g. Primary 1"/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Section</label>
          <input className="input-field" value={form.section} onChange={f('section')} placeholder="A"/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Order</label>
          <input type="number" className="input-field" value={form.level_order} onChange={f('level_order')} min={1}/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Capacity</label>
          <input type="number" className="input-field" value={form.capacity} onChange={f('capacity')} min={1}/></div>
        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
          <select className="select-field" value={form.academic_year_id} onChange={f('academic_year_id')}>
            <option value="">— None —</option>
            {years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
          </select></div>
        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Class Teacher</label>
          <select className="select-field" value={form.class_teacher_id} onChange={f('class_teacher_id')}>
            <option value="">— None —</option>
            {staffList.filter(s=>s.role==='teacher'||s.role==='dos').map(s=>
              <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
          </select></div>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">{loading?'Saving…':<><Check className="w-4 h-4"/>Save</>}</button>
      </div>
    </Modal>
  );
}

// ── Subject Modal (create + edit) ────────────────────────────
function SubjectModal({ subject, onSave, onClose }) {
  const [form, setForm] = useState({
    name:          subject?.name          || '',
    code:          subject?.code          || '',
    max_test:      subject?.max_test      ?? 0,
    max_exam:      subject?.max_exam      ?? 0,
    passing_marks: subject?.passing_marks || 50,
    coefficient:   subject?.coefficient   || 1,
    sort_order:    subject?.sort_order    ?? 999,
    is_core:       subject?.is_core       ?? false,
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const maxTotal = parseInt(form.max_test||0) + parseInt(form.max_exam||0);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Subject name required'); return; }
    if (maxTotal <= 0) { toast.error('Enter max marks for TEST or EXAM'); return; }
    setLoading(true);
    try {
      if (subject?.id) {
        await updateSmsSubject(subject.id, form);
        toast.success('Subject updated!');
      } else {
        const res = await createSmsSubject(form);
        const msg = res.data?.message || 'Subject created!';
        toast.success(`✅ ${msg}`);
      }
      onSave();
    } catch(err){ toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={subject?.id ? 'Edit Subject' : 'New Subject'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject Name *</label>
            <input className="input-field" value={form.name} onChange={f('name')} placeholder="e.g. Mathematics" autoFocus/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Short Code</label>
            <input className="input-field" value={form.code} onChange={f('code')} placeholder="e.g. MATH"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Coefficient</label>
            <input type="number" className="input-field" value={form.coefficient} onChange={f('coefficient')} min={1} max={10}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Display Order</label>
            <input type="number" className="input-field" value={form.sort_order} onChange={f('sort_order')} min={1} max={999} placeholder="1, 2, 3…"/>
            <p className="text-xs text-gray-400 mt-0.5">Order on report card (1 = first)</p>
          </div>
          <div className="flex flex-col justify-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div onClick={() => setForm(p => ({ ...p, is_core: !p.is_core }))}
                className={`w-10 h-5.5 h-6 rounded-full transition-colors relative cursor-pointer
                  ${form.is_core ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${form.is_core ? 'translate-x-4' : 'translate-x-0.5'}`}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">Core Subject</p>
                <p className="text-[10px] text-gray-400">Appears on Report Cards</p>
              </div>
            </label>
          </div>
        </div>

        {/* Max marks section */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Max Marks Configuration</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">TEST Max Marks *</label>
              <input type="number" className="input-field" value={form.max_test} onChange={f('max_test')} min={0} placeholder="e.g. 60"/>
              <p className="text-xs text-gray-400 mt-0.5">CAT / Continuous Assessment</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">EXAM Max Marks</label>
              <input type="number" className="input-field" value={form.max_exam} onChange={f('max_exam')} min={0} placeholder="0 = Test only"/>
              <p className="text-xs text-gray-400 mt-0.5">0 = no exam, TEST only</p>
            </div>
          </div>
          {/* Live preview */}
          <div className={`rounded-xl p-3 text-sm flex items-center gap-4 flex-wrap
            ${maxTotal > 0 ? 'bg-white border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">TEST:</span>
              <span className="font-bold text-blue-700">{form.max_test || 0}</span>
            </div>
            {parseInt(form.max_exam||0) > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">EXAM:</span>
                <span className="font-bold text-green-700">{form.max_exam}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">TOTAL:</span>
              <span className="font-bold text-gray-900">{maxTotal}</span>
            </div>
            {parseInt(form.max_exam||0) === 0 && maxTotal > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                TEST only — no exam
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Pass Mark</label>
          <input type="number" className="input-field" value={form.passing_marks} onChange={f('passing_marks')} min={0}/>
        </div>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> {subject?.id ? 'Update' : 'Create'}</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Assign Subject to Class Modal ─────────────────────────────
// Shows subjects assigned to this class, with:
//   - sort order, core toggle, teacher assignment per-class
//   - "Set teacher for ALL classes" button per subject
function AssignModal({ cls, subjects, staffList, allClasses, onSave, onClose }) {
  const [classSubjects, setClassSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teacherSelects, setTeacherSelects] = useState({}); // { subjectId: teacherId }

  const reload = async () => {
    const r = await getSmsSubjects({ class_id: cls.id });
    const cs = r.data.data || [];
    setClassSubjects(cs);
    // Prefill teacher selects
    const ts = {};
    cs.forEach(s => { ts[s.id] = s.teacher?.id || ''; });
    setTeacherSelects(ts);
  };

  useEffect(() => { reload().finally(() => setLoading(false)); }, [cls.id]);

  const assignedIds = new Set(classSubjects.map(cs => cs.id));
  const unassigned  = subjects.filter(s => !assignedIds.has(s.id));
  const teachers    = staffList.filter(s => s.role === 'teacher' || s.role === 'dos');

  // Assign subject to this class
  const assign = async (subject_id) => {
    try {
      await SMS_API.post('/class-subjects', { class_id: cls.id, subject_id, teacher_id: null });
      toast.success('Subject assigned!');
      await reload(); onSave();
    } catch(err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // Remove subject from this class
  const unassign = async (cs) => {
    try {
      await SMS_API.delete(`/class-subjects/${cs.class_subject_id || cs.id}`);
      toast.success('Removed');
      await reload(); onSave();
    } catch(err) { toast.error('Error removing'); }
  };

  // Toggle core for this class
  const toggleCore = async (cs) => {
    try {
      await SMS_API.post('/class-subjects', {
        class_id: cls.id, subject_id: cs.id,
        teacher_id: cs.teacher?.id || null,
        is_core: !cs.is_core, sort_order: cs.sort_order ?? 999,
      });
      await reload(); onSave();
    } catch(err) { toast.error('Error'); }
  };

  // Update sort order for this class
  const updateOrder = async (cs, newOrder) => {
    try {
      await SMS_API.post('/class-subjects', {
        class_id: cls.id, subject_id: cs.id,
        teacher_id: cs.teacher?.id || null,
        is_core: cs.is_core ?? false, sort_order: parseInt(newOrder) || 999,
      });
      await reload();
    } catch(err) { toast.error('Error'); }
  };

  // Set teacher for THIS class only
  const setTeacherThisClass = async (cs, teacher_id) => {
    try {
      await SMS_API.post('/class-subjects', {
        class_id: cls.id, subject_id: cs.id,
        teacher_id: teacher_id || null,
        is_core: cs.is_core ?? false, sort_order: cs.sort_order ?? 999,
      });
      toast.success(`Teacher set for ${cls.name}`);
      await reload(); onSave();
    } catch(err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // Set teacher for ALL classes that have this subject
  const setTeacherAllClasses = async (subjectId, teacher_id) => {
    try {
      const res = await setTeacherForSubject({ subject_id: subjectId, teacher_id: teacher_id || null });
      toast.success(res.data?.message || 'Teacher assigned in all classes!');
      await reload(); onSave();
    } catch(err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <Modal title={`Subjects — ${cls.name}`} onClose={onClose} wide>
      <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">

        {/* ── Assigned subjects ─────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assigned Subjects</p>
            <p className="text-[10px] text-gray-400">✓ Core = appears on Report Card</p>
          </div>

          {loading ? <p className="text-sm text-gray-400">Loading…</p> :
           classSubjects.length === 0 ? <p className="text-sm text-gray-400">No subjects assigned yet</p> : (
            <div className="space-y-2">
              {[...classSubjects].sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)).map(cs => (
                <div key={cs.class_subject_id||cs.id}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">

                  {/* Row 1: order | name | core | remove */}
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="99"
                      defaultValue={cs.sort_order ?? 999}
                      onBlur={e => updateOrder(cs, e.target.value)}
                      className="w-10 text-center text-xs font-bold border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-blue-400 bg-white text-gray-600"
                      title="Display order"/>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-gray-900 text-sm">{cs.name}</span>
                      {cs.code && <span className="ml-1.5 text-[10px] font-mono text-blue-500 bg-blue-50 px-1 rounded">{cs.code}</span>}
                      {cs.coefficient > 1 && <span className="ml-1.5 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">×{cs.coefficient}</span>}
                    </div>
                    <button onClick={() => toggleCore(cs)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all
                        ${cs.is_core ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-emerald-300'}`}>
                      <span className={`w-3 h-3 rounded border-2 flex items-center justify-center
                        ${cs.is_core ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                        {cs.is_core && <span className="text-white text-[8px] leading-none">✓</span>}
                      </span>Core
                    </button>
                    <button onClick={() => unassign(cs)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>

                  {/* Row 2: Teacher assignment */}
                  <div className="flex items-center gap-2 pl-12">
                    <UserCheck className="w-3.5 h-3.5 text-gray-400 shrink-0"/>
                    <div className="relative flex-1">
                      <select
                        value={teacherSelects[cs.id] || ''}
                        onChange={e => setTeacherSelects(p => ({ ...p, [cs.id]: e.target.value }))}
                        className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-gray-900 focus:outline-none focus:border-blue-400 transition-all">
                        <option value="">— No teacher —</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                    </div>
                    {/* Set for this class */}
                    <button
                      onClick={() => setTeacherThisClass(cs, teacherSelects[cs.id] || null)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0">
                      <Check className="w-3 h-3"/> {cls.name}
                    </button>
                    {/* Set for ALL classes */}
                    <button
                      onClick={() => setTeacherAllClasses(cs.id, teacherSelects[cs.id] || null)}
                      title="Assign this teacher to this subject in ALL classes"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0a2156] text-white text-xs font-bold hover:bg-[#0c2a6a] transition-colors whitespace-nowrap shrink-0">
                      <Check className="w-3 h-3"/> All Classes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Add unassigned subjects ────────────────────── */}
        {unassigned.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Add Subject</p>
            <div className="space-y-1.5">
              {unassigned.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <span className="text-sm text-gray-700 font-medium">
                    {s.name}
                    {s.code && <span className="ml-1.5 text-[10px] font-mono text-blue-500 bg-blue-50 px-1 rounded">{s.code}</span>}
                    {s.coefficient > 1 && <span className="ml-1 text-xs text-gray-400">×{s.coefficient}</span>}
                    {s.is_core && <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Core</span>}
                  </span>
                  <button onClick={() => assign(s.id)} className="text-xs btn-primary py-1 px-3">+ Assign</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-3 border-t border-gray-100 text-right">
        <button onClick={onClose} className="btn-secondary text-sm">Done</button>
      </div>
    </Modal>
  );
}
// ── MAIN PAGE ─────────────────────────────────────────────────
const TABS = ['classes', 'terms', 'subjects'];

function getRole() {
  try { return JSON.parse(localStorage.getItem('staff_data') || '{}').role || 'teacher'; }
  catch { return 'teacher'; }
}

export default function SmsClasses() {
  const role     = getRole();
  const canWrite = ['admin', 'dos', 'secretary'].includes(role); // who can add/edit/delete

  const [tab,       setTab]       = useState('classes');
  const [years,     setYears]     = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [terms,     setTerms]     = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState({});

  // Modals
  const [yearModal,    setYearModal]    = useState(null);
  const [classModal,   setClassModal]   = useState(null);
  const [termModal,    setTermModal]    = useState(null);
  const [subjectModal, setSubjectModal] = useState(false);
  const [assignModal,  setAssignModal]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load all data in parallel — staff list is admin-only so we handle 403 gracefully
      const [yr, cl, tm, sb] = await Promise.all([
        getAcademicYears(),
        getSmsClasses(),
        getTerms(),
        getSmsSubjects(),
      ]);
      const yrs = yr.data.data || [];
      setYears(yrs);
      setClasses(cl.data.data || []);
      setTerms(tm.data.data   || []);
      setSubjects(sb.data.data || []);
      const cur = yrs.find(y => y.is_current);
      if (cur) setExpanded(e => ({ ...e, [cur.id]: true }));

      // Staff list — only admins/dos can access this; others get empty list silently
      try {
        const st = await getStaff();
        setStaffList(st.data.data || []);
      } catch {
        setStaffList([]); // not an admin — just show empty teacher list
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Network error';
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        toast.error('Session expired — please sign in again');
      } else {
        toast.error(`Failed to load: ${msg}`);
      }
    }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const delYear = async y => {
    if (!window.confirm(
      `⚠️ DELETE Academic Year "${y.name}" PERMANENTLY?\n\nThis will also delete:\n• All terms in this year\n• All classes in this year\n• All marks and report cards\n• All fee structures\n\nThis cannot be undone.`
    )) return;
    try { await deleteAcademicYear(y.id); toast.success(`"${y.name}" deleted permanently`); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };
  const delClass = async c => {
    if (!window.confirm(
      `⚠️ DELETE Class "${c.name}" PERMANENTLY?\n\nThis will also delete:\n• All subject assignments\n• All marks for this class\n• All report cards\n\nThis cannot be undone.`
    )) return;
    try { await deleteSmsClass(c.id); toast.success(`Class "${c.name}" deleted permanently`); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };
  const delTerm = async t => {
    if (!window.confirm(
      `⚠️ DELETE Term "${t.name}" PERMANENTLY?\n\nThis will also delete:\n• All marks entered for this term\n• All report cards for this term\n• All payments linked to this term\n\nThis cannot be undone.`
    )) return;
    try { await deleteTerm(t.id); toast.success(`"${t.name}" deleted permanently`); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };
  const delSubject = async s => {
    if (!window.confirm(
      `⚠️ DELETE Subject "${s.name}" PERMANENTLY?\n\nThis will also delete:\n• All marks for this subject across all classes\n• All class assignments for this subject\n\nThis cannot be undone.`
    )) return;
    try { await deleteSmsSubject(s.id); toast.success(`Subject "${s.name}" deleted permanently`); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };

  const classesForYear = id => classes.filter(c=>c.academic_year_id===id);
  const termsForYear   = id => terms.filter(t=>t.academic_year_id===id);
  const TERM_LABEL     = n => n===4?'Annual':n===3?'Term 3':n===2?'Term 2':'Term 1';
  const TERM_COLOR     = n => n===4?'bg-amber-100 text-amber-700':n===3?'bg-purple-100 text-purple-700':n===2?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600"/> Academic Setup
          </h1>
          <p className="text-gray-500 text-sm">
            {years.length} years · {classes.length} classes · {terms.length} terms · {subjects.length} subjects
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Refresh always visible */}
          <button onClick={load} disabled={loading}
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Clock className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {/* Write actions — admin/dos/secretary only */}
          {canWrite && tab === 'classes' && (
            <>
              <button onClick={() => setYearModal('new')} className="btn-secondary text-sm">
                <Calendar className="w-4 h-4"/> Add Year
              </button>
              <button onClick={() => setClassModal('new')} className="btn-primary text-sm">
                <Plus className="w-4 h-4"/> Add Class
              </button>
            </>
          )}
          {canWrite && tab === 'terms' && (
            <button onClick={() => setTermModal('new')} className="btn-primary text-sm">
              <Plus className="w-4 h-4"/> Add Term
            </button>
          )}
          {canWrite && tab === 'subjects' && (
            <button onClick={() => setSubjectModal(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4"/> Add Subject
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all
              ${tab === t ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : (
        <>
        {/* ── CLASSES TAB ─────────────────────────────────── */}
        {tab==='classes' && (
          <div className="space-y-4">
            {years.length===0 && (
              <div className="text-center py-16 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                <p className="font-semibold text-gray-500">No academic years yet</p>
                {canWrite
                  ? <button onClick={()=>setYearModal('new')} className="btn-primary mt-4 text-sm">Add Year</button>
                  : <p className="text-xs text-gray-400 mt-2">Contact your administrator to set up academic years</p>}
              </div>
            )}
            {years.map(year=>{
              const yc=classesForYear(year.id); const open=!!expanded[year.id];
              return (
                <div key={year.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer ${year.is_current?'bg-blue-50 border-b border-blue-100':'bg-gray-50 border-b border-gray-100'}`}
                    onClick={()=>setExpanded(e=>({...e,[year.id]:!open}))}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${year.is_current?'bg-blue-600':'bg-gray-400'}`}>
                      <Calendar className="w-4 h-4 text-white"/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{year.name}</span>
                        {year.is_current&&<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1"><Star className="w-2.5 h-2.5"/>Current</span>}
                      </div>
                      <p className="text-xs text-gray-400">{yc.length} class{yc.length!==1?'es':''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
                      {canWrite && <>
                        <button onClick={()=>setYearModal(year)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>delYear(year)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                      </>}
                    </div>
                    {open?<ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/>:<ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                  </div>
                  {open&&(
                    <div className="bg-white">
                      {yc.length===0?<div className="px-5 py-6 text-center text-gray-400 text-sm">No classes yet<br/><button onClick={()=>setClassModal({_preset_year:year.id})} className="text-xs text-blue-600 hover:underline mt-1">+ Add first class</button></div>:(
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                            {['Class','Level','Section','Cap','Teacher','Subjects','Actions'].map(h=><th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-400">{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {yc.map(cls=>(
                              <tr key={cls.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="py-2.5 px-3 font-semibold text-gray-900">{cls.name}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{cls.level||'—'}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{cls.section||'—'}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{cls.capacity}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500 truncate max-w-[110px]">{cls.class_teacher?.full_name||'—'}</td>
                                <td className="py-2.5 px-3">
                                  {canWrite && (
                                    <button onClick={()=>setAssignModal(cls)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                      <BookOpen className="w-3 h-3"/> Assign</button>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 flex gap-1">
                                  {canWrite && <>
                                    <button onClick={()=>setClassModal(cls)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                                    <button onClick={()=>delClass(cls)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                                  </>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="px-5 py-2.5 border-t border-dashed border-gray-100">
                        {canWrite && (
                          <button onClick={()=>setClassModal({_preset_year:year.id})} className="text-xs font-semibold text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5"/>Add class to {year.name}</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TERMS TAB ───────────────────────────────────── */}
        {tab==='terms' && (
          <div className="space-y-4">
            {years.length===0 && (
              <div className="text-center py-10 text-gray-400">
                {canWrite ? 'Create an academic year first' : 'No academic years set up yet'}
              </div>
            )}
            {years.map(year=>{
              const yt=termsForYear(year.id);
              return (
                <div key={year.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className={`px-5 py-3 flex items-center gap-3 ${year.is_current?'bg-blue-50 border-b border-blue-100':'bg-gray-50 border-b border-gray-100'}`}>
                    <span className="font-bold text-gray-900">{year.name}</span>
                    {year.is_current&&<span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>}
                    <span className="text-xs text-gray-400 ml-1">{yt.length} term{yt.length!==1?'s':''}</span>
                    {canWrite && (
                      <button onClick={()=>setTermModal({_preset_year:year.id})} className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3"/>Add
                      </button>
                    )}
                  </div>
                  {yt.length===0 ? (
                    <div className="px-5 py-5 text-center text-sm text-gray-400">
                      No terms yet{canWrite && <> — <button onClick={()=>setTermModal({_preset_year:year.id})} className="text-blue-600 hover:underline">add Term 1, 2, 3 + Annual</button></>}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {yt.sort((a,b)=>a.number-b.number).map(t=>(
                        <div key={t.id} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${TERM_COLOR(t.number)}`}>{TERM_LABEL(t.number)}</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {/* Show clean name — strip the verbose suffix if present */}
                            {t.number === 4 ? 'Annual' : t.name}
                          </span>
                          {t.is_current&&<span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Current</span>}
                          {t.number===4&&<span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">avg T1+T2+T3</span>}
                          {canWrite && (
                            <div className="flex gap-1 ml-auto">
                              <button onClick={()=>setTermModal(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={()=>delTerm(t)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── SUBJECTS TAB ─────────────────────────────────── */}
        {tab==='subjects' && (
          <div>
            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
              <GraduationCap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"/>
              <div className="text-xs text-blue-700">
                <span className="font-bold">Auto-assignment:</span> New subjects are automatically assigned to all existing classes.
                Use the <span className="font-bold">Assign to All</span> button on any row to push an existing subject to all classes,
                or open a class → <span className="font-bold">Assign</span> to add/remove subjects per class individually.
              </div>
            </div>
            {subjects.length===0 ? (
              <div className="text-center py-12 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                <p>No subjects yet</p>
                {canWrite && <button onClick={()=>setSubjectModal(true)} className="btn-primary mt-3 text-sm">Add First Subject</button>}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    {['#','Subject','Code','Coef','Max TEST','Max EXAM','Total','Core', ...(canWrite?['Actions']:[])].map(h=>(
                      <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...subjects].sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)).map((s,i)=>(
                      <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                        <td className="py-3 px-3 text-xs font-bold text-gray-400 w-8">{s.sort_order??'—'}</td>
                        <td className="py-3 px-3 font-semibold text-gray-900">{s.name}</td>
                        <td className="py-3 px-3 font-mono text-xs text-blue-600">{s.code||'—'}</td>
                        <td className="py-3 px-3"><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">×{s.coefficient||1}</span></td>
                        <td className="py-3 px-3 font-semibold text-blue-700">{s.max_test||0}</td>
                        <td className="py-3 px-3 font-semibold text-emerald-700">{s.max_exam||0}</td>
                        <td className="py-3 px-3 font-bold text-gray-900">{(s.max_test||0)+(s.max_exam||0)||s.max_marks||0}</td>
                        <td className="py-3 px-3">
                          {s.is_core
                            ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
                                <span className="w-2.5 h-2.5 rounded bg-emerald-500 flex items-center justify-center">
                                  <span className="text-white text-[7px]">✓</span>
                                </span>Core
                              </span>
                            : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        {canWrite && (
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {/* Assign to all classes */}
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await assignSubjectToAllClasses(s.id);
                                    toast.success(res.data?.message || 'Assigned to all classes!');
                                  } catch(err) { toast.error(err.response?.data?.error || 'Error'); }
                                }}
                                title="Assign to all classes"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold border border-blue-200 transition-colors">
                                <Plus className="w-3 h-3"/> All Classes
                              </button>
                              <button onClick={()=>setSubjectModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={()=>delSubject(s)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </>
      )}

      {/* ── Modals — only render if canWrite ───────────────── */}
      {canWrite && yearModal    && <YearModal    year={yearModal==='new'?null:yearModal}         onSave={()=>{setYearModal(null);load();}}    onClose={()=>setYearModal(null)}/>}
      {canWrite && classModal   && <ClassModal   cls={classModal?.id?classModal:null}             years={years} staffList={staffList} onSave={()=>{setClassModal(null);load();}} onClose={()=>setClassModal(null)}/>}
      {canWrite && termModal    && <TermModal    term={termModal?._preset_year?null:termModal}   years={years} onSave={()=>{setTermModal(null);load();}}  onClose={()=>setTermModal(null)}/>}
      {canWrite && subjectModal && <SubjectModal subject={subjectModal===true?null:subjectModal} onSave={()=>{setSubjectModal(false);load();}} onClose={()=>setSubjectModal(false)}/>}
      {canWrite && assignModal  && <AssignModal  cls={assignModal} subjects={subjects} staffList={staffList} allClasses={classes} onSave={()=>load()} onClose={()=>setAssignModal(null)}/>}
    </div>
  );
}
