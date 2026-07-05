import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Check, ChevronDown, ChevronRight,
  GraduationCap, Calendar, BookOpen, Users, Layers, Star, Clock,
  Tag, Link as LinkIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAcademicYears, createAcademicYear, updateAcademicYear, deleteAcademicYear,
  getTerms, createTerm, updateTerm, deleteTerm,
  getSmsClasses, createSmsClass, updateSmsClass, deleteSmsClass,
  getSmsSubjects, createSmsSubject, deleteSmsSubject,
  getStaff,
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
    { label:'Term 3', number:3 }, { label:'Annual (avg T1+T2+T3)', number:4 },
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
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left
                  ${form.number===tt.number?'bg-blue-600 text-white border-blue-600':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {tt.label}
                {tt.number===4 && <span className="block text-[10px] opacity-70 mt-0.5">Average T1+T2+T3 automatically</span>}
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

// ── Subject & Assign Modal ────────────────────────────────────
function SubjectModal({ subject, onSave, onClose }) {
  const [form, setForm] = useState({ name: subject?.name||'', code: subject?.code||'', max_marks: subject?.max_marks||100, passing_marks: subject?.passing_marks||50, coefficient: subject?.coefficient||1 });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const save = async () => {
    if (!form.name.trim()) { toast.error('Subject name required'); return; }
    setLoading(true);
    try { await createSmsSubject(form); toast.success('Subject created!'); onSave(); }
    catch(err){ toast.error(err.response?.data?.error||'Error'); } finally { setLoading(false); }
  };
  return (
    <Modal title="New Subject" onClose={onClose}>
      <div className="p-6 grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Subject Name *</label>
          <input className="input-field" value={form.name} onChange={f('name')} placeholder="e.g. Mathematics" autoFocus/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Code</label>
          <input className="input-field" value={form.code} onChange={f('code')} placeholder="e.g. MATH"/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Coefficient</label>
          <input type="number" className="input-field" value={form.coefficient} onChange={f('coefficient')} min={1} max={5}/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Marks</label>
          <input type="number" className="input-field" value={form.max_marks} onChange={f('max_marks')} min={1}/></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Pass Mark</label>
          <input type="number" className="input-field" value={form.passing_marks} onChange={f('passing_marks')} min={0}/></div>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">{loading?'Saving…':<><Check className="w-4 h-4"/>Save</>}</button>
      </div>
    </Modal>
  );
}

// ── Assign Subject to Class Modal ─────────────────────────────
function AssignModal({ cls, subjects, staffList, onSave, onClose }) {
  const [classSubjects, setClassSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getSmsSubjects({ class_id: cls.id }).then(r => setClassSubjects(r.data.data||[])).finally(()=>setLoading(false));
  }, [cls.id]);

  const assignedIds = new Set(classSubjects.map(cs=>cs.id));
  const unassigned  = subjects.filter(s=>!assignedIds.has(s.id));

  const assign = async (subject_id, teacher_id='') => {
    try {
      await SMS_API.post('/class-subjects', { class_id: cls.id, subject_id, teacher_id: teacher_id||null });
      toast.success('Subject assigned!');
      const r = await getSmsSubjects({ class_id: cls.id });
      setClassSubjects(r.data.data||[]);
      onSave();
    } catch(err){ toast.error(err.response?.data?.error||'Error'); }
  };
  const unassign = async (class_subject_id) => {
    try {
      await SMS_API.delete(`/class-subjects/${class_subject_id}`);
      toast.success('Removed');
      const r = await getSmsSubjects({ class_id: cls.id });
      setClassSubjects(r.data.data||[]);
      onSave();
    } catch(err){ toast.error('Error removing'); }
  };

  return (
    <Modal title={`Subjects — ${cls.name}`} onClose={onClose} wide>
      <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
        {/* Assigned */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Assigned Subjects</p>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> :
           classSubjects.length === 0 ? <p className="text-sm text-gray-400">No subjects assigned yet</p> :
           <div className="space-y-1.5">
            {classSubjects.map(cs=>(
              <div key={cs.class_subject_id||cs.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <div>
                  <span className="font-semibold text-blue-900 text-sm">{cs.name}</span>
                  {cs.coefficient>1&&<span className="ml-1.5 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">×{cs.coefficient}</span>}
                  {cs.teacher&&<span className="ml-2 text-xs text-gray-500">→ {cs.teacher.full_name}</span>}
                </div>
                <button onClick={()=>unassign(cs.class_subject_id||cs.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            ))}
           </div>}
        </div>
        {/* Unassigned — quick assign */}
        {unassigned.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Add Subject</p>
            <div className="space-y-1.5">
              {unassigned.map(s=>(
                <div key={s.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <span className="text-sm text-gray-700 font-medium">{s.name}{s.coefficient>1&&<span className="ml-1 text-xs text-gray-400">×{s.coefficient}</span>}</span>
                  <button onClick={()=>assign(s.id)} className="text-xs btn-primary py-1 px-3">+ Assign</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-3 border-t text-right">
        <button onClick={onClose} className="btn-secondary text-sm">Done</button>
      </div>
    </Modal>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
const TABS = ['classes', 'terms', 'subjects'];

export default function SmsClasses() {
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
  const [assignModal,  setAssignModal]  = useState(null); // class object

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [yr, cl, tm, sb, st] = await Promise.all([
        getAcademicYears(), getSmsClasses(), getTerms(), getSmsSubjects(), getStaff()
      ]);
      const yrs = yr.data.data || [];
      setYears(yrs); setClasses(cl.data.data||[]);
      setTerms(tm.data.data||[]); setSubjects(sb.data.data||[]);
      setStaffList(st.data.data||[]);
      const cur = yrs.find(y=>y.is_current);
      if (cur) setExpanded(e=>({...e,[cur.id]:true}));
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const delYear = async y => {
    if (!window.confirm(`Delete "${y.name}"?`)) return;
    try { await deleteAcademicYear(y.id); toast.success('Deleted'); load(); } catch { toast.error('Error'); }
  };
  const delClass = async c => {
    if (!window.confirm(`Delete class "${c.name}"?`)) return;
    try { await deleteSmsClass(c.id); toast.success('Deleted'); load(); } catch { toast.error('Error'); }
  };
  const delTerm = async t => {
    if (!window.confirm(`Delete "${t.name}"?`)) return;
    try { await deleteTerm(t.id); toast.success('Deleted'); load(); } catch { toast.error('Error'); }
  };
  const delSubject = async s => {
    if (!window.confirm(`Delete subject "${s.name}"?`)) return;
    try { await deleteSmsSubject(s.id); toast.success('Deleted'); load(); } catch { toast.error('Error'); }
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
          <p className="text-gray-500 text-sm">{years.length} years · {classes.length} classes · {terms.length} terms · {subjects.length} subjects</p>
        </div>
        <div className="flex gap-2">
          {tab==='classes'  && <><button onClick={()=>setYearModal('new')} className="btn-secondary text-sm"><Calendar className="w-4 h-4"/> Add Year</button><button onClick={()=>setClassModal('new')} className="btn-primary text-sm"><Plus className="w-4 h-4"/> Add Class</button></>}
          {tab==='terms'    && <button onClick={()=>setTermModal('new')} className="btn-primary text-sm"><Plus className="w-4 h-4"/> Add Term</button>}
          {tab==='subjects' && <button onClick={()=>setSubjectModal(true)} className="btn-primary text-sm"><Plus className="w-4 h-4"/> Add Subject</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all
              ${tab===t?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : (
        <>
        {/* ── CLASSES TAB ─────────────────────────────────── */}
        {tab==='classes' && (
          <div className="space-y-4">
            {years.length===0&&<div className="text-center py-16 text-gray-400"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="font-semibold text-gray-500">No academic years yet</p><button onClick={()=>setYearModal('new')} className="btn-primary mt-4 text-sm">Add Year</button></div>}
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
                      <button onClick={()=>setYearModal(year)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>delYear(year)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
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
                                  <button onClick={()=>setAssignModal(cls)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                    <BookOpen className="w-3 h-3"/> Assign</button>
                                </td>
                                <td className="py-2.5 px-3 flex gap-1">
                                  <button onClick={()=>setClassModal(cls)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                                  <button onClick={()=>delClass(cls)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="px-5 py-2.5 border-t border-dashed border-gray-100">
                        <button onClick={()=>setClassModal({_preset_year:year.id})} className="text-xs font-semibold text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5"/>Add class to {year.name}</button>
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
            {years.length===0&&<div className="text-center py-10 text-gray-400">Create an academic year first</div>}
            {years.map(year=>{
              const yt=termsForYear(year.id);
              return (
                <div key={year.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className={`px-5 py-3 flex items-center gap-3 ${year.is_current?'bg-blue-50 border-b border-blue-100':'bg-gray-50 border-b border-gray-100'}`}>
                    <span className="font-bold text-gray-900">{year.name}</span>
                    {year.is_current&&<span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>}
                    <span className="text-xs text-gray-400 ml-1">{yt.length} term{yt.length!==1?'s':''}</span>
                    <button onClick={()=>setTermModal({_preset_year:year.id})} className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add</button>
                  </div>
                  {yt.length===0?<div className="px-5 py-5 text-center text-sm text-gray-400">No terms yet — <button onClick={()=>setTermModal({_preset_year:year.id})} className="text-blue-600 hover:underline">add Term 1, 2, 3 + Annual</button></div>:(
                    <div className="divide-y divide-gray-50">
                      {yt.sort((a,b)=>a.number-b.number).map(t=>(
                        <div key={t.id} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${TERM_COLOR(t.number)}`}>{TERM_LABEL(t.number)}</span>
                          <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                          {t.is_current&&<span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Current</span>}
                          {t.number===4&&<span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Avg T1+T2+T3</span>}
                          <div className="flex gap-1 ml-auto">
                            <button onClick={()=>setTermModal(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>delTerm(t)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
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
            {subjects.length===0?<div className="text-center py-12 text-gray-400"><BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30"/><p>No subjects yet</p><button onClick={()=>setSubjectModal(true)} className="btn-primary mt-3 text-sm">Add First Subject</button></div>:(
              <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    {['Subject','Code','Coefficient','Max Marks','Pass Mark','Actions'].map(h=><th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {subjects.map((s,i)=>(
                      <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                        <td className="py-3 px-4 font-semibold text-gray-900">{s.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-blue-600">{s.code||'—'}</td>
                        <td className="py-3 px-4"><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">×{s.coefficient||1}</span></td>
                        <td className="py-3 px-4 text-gray-600">{s.max_marks||100}</td>
                        <td className="py-3 px-4 text-gray-600">{s.passing_marks||50}</td>
                        <td className="py-3 px-4">
                          <button onClick={()=>delSubject(s)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                        </td>
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

      {/* ── Modals ─────────────────────────────────────────── */}
      {yearModal   && <YearModal    year={yearModal==='new'?null:yearModal}       onSave={()=>{setYearModal(null);load();}}    onClose={()=>setYearModal(null)}/>}
      {classModal  && <ClassModal   cls={classModal?.id?classModal:null}           years={years} staffList={staffList} onSave={()=>{setClassModal(null);load();}} onClose={()=>setClassModal(null)}/>}
      {termModal   && <TermModal    term={termModal?._preset_year?null:termModal} years={years} onSave={()=>{setTermModal(null);load();}}  onClose={()=>setTermModal(null)}/>}
      {subjectModal&& <SubjectModal onSave={()=>{setSubjectModal(false);load();}} onClose={()=>setSubjectModal(false)}/>}
      {assignModal && <AssignModal  cls={assignModal} subjects={subjects} staffList={staffList} onSave={()=>load()} onClose={()=>setAssignModal(null)}/>}
    </div>
  );
}
