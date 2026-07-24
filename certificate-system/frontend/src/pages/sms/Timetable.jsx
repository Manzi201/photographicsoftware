import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Plus, Trash2, Edit2, X, Check, ChevronDown,
  Clock, Users, BookOpen, MapPin, AlertTriangle, RefreshCw,
  BarChart2, Grid3X3, List, Layers, User, Download, FileSpreadsheet,
  Zap, Settings2, Bot, Send, Sparkles, GripVertical, ChevronRight,
  Info, CheckCircle2, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAcademicYears, getTerms, getSmsClasses, getSmsSubjects, getStaff,
  getTtRooms, createTtRoom, updateTtRoom, deleteTtRoom,
  getTtPeriods, createTtPeriod, updateTtPeriod, deleteTtPeriod,
  getTtSlots, upsertTtSlot, deleteTtSlot, clearClassTimetable,
  getTtWorkload, getTtConflicts,
  exportClassTimetable, exportTeacherTimetable, exportSchoolTimetable,
  autoGenerateTimetable, aiTimetableChat, aiCheckSlot,
} from '../../api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const SUBJECT_COLORS = [
  { bg:'bg-blue-100',    text:'text-blue-800',    border:'border-blue-200',    drag:'#dbeafe' },
  { bg:'bg-emerald-100', text:'text-emerald-800', border:'border-emerald-200', drag:'#d1fae5' },
  { bg:'bg-violet-100',  text:'text-violet-800',  border:'border-violet-200',  drag:'#ede9fe' },
  { bg:'bg-amber-100',   text:'text-amber-800',   border:'border-amber-200',   drag:'#fef3c7' },
  { bg:'bg-rose-100',    text:'text-rose-800',    border:'border-rose-200',    drag:'#ffe4e6' },
  { bg:'bg-sky-100',     text:'text-sky-800',     border:'border-sky-200',     drag:'#e0f2fe' },
  { bg:'bg-orange-100',  text:'text-orange-800',  border:'border-orange-200',  drag:'#ffedd5' },
  { bg:'bg-teal-100',    text:'text-teal-800',    border:'border-teal-200',    drag:'#ccfbf1' },
  { bg:'bg-pink-100',    text:'text-pink-800',    border:'border-pink-200',    drag:'#fce7f3' },
  { bg:'bg-lime-100',    text:'text-lime-800',    border:'border-lime-200',    drag:'#ecfccb' },
];
const SEL = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all shadow-sm';
const INP = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all';

function getRole() {
  try { return JSON.parse(localStorage.getItem('staff_data') || '{}').role || 'dos'; }
  catch { return 'dos'; }
}

// ── Modals ────────────────────────────────────────────────────
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

