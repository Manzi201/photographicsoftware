import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, Trash2, Edit2, X, Check, ChevronDown,
  Clock, Users, BookOpen, MapPin, AlertTriangle, RefreshCw,
  BarChart2, Grid3X3, List, Layers, User, Download, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAcademicYears, getTerms, getSmsClasses, getSmsSubjects, getStaff,
  getTtRooms, createTtRoom, updateTtRoom, deleteTtRoom,
  getTtPeriods, createTtPeriod, updateTtPeriod, deleteTtPeriod,
  getTtSlots, upsertTtSlot, deleteTtSlot, clearClassTimetable,
  getTtWorkload, getTtConflicts,
  exportClassTimetable, exportTeacherTimetable, exportSchoolTimetable,
} from '../../api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-teal-100 text-teal-800 border-teal-200',
];
const SEL = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all shadow-sm';
const INP = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all';

function getRole() {
  try { return JSON.parse(localStorage.getItem('staff_data') || '{}').role || 'dos'; }
  catch { return 'dos'; }
}

// ── Small modals ──────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Room Modal ────────────────────────────────────────────────
function RoomModal({ room, onSave, onClose }) {
  const [form, setForm] = useState({ name: room?.name||'', capacity: room?.capacity||40, room_type: room?.room_type||'classroom' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    if (!form.name.trim()) { toast.error('Room name required'); return; }
    setLoading(true);
    try {
      room?.id ? await updateTtRoom(room.id, form) : await createTtRoom(form);
      toast.success(room?.id ? 'Room updated!' : 'Room created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };
  return (
    <Modal title={room?.id ? 'Edit Room' : 'New Room'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Room Name *</label>
          <input className={INP} value={form.name} onChange={f('name')} placeholder="e.g. Room 101" autoFocus/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Capacity</label>
            <input type="number" className={INP} value={form.capacity} onChange={f('capacity')} min={1}/></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
            <div className="relative"><select className={SEL} value={form.room_type} onChange={f('room_type')}>
              {['classroom','lab','hall','library'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div></div>
        </div>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Period Modal ──────────────────────────────────────────────
function PeriodModal({ period, yearId, termId, onSave, onClose }) {
  const [form, setForm] = useState({
    name: period?.name||'', period_number: period?.period_number||1,
    start_time: period?.start_time||'07:00', end_time: period?.end_time||'07:45',
    is_break: period?.is_break||false,
    academic_year_id: yearId||'', term_id: termId||'',
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    if (!form.name.trim()) { toast.error('Period name required'); return; }
    setLoading(true);
    try {
      period?.id ? await updateTtPeriod(period.id, form) : await createTtPeriod(form);
      toast.success('Saved!'); onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };
  return (
    <Modal title={period?.id ? 'Edit Period' : 'New Period'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name *</label>
            <input className={INP} value={form.name} onChange={f('name')} placeholder="e.g. Period 1" autoFocus/></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Order #</label>
            <input type="number" className={INP} value={form.period_number} onChange={f('period_number')} min={1}/></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Time</label>
            <input type="time" className={INP} value={form.start_time} onChange={f('start_time')}/></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End Time</label>
            <input type="time" className={INP} value={form.end_time} onChange={f('end_time')}/></div>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div onClick={() => setForm(p => ({ ...p, is_break: !p.is_break }))}
            className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${form.is_break ? 'bg-amber-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_break ? 'translate-x-4' : 'translate-x-0.5'}`}/>
          </div>
          <span className="text-sm font-medium text-gray-700">This is a break / lunch (no lesson)</span>
        </label>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Slot Modal ────────────────────────────────────────────────
function SlotModal({ slot, classId, periodId, dayOfWeek, termId, yearId, subjects, staff, rooms, onSave, onClose }) {
  const [form, setForm] = useState({
    subject_id: slot?.subject_id || '',
    teacher_id: slot?.teacher_id || '',
    room_id:    slot?.room_id    || '',
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setLoading(true);
    try {
      await upsertTtSlot({
        class_id: classId, period_id: periodId, day_of_week: dayOfWeek,
        subject_id: form.subject_id||null, teacher_id: form.teacher_id||null,
        room_id: form.room_id||null, term_id: termId||null, academic_year_id: yearId||null,
      });
      toast.success('Slot saved!'); onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Conflict or error'); }
    finally { setLoading(false); }
  };

  const del = async () => {
    if (!slot?.id) return;
    await deleteTtSlot(slot.id);
    toast.success('Slot cleared'); onSave();
  };

  return (
    <Modal title={`${DAYS[dayOfWeek-1]} · Period`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
          <div className="relative"><select className={SEL} value={form.subject_id} onChange={f('subject_id')}>
            <option value="">— No subject —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Teacher</label>
          <div className="relative"><select className={SEL} value={form.teacher_id} onChange={f('teacher_id')}>
            <option value="">— No teacher —</option>
            {staff.filter(s => s.role==='teacher'||s.role==='dos').map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Room</label>
          <div className="relative"><select className={SEL} value={form.room_id} onChange={f('room_id')}>
            <option value="">— No room —</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (cap.{r.capacity})</option>)}
          </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
        </div>
      </div>
      <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
        {slot?.id && <button onClick={del} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50 px-3.5"><Trash2 className="w-4 h-4"/></button>}
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── MAIN TIMETABLE PAGE ───────────────────────────────────────
export default function Timetable() {
  const role    = getRole();
  const canEdit = ['admin','dos'].includes(role);

  // Data
  const [years,    setYears]    = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [rooms,    setRooms]    = useState([]);
  const [periods,  setPeriods]  = useState([]);
  const [slots,    setSlots]    = useState([]);
  const [workload, setWorkload] = useState([]);
  const [conflicts,setConflicts]= useState([]);
  const [loading,  setLoading]  = useState(false);
  const [dlState,  setDlState]  = useState(''); // 'class'|'teacher'|'school'

  // Filters
  const [selYear,  setSelYear]  = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [selClass, setSelClass] = useState('');

  // UI
  const [tab,         setTab]         = useState('timetable'); // timetable|periods|rooms|workload|conflicts|generate
  const [slotModal,   setSlotModal]   = useState(null);
  const [roomModal,   setRoomModal]   = useState(null);
  const [periodModal, setPeriodModal] = useState(null);
  const [showDays,    setShowDays]    = useState([1,2,3,4,5]);
  const [genTeacher,  setGenTeacher]  = useState(''); // for teacher timetable export

  const downloadFile = async (fn, params, filename) => {
    try {
      const res = await fn(params);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Downloaded!');
    } catch (err) { toast.error(err.response?.data?.error || 'Download failed'); }
  };

  const handleExportClass = async () => {
    if (!selClass || !selYear) { toast.error('Select class and academic year first'); return; }
    setDlState('class');
    await downloadFile(exportClassTimetable,
      { class_id: selClass, academic_year_id: selYear, ...(selTerm ? { term_id: selTerm } : {}) },
      `class_timetable.xlsx`
    );
    setDlState('');
  };

  const handleExportTeacher = async () => {
    if (!genTeacher || !selYear) { toast.error('Select teacher and academic year'); return; }
    setDlState('teacher');
    await downloadFile(exportTeacherTimetable,
      { teacher_id: genTeacher, academic_year_id: selYear, ...(selTerm ? { term_id: selTerm } : {}) },
      `teacher_timetable.xlsx`
    );
    setDlState('');
  };

  const handleExportSchool = async () => {
    if (!selYear) { toast.error('Select academic year first'); return; }
    setDlState('school');
    await downloadFile(exportSchoolTimetable,
      { academic_year_id: selYear, ...(selTerm ? { term_id: selTerm } : {}) },
      `school_timetable.xlsx`
    );
    setDlState('');
  };

  // Boot
  useEffect(() => {
    Promise.all([
      getAcademicYears(), getTerms(), getSmsClasses(), getStaff(),
      getTtRooms(), 
    ]).then(([y, t, c, s, r]) => {
      const yrs = y.data.data || [];
      setYears(yrs);
      setTerms((t.data.data || []).filter(x => x.number !== 4));
      setClasses(c.data.data || []);
      setStaff(s.data.data || []);
      setRooms(r.data.data || []);
      const cur = yrs.find(yr => yr.is_current);
      if (cur) setSelYear(cur.id);
    }).catch(() => toast.error('Failed to load'));
  }, []);

  // Load periods when year/term changes
  useEffect(() => {
    if (!selYear) return;
    getTtPeriods({ academic_year_id: selYear, ...(selTerm ? { term_id: selTerm } : {}) })
      .then(r => setPeriods(r.data.data || []));
  }, [selYear, selTerm]);

  // Load subjects when class changes
  useEffect(() => {
    if (!selClass) { setSubjects([]); return; }
    getSmsSubjects({ class_id: selClass }).then(r => setSubjects(r.data.data || []));
  }, [selClass]);

  // Load slots when class/term/year changes
  const loadSlots = () => {
    if (!selClass || !selYear) return;
    setLoading(true);
    const params = { class_id: selClass, academic_year_id: selYear };
    if (selTerm) params.term_id = selTerm;
    getTtSlots(params)
      .then(r => setSlots(r.data.data || []))
      .catch(() => toast.error('Failed to load timetable'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadSlots(); }, [selClass, selTerm, selYear]);

  const loadReports = () => {
    if (!selYear) return;
    const p = { academic_year_id: selYear, ...(selTerm ? { term_id: selTerm } : {}) };
    getTtWorkload(p).then(r => setWorkload(r.data.data || [])).catch(() => {});
    getTtConflicts(p).then(r => setConflicts(r.data.data || [])).catch(() => {});
  };
  useEffect(() => { if (tab === 'workload' || tab === 'conflicts') loadReports(); }, [tab, selYear, selTerm]);

  // Slot lookup helper
  const getSlot = (periodId, day) => slots.find(s => s.period_id === periodId && s.day_of_week === day);

  // Subject color map
  const subjectColorMap = useMemo(() => {
    const m = {};
    subjects.forEach((s, i) => { m[s.id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
    return m;
  }, [subjects]);

  const activePeriods = periods.filter(p => !p.is_break).sort((a,b) => a.period_number - b.period_number);
  const allPeriods    = periods.sort((a,b) => a.period_number - b.period_number);
  const selCls        = classes.find(c => c.id === selClass);
  const selTrmObj     = terms.find(t => t.id === selTerm);

  const TABS = [
    { key:'timetable', label:'Timetable Grid',    icon: Grid3X3 },
    { key:'periods',   label:'Time Periods',      icon: Clock },
    { key:'rooms',     label:'Rooms',             icon: MapPin },
    { key:'generate',  label:'Generate / Export', icon: FileSpreadsheet },
    { key:'workload',  label:'Teacher Workload',  icon: BarChart2 },
    { key:'conflicts', label:'Conflicts',         icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Timetable</h1>
              <p className="text-gray-400 text-xs">Manage class schedules, teacher allocations &amp; rooms</p>
            </div>
          </div>
        </div>

        {/* ── Filters bar ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-40">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Academic Year</label>
              <div className="relative"><select value={selYear} onChange={e => { setSelYear(e.target.value); setSelTerm(''); }} className={SEL}>
                <option value="">— Select Year —</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
              </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Term</label>
              <div className="relative"><select value={selTerm} onChange={e => setSelTerm(e.target.value)} className={SEL}>
                <option value="">— All Terms —</option>
                {terms.filter(t => !selYear || t.academic_year_id === selYear).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
            </div>
            <div className="flex-1 min-w-44">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Class</label>
              <div className="relative"><select value={selClass} onChange={e => setSelClass(e.target.value)} className={SEL}>
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
              </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
            </div>
            <button onClick={loadSlots} disabled={loading} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm self-end">
              <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/> Refresh
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl shadow-sm p-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all
                  ${tab === t.key ? 'bg-[#0a2156] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <Icon className="w-3.5 h-3.5"/> {t.label}
                {t.key === 'conflicts' && conflicts.length > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">{conflicts.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════
            TAB: TIMETABLE GRID
        ══════════════════════════════════════════════════ */}
        {tab === 'timetable' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Grid header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div>
                <p className="font-bold text-gray-900 text-sm">
                  {selCls ? selCls.name : 'Select a class'}{selTrmObj ? ` · ${selTrmObj.name}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{allPeriods.length} periods · {slots.length} slots filled</p>
              </div>
              {/* Day filter */}
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => setShowDays(p => p.includes(i+1) ? p.filter(x=>x!==i+1) : [...p,i+1].sort())}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all
                      ${showDays.includes(i+1) ? 'bg-[#0a2156] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {DAY_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>

            {!selClass ? (
              <div className="py-20 text-center">
                <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                <p className="font-semibold text-gray-500 text-sm">Select a class to view its timetable</p>
              </div>
            ) : loading ? (
              <div className="py-16 text-center">
                <span className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block"/>
              </div>
            ) : allPeriods.length === 0 ? (
              <div className="py-16 text-center">
                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                <p className="font-semibold text-gray-500 text-sm">No periods configured</p>
                <button onClick={() => setTab('periods')} className="text-blue-600 text-xs mt-2 hover:underline">Set up time periods first →</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-[#0a2156]">
                      <th className="py-3 px-4 text-left text-white font-semibold w-32 border-r border-blue-800/30">Period</th>
                      <th className="py-3 px-3 text-center text-white font-semibold w-20 border-r border-blue-800/30">Time</th>
                      {DAYS.map((d, i) => showDays.includes(i+1) && (
                        <th key={i} className="py-3 px-3 text-center text-white font-semibold border-r border-blue-800/30">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allPeriods.map((period, pi) => (
                      <tr key={period.id} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        <td className="py-2 px-4 border-r border-gray-100">
                          <p className="font-semibold text-gray-800">{period.name}</p>
                          {period.is_break && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Break</span>}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-500 border-r border-gray-100 whitespace-nowrap">
                          {period.start_time?.slice(0,5)}–{period.end_time?.slice(0,5)}
                        </td>
                        {DAYS.map((d, di) => {
                          if (!showDays.includes(di+1)) return null;
                          if (period.is_break) return (
                            <td key={di} className="py-2 px-2 border-r border-gray-100 border-b border-gray-50 bg-amber-50/30 text-center text-gray-300 text-[10px]">—</td>
                          );
                          const slot = getSlot(period.id, di+1);
                          const sub  = slot ? subjects.find(s => s.id === slot.subject_id) : null;
                          const col  = sub ? subjectColorMap[sub.id] : '';
                          return (
                            <td key={di} className="py-1.5 px-2 border-r border-gray-100 border-b border-gray-50 align-top min-w-[100px]">
                              {slot && sub ? (
                                <div
                                  onClick={() => canEdit && setSlotModal({ periodId: period.id, dayOfWeek: di+1, slot })}
                                  className={`rounded-xl border px-2 py-1.5 text-[11px] cursor-pointer hover:opacity-80 transition-opacity ${col}`}>
                                  <p className="font-bold leading-tight truncate">{sub.name}</p>
                                  {slot.teacher && <p className="opacity-70 mt-0.5 truncate">{slot.teacher.full_name}</p>}
                                  {slot.room    && <p className="opacity-60 mt-0.5">{slot.room.name}</p>}
                                </div>
                              ) : (
                                canEdit && (
                                  <button
                                    onClick={() => setSlotModal({ periodId: period.id, dayOfWeek: di+1, slot: null })}
                                    className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 text-[10px] hover:border-blue-300 hover:text-blue-400 transition-colors flex items-center justify-center">
                                    <Plus className="w-3.5 h-3.5"/>
                                  </button>
                                )
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: PERIODS
        ══════════════════════════════════════════════════ */}
        {tab === 'periods' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <p className="font-bold text-gray-900 text-sm">{periods.length} periods configured</p>
              {canEdit && <button onClick={() => setPeriodModal('new')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2156] text-white text-xs font-bold hover:bg-[#0c2a6a] transition-colors shadow-sm">
                <Plus className="w-3.5 h-3.5"/> Add Period
              </button>}
            </div>
            {allPeriods.length === 0 ? (
              <div className="py-14 text-center">
                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                <p className="font-semibold text-gray-500 text-sm">No periods yet</p>
                {canEdit && <button onClick={() => setPeriodModal('new')} className="text-blue-600 text-xs mt-2 hover:underline">Add first period →</button>}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {allPeriods.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/60 transition-colors group">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0
                      ${p.is_break ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.period_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.start_time?.slice(0,5)} – {p.end_time?.slice(0,5)}
                        {p.is_break && <span className="ml-2 text-amber-600 font-semibold">Break</span>}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPeriodModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={async () => { if(window.confirm('Delete this period?')){ await deleteTtPeriod(p.id); getTtPeriods({academic_year_id:selYear}).then(r=>setPeriods(r.data.data||[])); }}}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: ROOMS
        ══════════════════════════════════════════════════ */}
        {tab === 'rooms' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <p className="font-bold text-gray-900 text-sm">{rooms.length} rooms</p>
              {canEdit && <button onClick={() => setRoomModal('new')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2156] text-white text-xs font-bold hover:bg-[#0c2a6a] transition-colors shadow-sm">
                <Plus className="w-3.5 h-3.5"/> Add Room
              </button>}
            </div>
            {rooms.length === 0 ? (
              <div className="py-14 text-center">
                <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                <p className="font-semibold text-gray-500 text-sm">No rooms yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {rooms.map(r => (
                  <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 group hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{r.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">{r.room_type} · cap. {r.capacity}</p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => setRoomModal(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={async () => { if(window.confirm('Delete room?')){ await deleteTtRoom(r.id); getTtRooms().then(r=>setRooms(r.data.data||[])); }}}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: GENERATE / EXPORT
        ══════════════════════════════════════════════════ */}
        {tab === 'generate' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Class Timetable */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Grid3X3 className="w-5 h-5 text-blue-600"/>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm">Class Timetable</p>
                  <p className="text-xs text-gray-400">Full week for one class</p>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4 flex-1">
                <p className="text-xs text-gray-500">
                  Class selected above:
                  {selCls
                    ? <span className="ml-1 font-bold text-blue-600">{selCls.name}</span>
                    : <span className="ml-1 text-amber-600">None selected</span>}
                </p>
                <button onClick={handleExportClass} disabled={!!dlState || !selClass || !selYear}
                  className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm w-full">
                  {dlState === 'class'
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <Download className="w-4 h-4"/>}
                  Download .xlsx
                </button>
              </div>
            </div>

            {/* Teacher Timetable */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-violet-600"/>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm">Teacher Timetable</p>
                  <p className="text-xs text-gray-400">All classes for one teacher</p>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Teacher</label>
                  <div className="relative">
                    <select value={genTeacher} onChange={e => setGenTeacher(e.target.value)} className={SEL}>
                      <option value="">— Select —</option>
                      {staff.filter(s => s.role === 'teacher' || s.role === 'dos').map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                  </div>
                </div>
                <button onClick={handleExportTeacher} disabled={!!dlState || !genTeacher || !selYear}
                  className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm w-full">
                  {dlState === 'teacher'
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <Download className="w-4 h-4"/>}
                  Download .xlsx
                </button>
              </div>
            </div>

            {/* Full School Timetable */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600"/>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm">Full School</p>
                  <p className="text-xs text-gray-400">One sheet per class</p>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4 flex-1">
                <p className="text-xs text-gray-500">
                  All classes in
                  {selYear
                    ? <span className="ml-1 font-bold text-emerald-600">{years.find(y=>y.id===selYear)?.name}</span>
                    : <span className="ml-1 text-amber-600"> no year selected</span>}
                  {selTerm && <span className="text-gray-400"> · {selTrmObj?.name}</span>}
                  <span className="block mt-1">Includes summary sheet.</span>
                </p>
                <button onClick={handleExportSchool} disabled={!!dlState || !selYear}
                  className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm w-full">
                  {dlState === 'school'
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <Download className="w-4 h-4"/>}
                  Download .xlsx
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: TEACHER WORKLOAD
        ══════════════════════════════════════════════════ */}
        {tab === 'workload' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50">
              <p className="font-bold text-gray-900 text-sm">Teacher Workload</p>
              <p className="text-xs text-gray-400 mt-0.5">Periods per teacher per week</p>
            </div>
            {workload.length === 0 ? (
              <div className="py-14 text-center text-gray-400">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 text-gray-200"/>
                <p className="text-sm font-semibold text-gray-500">No timetable data yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {workload.map((t, i) => (
                  <div key={t.id || i} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0a2156]/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[#0a2156]"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{t.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Object.entries(t.periods_per_day).map(([d,n]) => `${d}: ${n}`).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-[#0a2156]">{t.total_periods}</p>
                      <p className="text-[10px] text-gray-400">periods/week</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: CONFLICTS
        ══════════════════════════════════════════════════ */}
        {tab === 'conflicts' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50">
              <p className="font-bold text-gray-900 text-sm">
                {conflicts.length === 0 ? '✅ No conflicts found' : `⚠️ ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} detected`}
              </p>
            </div>
            {conflicts.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-7 h-7 text-emerald-600"/>
                </div>
                <p className="font-semibold text-gray-700">Timetable is conflict-free</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {conflicts.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-red-600"/>
                    </div>
                    <div>
                      <p className="font-semibold text-red-800 text-sm capitalize">{c.type} conflict</p>
                      <p className="text-xs text-red-600 mt-0.5">{c.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {c.slots?.map(s => `${s.class?.name} (${DAYS[(s.day_of_week||1)-1]})`).join(' vs ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      {slotModal && (
        <SlotModal
          slot={slotModal.slot} classId={selClass}
          periodId={slotModal.periodId} dayOfWeek={slotModal.dayOfWeek}
          termId={selTerm} yearId={selYear}
          subjects={subjects} staff={staff} rooms={rooms}
          onSave={() => { setSlotModal(null); loadSlots(); }}
          onClose={() => setSlotModal(null)}
        />
      )}
      {roomModal && (
        <RoomModal room={roomModal==='new'?null:roomModal}
          onSave={() => { setRoomModal(null); getTtRooms().then(r=>setRooms(r.data.data||[])); }}
          onClose={() => setRoomModal(null)}/>
      )}
      {periodModal && (
        <PeriodModal period={periodModal==='new'?null:periodModal}
          yearId={selYear} termId={selTerm}
          onSave={() => { setPeriodModal(null); getTtPeriods({academic_year_id:selYear}).then(r=>setPeriods(r.data.data||[])); }}
          onClose={() => setPeriodModal(null)}/>
      )}
    </div>
  );
}