function RoomModal({ room, onSave, onClose }) {
  const [form, setForm] = useState({ name: room?.name||'', capacity: room?.capacity||40, room_type: room?.room_type||'classroom' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    if (!form.name.trim()) { toast.error('Room name required'); return; }
    setLoading(true);
    try {
      room?.id ? await updateTtRoom(room.id, form) : await createTtRoom(form);
      toast.success(room?.id ? 'Room updated!' : 'Room created!'); onSave();
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
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}</button>
      </div>
    </Modal>
  );
}

function PeriodModal({ period, yearId, termId, onSave, onClose }) {
  const [form, setForm] = useState({
    name: period?.name||'', period_number: period?.period_number||1,
    start_time: period?.start_time||'07:00', end_time: period?.end_time||'07:45',
    is_break: period?.is_break||false, academic_year_id: yearId||'', term_id: termId||'',
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
          <span className="text-sm font-medium text-gray-700">This is a break / lunch</span>
        </label>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}</button>
      </div>
    </Modal>
  );
}

// ── Slot Modal with conflict check ───────────────────────────
function SlotModal({ slot, classId, periodId, dayOfWeek, termId, yearId, subjects, staff, rooms, subjectColorMap, onSave, onClose }) {
  const [form, setForm] = useState({ subject_id: slot?.subject_id||'', teacher_id: slot?.teacher_id||'', room_id: slot?.room_id||'' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Live conflict check whenever subject/teacher changes
  useEffect(() => {
    if (!form.teacher_id && !form.subject_id) { setWarnings([]); return; }
    setChecking(true);
    aiCheckSlot({ teacher_id: form.teacher_id||null, period_id: periodId, day_of_week: dayOfWeek, class_id: classId, subject_id: form.subject_id||null, academic_year_id: yearId })
      .then(r => setWarnings(r.data.warnings || []))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [form.teacher_id, form.subject_id]);

  const save = async () => {
    const errors = warnings.filter(w => w.severity === 'error');
    if (errors.length > 0) { toast.error('Fix conflicts before saving'); return; }
    setLoading(true);
    try {
      await upsertTtSlot({ class_id:classId, period_id:periodId, day_of_week:dayOfWeek, subject_id:form.subject_id||null, teacher_id:form.teacher_id||null, room_id:form.room_id||null, term_id:termId||null, academic_year_id:yearId||null });
      toast.success('Slot saved!'); onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Conflict or error'); }
    finally { setLoading(false); }
  };
  const del = async () => { if (!slot?.id) return; await deleteTtSlot(slot.id); toast.success('Slot cleared'); onSave(); };

  const selSub = subjects.find(s => s.id === form.subject_id);
  const col = selSub ? (subjectColorMap[selSub.id] || SUBJECT_COLORS[0]) : null;

  return (
    <Modal title={`${DAYS[(dayOfWeek||1)-1]} · ${slot?.period?.name || 'Period'}`} onClose={onClose}>
      {/* Preview badge */}
      {selSub && (
        <div className={`mx-6 mt-4 rounded-xl px-4 py-2.5 border ${col.bg} ${col.text} ${col.border} flex items-center gap-2`}>
          <div className={`w-2 h-2 rounded-full ${col.bg.replace('100','500')}`}/>
          <span className="font-bold text-sm">{(selSub.code || selSub.name || '').toUpperCase()}</span>
          <span className="opacity-60 text-xs ml-auto">/{selSub.max_marks || 100}</span>
        </div>
      )}
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
            {staff.filter(s=>s.role==='teacher'||s.role==='dos').map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Room</label>
          <div className="relative"><select className={SEL} value={form.room_id} onChange={f('room_id')}>
            <option value="">— No room —</option>
            {rooms.map(r=><option key={r.id} value={r.id}>{r.name} (cap.{r.capacity})</option>)}
          </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/></div>
        </div>

        {/* Warnings */}
        {checking && <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin inline-block"/> Checking conflicts…</p>}
        {warnings.map((w, i) => (
          <div key={i} className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium
            ${w.severity==='error' ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-amber-50 border border-amber-100 text-amber-700'}`}>
            {w.severity==='error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/> : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>}
            {w.message}
          </div>
        ))}
        {!checking && form.teacher_id && warnings.filter(w=>w.severity==='error').length===0 && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5"/> No conflicts detected
          </p>
        )}
      </div>
      <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
        {slot?.id && <button onClick={del} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50 px-3.5"><Trash2 className="w-4 h-4"/></button>}
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={loading||warnings.filter(w=>w.severity==='error').length>0}
          className="btn-primary flex-1 justify-center disabled:opacity-50">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── AI Chat Panel ─────────────────────────────────────────────
function AIPanel({ onClose, selYear, selTerm, selClass }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Muraho! 👋 I'm your timetable assistant. Ask me anything about your schedule — conflicts, teacher workload, suggestions, or optimizations. I can respond in English, French, or Kinyarwanda." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const SUGGESTIONS = [
    'Are there any teacher conflicts?',
    'Which teacher has the most periods?',
    'Suggest improvements for the timetable',
    'Is MATH well distributed across the week?',
  ];

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: msg };
    setMessages(p => [...p, userMsg]);
    setLoading(true);
    try {
      const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const res = await aiTimetableChat({ message: msg, history, academic_year_id: selYear, term_id: selTerm });
      setMessages(p => [...p, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', content: `Sorry, I couldn't connect to the AI: ${err.response?.data?.error || err.message}` }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-96 max-w-[calc(100vw-2rem)] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(10,33,86,0.18)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#0a2156] to-[#1e3a8a] shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-yellow-300"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">AI Timetable Assistant</p>
          <p className="text-blue-300 text-[10px]">Powered by Mistral AI</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
          <X className="w-4 h-4"/>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-xl bg-[#0a2156] flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Bot className="w-4 h-4 text-white"/>
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${m.role === 'user'
                ? 'bg-[#0a2156] text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-xl bg-[#0a2156] flex items-center justify-center shrink-0 mr-2">
              <Bot className="w-4 h-4 text-white"/>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }}/>)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick suggestions (only at start) */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex gap-2 flex-wrap shrink-0">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white shrink-0">
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your timetable…"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-400 transition-all"/>
        <button onClick={() => send()} disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white flex items-center justify-center transition-colors disabled:opacity-50 shrink-0">
          <Send className="w-4 h-4"/>
        </button>
      </div>
    </div>
  );
}

// ── Drag Panel: subject+teacher cards ────────────────────────
function DragPanel({ subjects, staff, rooms, subjectColorMap, classId, termId, yearId, onSlotDrop }) {
  const [selTeacher, setSelTeacher] = useState('');
  const [selRoom,    setSelRoom]    = useState('');
  const teachers = staff.filter(s => s.role === 'teacher' || s.role === 'dos');

  const handleDragStart = (e, sub) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      subject_id: sub.id,
      teacher_id: selTeacher || '',
      room_id:    selRoom    || '',
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-56 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-[#0a2156] shrink-0">
        <p className="text-white font-bold text-xs uppercase tracking-widest">Drag to Place</p>
        <p className="text-blue-200 text-[10px] mt-0.5">Drop a subject onto any cell</p>
      </div>

      {/* Teacher selector */}
      <div className="p-3 border-b border-gray-50 space-y-2 shrink-0">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Teacher</label>
          <div className="relative">
            <select value={selTeacher} onChange={e => setSelTeacher(e.target.value)}
              className="w-full text-xs appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-7 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition-all">
              <option value="">— None —</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"/>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Room</label>
          <div className="relative">
            <select value={selRoom} onChange={e => setSelRoom(e.target.value)}
              className="w-full text-xs appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-7 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition-all">
              <option value="">— None —</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"/>
          </div>
        </div>
      </div>

      {/* Subject cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {subjects.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Select a class first</p>
        ) : subjects.map(sub => {
          const col = subjectColorMap[sub.id] || SUBJECT_COLORS[0];
          return (
            <div key={sub.id}
              draggable
              onDragStart={e => handleDragStart(e, sub)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing
                hover:shadow-sm transition-all select-none ${col.bg} ${col.text} ${col.border}`}>
              <GripVertical className="w-3 h-3 opacity-40 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs leading-tight truncate">{(sub.code || sub.name || '').toUpperCase()}</p>
                <p className="text-[10px] opacity-60 truncate">{sub.name}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 pb-3 shrink-0">
        <p className="text-[10px] text-gray-400 text-center">Drag a card onto a grid cell</p>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function Timetable() {
  const role    = getRole();
  const canEdit = ['admin','dos'].includes(role);

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
  const [dlState,  setDlState]  = useState('');
  const [autoGenLoading,   setAutoGenLoading]   = useState(false);
  const [autoGenResult,    setAutoGenResult]     = useState(null);
  const [autoGenDays,      setAutoGenDays]       = useState(5);
  const [autoGenOverwrite, setAutoGenOverwrite]  = useState(false);
  const [dropTarget, setDropTarget] = useState(null); // {periodId, day}

  const [selYear,  setSelYear]  = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [selClass, setSelClass] = useState('');

  const [tab,         setTab]         = useState('timetable');
  const [slotModal,   setSlotModal]   = useState(null);
  const [roomModal,   setRoomModal]   = useState(null);
  const [periodModal, setPeriodModal] = useState(null);
  const [showDays,    setShowDays]    = useState([1,2,3,4,5]);
  const [genTeacher,  setGenTeacher]  = useState('');
  const [showAI,      setShowAI]      = useState(false);
  const [showDragPanel, setShowDragPanel] = useState(false);

  const downloadFile = async (fn, params, filename) => {
    try {
      const res = await fn(params);
      const url = URL.createObjectURL(new Blob([res.data], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href=url; a.download=filename;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Downloaded!');
    } catch (err) { toast.error(err.response?.data?.error || 'Download failed'); }
  };
  const handleExportClass   = async () => { if(!selClass||!selYear){toast.error('Select class and year');return;} setDlState('class');   await downloadFile(exportClassTimetable,{class_id:selClass,academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},'class_timetable.xlsx');   setDlState(''); };
  const handleExportTeacher = async () => { if(!genTeacher||!selYear){toast.error('Select teacher and year');return;} setDlState('teacher'); await downloadFile(exportTeacherTimetable,{teacher_id:genTeacher,academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},'teacher_timetable.xlsx'); setDlState(''); };
  const handleExportSchool  = async () => { if(!selYear){toast.error('Select year');return;} setDlState('school');  await downloadFile(exportSchoolTimetable,{academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},'school_timetable.xlsx');  setDlState(''); };

  const handleAutoGenerate = async () => {
    if (!selYear) { toast.error('Select academic year first'); return; }
    if (!periods.length) { toast.error('Create time periods first'); return; }
    setAutoGenLoading(true); setAutoGenResult(null);
    try {
      const res = await autoGenerateTimetable({ academic_year_id:selYear, term_id:selTerm||null, days_per_week:parseInt(autoGenDays), overwrite:autoGenOverwrite });
      setAutoGenResult(res.data);
      toast.success(res.data.message || 'Timetable generated!');
      loadSlots();
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setAutoGenLoading(false); }
  };

  useEffect(() => {
    Promise.all([getAcademicYears(), getTerms(), getSmsClasses(), getStaff(), getTtRooms()])
      .then(([y,t,c,s,r]) => {
        const yrs = y.data.data||[];
        setYears(yrs); setTerms((t.data.data||[]).filter(x=>x.number!==4));
        setClasses(c.data.data||[]); setStaff(s.data.data||[]); setRooms(r.data.data||[]);
        const cur = yrs.find(yr=>yr.is_current);
        if (cur) setSelYear(cur.id);
      }).catch(()=>toast.error('Failed to load'));
  }, []);

  useEffect(() => {
    if (!selYear) return;
    getTtPeriods({ academic_year_id:selYear, ...(selTerm?{term_id:selTerm}:{}) })
      .then(r => setPeriods(r.data.data||[]));
  }, [selYear, selTerm]);

  useEffect(() => {
    if (!selClass) { setSubjects([]); return; }
    getSmsSubjects({ class_id:selClass }).then(r => setSubjects(r.data.data||[]));
  }, [selClass]);

  const loadSlots = () => {
    if (!selClass||!selYear) return;
    setLoading(true);
    const p = { class_id:selClass, academic_year_id:selYear };
    if (selTerm) p.term_id = selTerm;
    getTtSlots(p).then(r=>setSlots(r.data.data||[])).catch(()=>toast.error('Failed to load')).finally(()=>setLoading(false));
  };
  useEffect(() => { loadSlots(); }, [selClass,selTerm,selYear]);

  const loadReports = () => {
    if (!selYear) return;
    const p = { academic_year_id:selYear, ...(selTerm?{term_id:selTerm}:{}) };
    getTtWorkload(p).then(r=>setWorkload(r.data.data||[])).catch(()=>{});
    getTtConflicts(p).then(r=>setConflicts(r.data.data||[])).catch(()=>{});
  };
  useEffect(() => { if(tab==='workload'||tab==='conflicts') loadReports(); }, [tab,selYear,selTerm]);

  const getSlot = (periodId, day) => slots.find(s => s.period_id===periodId && s.day_of_week===day);

  const subjectColorMap = useMemo(() => {
    const m = {};
    subjects.forEach((s,i) => { m[s.id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
    return m;
  }, [subjects]);

  // Drag-and-drop handlers
  const handleDragOver = (e, periodId, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTarget({ periodId, day });
  };
  const handleDragLeave = () => setDropTarget(null);
  const handleDrop = async (e, period, day) => {
    e.preventDefault();
    setDropTarget(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!data.subject_id) return;
      // Quick conflict check
      const check = await aiCheckSlot({ teacher_id:data.teacher_id||null, period_id:period.id, day_of_week:day, class_id:selClass, subject_id:data.subject_id, academic_year_id:selYear });
      const errors = (check.data.warnings||[]).filter(w=>w.severity==='error');
      if (errors.length > 0) {
        toast.error(`⚠ ${errors[0].message}`, { duration: 4000 });
        return;
      }
      await upsertTtSlot({ class_id:selClass, period_id:period.id, day_of_week:day, subject_id:data.subject_id, teacher_id:data.teacher_id||null, room_id:data.room_id||null, term_id:selTerm||null, academic_year_id:selYear||null });
      const warnings = (check.data.warnings||[]).filter(w=>w.severity==='warning');
      if (warnings.length > 0) toast(`⚠ ${warnings[0].message}`, { icon:'⚠️', duration: 3000 });
      else toast.success('Slot placed!');
      loadSlots();
    } catch (err) { toast.error(err.response?.data?.error || 'Drop failed'); }
  };

  const allPeriods    = periods.sort((a,b)=>a.period_number-b.period_number);
  const selCls        = classes.find(c=>c.id===selClass);
  const selTrmObj     = terms.find(t=>t.id===selTerm);

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
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => setShowDragPanel(p => !p)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all
                  ${showDragPanel ? 'bg-[#0a2156] text-white border-[#0a2156]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                <GripVertical className="w-3.5 h-3.5"/> Drag &amp; Drop
              </button>
              <button onClick={() => setShowAI(p => !p)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all
                  ${showAI ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                <Sparkles className="w-3.5 h-3.5 text-yellow-500"/> AI Assistant
              </button>
            </div>
          )}
        </div>

        {/* ── Filters ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-40">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Academic Year</label>
              <div className="relative">
                <select value={selYear} onChange={e=>{setSelYear(e.target.value);setSelTerm('');setSelClass('');}} className={SEL}>
                  <option value="">— Select Year —</option>
                  {years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
                </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Term</label>
              <div className="relative">
                <select value={selTerm} onChange={e=>setSelTerm(e.target.value)} className={SEL}>
                  <option value="">— All Terms —</option>
                  {terms.filter(t=>!selYear||t.academic_year_id===selYear).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div className="flex-1 min-w-44">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Class</label>
              <div className="relative">
                <select value={selClass} onChange={e=>setSelClass(e.target.value)} className={SEL}>
                  <option value="">— Select Class —</option>
                  {classes.filter(c=>!selYear||!c.academic_year_id||c.academic_year_id===selYear).map(c=><option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
                </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <button onClick={loadSlots} disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm self-end">
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
                  ${tab===t.key ? 'bg-[#0a2156] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <Icon className="w-3.5 h-3.5"/> {t.label}
                {t.key==='conflicts' && conflicts.length>0 && (
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
          <div className={`flex gap-4 items-start ${showDragPanel ? '' : ''}`}>

            {/* Drag panel — only in edit mode */}
            {showDragPanel && canEdit && (
              <DragPanel
                subjects={subjects} staff={staff} rooms={rooms}
                subjectColorMap={subjectColorMap}
                classId={selClass} termId={selTerm} yearId={selYear}
                onSlotDrop={loadSlots}
              />
            )}

            {/* Grid card */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 flex-wrap gap-2">
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {selCls ? selCls.name : 'Select a class'}{selTrmObj ? ` · ${selTrmObj.name}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{allPeriods.length} periods · {slots.length} slots filled</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map((d,i) => (
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
                  {canEdit && showDragPanel && <p className="text-xs text-gray-400 mt-1">Then drag subjects from the left panel onto cells</p>}
                </div>
              ) : loading ? (
                <div className="py-16 text-center">
                  <span className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block"/>
                </div>
              ) : allPeriods.length === 0 ? (
                <div className="py-16 text-center">
                  <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                  <p className="font-semibold text-gray-500 text-sm">No periods configured</p>
                  <button onClick={() => setTab('periods')} className="text-blue-600 text-xs mt-2 hover:underline">Set up time periods →</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-[#0a2156]">
                        <th className="py-3 px-4 text-left text-white font-semibold w-28 border-r border-blue-800/30">Period</th>
                        <th className="py-3 px-3 text-center text-white font-semibold w-20 border-r border-blue-800/30">Time</th>
                        {DAYS.map((d,i) => showDays.includes(i+1) && (
                          <th key={i} className="py-3 px-3 text-center text-white font-semibold border-r border-blue-800/30 min-w-[88px]">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allPeriods.map((period,pi) => (
                        <tr key={period.id} className={pi%2===0 ? 'bg-white' : 'bg-gray-50/40'}>
                          <td className="py-2 px-4 border-r border-gray-100">
                            <p className="font-semibold text-gray-800">{period.name}</p>
                            {period.is_break && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Break</span>}
                          </td>
                          <td className="py-2 px-3 text-center text-gray-500 border-r border-gray-100 whitespace-nowrap">
                            {period.start_time?.slice(0,5)}–{period.end_time?.slice(0,5)}
                          </td>
                          {DAYS.map((d,di) => {
                            if (!showDays.includes(di+1)) return null;
                            if (period.is_break) return (
                              <td key={di} className="py-2 px-2 border-r border-gray-100 border-b border-gray-50 bg-amber-50/30 text-center text-gray-300 text-[10px]">—</td>
                            );
                            const slot = getSlot(period.id, di+1);
                            const sub  = slot ? subjects.find(s => s.id===slot.subject_id) : null;
                            const col  = sub ? subjectColorMap[sub.id] : null;
                            const isDropTarget = dropTarget?.periodId===period.id && dropTarget?.day===di+1;
                            const displayName = sub ? (sub.code || sub.name?.slice(0,6)||'').toUpperCase() : '';
                            const teacherName = slot?.teacher?.full_name || '';
                            return (
                              <td key={di}
                                onDragOver={canEdit ? e => handleDragOver(e, period.id, di+1) : undefined}
                                onDragLeave={canEdit ? handleDragLeave : undefined}
                                onDrop={canEdit ? e => handleDrop(e, period, di+1) : undefined}
                                className={`py-1.5 px-2 border-r border-gray-100 border-b border-gray-50 align-top transition-colors
                                  ${isDropTarget ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''}`}>
                                {slot && sub ? (
                                  <div
                                    onClick={() => canEdit && setSlotModal({ periodId:period.id, dayOfWeek:di+1, slot })}
                                    className={`rounded-xl border px-2 py-1.5 text-[11px] cursor-pointer hover:opacity-80 transition-opacity
                                      ${col.bg} ${col.text} ${col.border}`}>
                                    <p className="font-bold leading-tight">{displayName}</p>
                                    {teacherName && <p className="opacity-60 mt-0.5 text-[10px] truncate">{teacherName.split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase()}</p>}
                                    {slot.room && <p className="opacity-50 mt-0.5 text-[9px] truncate">{slot.room.name}</p>}
                                  </div>
                                ) : isDropTarget ? (
                                  <div className="w-full h-10 rounded-xl flex items-center justify-center text-blue-400 text-[10px] font-bold">
                                    Drop here
                                  </div>
                                ) : canEdit ? (
                                  <button
                                    onClick={() => setSlotModal({ periodId:period.id, dayOfWeek:di+1, slot:null })}
                                    className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-blue-300 hover:text-blue-400 transition-colors flex items-center justify-center">
                                    <Plus className="w-3.5 h-3.5"/>
                                  </button>
                                ) : null}
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
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${p.is_break ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{p.period_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.start_time?.slice(0,5)} – {p.end_time?.slice(0,5)}{p.is_break && <span className="ml-2 text-amber-600 font-semibold">Break</span>}</p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPeriodModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={async () => { if(window.confirm('Delete period?')){ await deleteTtPeriod(p.id); getTtPeriods({academic_year_id:selYear}).then(r=>setPeriods(r.data.data||[])); }}} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
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
              <div className="py-14 text-center"><MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3"/><p className="font-semibold text-gray-500 text-sm">No rooms yet</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {rooms.map(r => (
                  <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 group hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="font-bold text-gray-900 text-sm">{r.name}</p><p className="text-xs text-gray-400 mt-0.5 capitalize">{r.room_type} · cap. {r.capacity}</p></div>
                      {canEdit && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => setRoomModal(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={async () => { if(window.confirm('Delete room?')){ await deleteTtRoom(r.id); getTtRooms().then(r=>setRooms(r.data.data||[])); }}} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
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
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#0a2156] to-[#1e3a8a] rounded-2xl p-5 text-white">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Zap className="w-6 h-6 text-yellow-300"/></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-base">Auto-Generate Timetable</h3>
                  <p className="text-blue-200 text-xs mt-0.5">Builds all class timetables based on teacher–subject assignments and configured periods.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-2">Days per Week</label>
                  <div className="relative">
                    <select value={autoGenDays} onChange={e=>setAutoGenDays(e.target.value)} className="w-full appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-3.5 py-2.5 pr-9 text-sm font-medium focus:outline-none">
                      {[5,6].map(d=><option key={d} value={d} className="text-gray-900">{d} days (Mon–{d===5?'Fri':'Sat'})</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none"/>
                  </div>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-3 cursor-pointer w-full">
                    <div onClick={() => setAutoGenOverwrite(v=>!v)} className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${autoGenOverwrite?'bg-red-400':'bg-white/20'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoGenOverwrite?'translate-x-5':'translate-x-0.5'}`}/>
                    </div>
                    <div><p className="text-sm font-semibold text-white">Overwrite existing</p><p className="text-[10px] text-blue-300">{autoGenOverwrite?'Clears current first':'Skips filled slots'}</p></div>
                  </label>
                </div>
                <div className="flex items-end">
                  <button onClick={handleAutoGenerate} disabled={autoGenLoading||!selYear||!periods.length}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-[#0a2156] text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
                    {autoGenLoading?<span className="w-4 h-4 border-2 border-[#0a2156] border-t-transparent rounded-full animate-spin"/>:<Zap className="w-4 h-4"/>}
                    {autoGenLoading?'Generating…':'Generate Now'}
                  </button>
                </div>
              </div>
              {autoGenResult && (
                <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${autoGenResult.inserted>0?'bg-emerald-400/20 text-emerald-200':'bg-red-400/20 text-red-200'}`}>
                  ✅ {autoGenResult.message}{autoGenResult.conflicts>0&&<span className="ml-2 text-amber-300">⚠ {autoGenResult.conflicts} conflicts skipped</span>}
                </div>
              )}
              {!periods.length && <p className="mt-3 text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> No periods configured — <button onClick={()=>setTab('periods')} className="underline font-semibold">go to Time Periods tab first</button>.</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Class */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Grid3X3 className="w-5 h-5 text-blue-600"/></div>
                  <div><p className="font-bold text-gray-900 text-sm">Class Timetable</p><p className="text-xs text-gray-400">Full week for one class</p></div>
                </div>
                <div className="p-5 flex flex-col gap-4 flex-1">
                  <p className="text-xs text-gray-500">Class: {selCls?<span className="font-bold text-blue-600 ml-1">{selCls.name}</span>:<span className="text-amber-600 ml-1">None selected</span>}</p>
                  <button onClick={handleExportClass} disabled={!!dlState||!selClass||!selYear}
                    className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 transition-colors w-full">
                    {dlState==='class'?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Download className="w-4 h-4"/>} Download .xlsx
                  </button>
                </div>
              </div>
              {/* Teacher */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-violet-600"/></div>
                  <div><p className="font-bold text-gray-900 text-sm">Teacher Timetable</p><p className="text-xs text-gray-400">All classes for one teacher</p></div>
                </div>
                <div className="p-5 flex flex-col gap-4 flex-1">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Teacher</label>
                    <div className="relative">
                      <select value={genTeacher} onChange={e=>setGenTeacher(e.target.value)} className={SEL}>
                        <option value="">— Select —</option>
                        {staff.filter(s=>s.role==='teacher'||s.role==='dos').map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                    </div>
                  </div>
                  <button onClick={handleExportTeacher} disabled={!!dlState||!genTeacher||!selYear}
                    className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50 transition-colors w-full">
                    {dlState==='teacher'?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Download className="w-4 h-4"/>} Download .xlsx
                  </button>
                </div>
              </div>
              {/* School */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-5 h-5 text-emerald-600"/></div>
                  <div><p className="font-bold text-gray-900 text-sm">Full School</p><p className="text-xs text-gray-400">One sheet per class</p></div>
                </div>
                <div className="p-5 flex flex-col gap-4 flex-1">
                  <p className="text-xs text-gray-500">All classes in {selYear?<span className="font-bold text-emerald-600 ml-1">{years.find(y=>y.id===selYear)?.name}</span>:<span className="text-amber-600 ml-1">no year</span>}{selTerm&&<span className="text-gray-400"> · {selTrmObj?.name}</span>}</p>
                  <button onClick={handleExportSchool} disabled={!!dlState||!selYear}
                    className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition-colors w-full">
                    {dlState==='school'?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Download className="w-4 h-4"/>} Download .xlsx
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: WORKLOAD
        ══════════════════════════════════════════════════ */}
        {tab === 'workload' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50"><p className="font-bold text-gray-900 text-sm">Teacher Workload</p><p className="text-xs text-gray-400 mt-0.5">Periods per teacher per week</p></div>
            {workload.length === 0 ? (
              <div className="py-14 text-center text-gray-400"><BarChart2 className="w-10 h-10 mx-auto mb-3 text-gray-200"/><p className="text-sm font-semibold text-gray-500">No timetable data yet</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {workload.map((t,i) => (
                  <div key={t.id||i} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0a2156]/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-[#0a2156]"/></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{t.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{Object.entries(t.periods_per_day||{}).map(([d,n])=>`${d}: ${n}`).join(' · ')}</p>
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
              <p className="font-bold text-gray-900 text-sm">{conflicts.length===0 ? '✅ No conflicts found' : `⚠️ ${conflicts.length} conflict${conflicts.length>1?'s':''} detected`}</p>
            </div>
            {conflicts.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="w-7 h-7 text-emerald-600"/></div>
                <p className="font-semibold text-gray-700">Timetable is conflict-free</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {conflicts.map((c,i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle className="w-4 h-4 text-red-600"/></div>
                    <div>
                      <p className="font-semibold text-red-800 text-sm capitalize">{c.type} conflict</p>
                      <p className="text-xs text-red-600 mt-0.5">{c.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{c.slots?.map(s=>`${s.class?.name} (${DAYS[(s.day_of_week||1)-1]})`).join(' vs ')}</p>
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
          subjectColorMap={subjectColorMap}
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

      {/* ── AI Chat Panel ─────────────────────────────────── */}
      {showAI && (
        <AIPanel onClose={() => setShowAI(false)} selYear={selYear} selTerm={selTerm} selClass={selClass}/>
      )}

      {/* ── Floating AI button (when panel closed) ────────── */}
      {!showAI && canEdit && (
        <button onClick={() => setShowAI(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0a2156, #1e3a8a)', boxShadow: '0 8px 32px rgba(10,33,86,0.35)' }}>
          <Sparkles className="w-4 h-4 text-yellow-300"/>
          Ask AI
        </button>
      )}
    </div>
  );
}
