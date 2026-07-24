import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Calendar, Plus, Trash2, Edit2, X, Check, ChevronDown,
  Clock, MapPin, AlertTriangle, RefreshCw, BarChart2,
  Grid3X3, User, Download, FileSpreadsheet, Zap, Send,
  Sparkles, GripVertical, Info, CheckCircle2, AlertCircle,
  MoreVertical, Move, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAcademicYears, getTerms, getSmsClasses, getSmsSubjects, getStaff,
  getTtRooms, createTtRoom, updateTtRoom, deleteTtRoom,
  getTtPeriods, createTtPeriod, updateTtPeriod, deleteTtPeriod,
  getTtSlots, upsertTtSlot, deleteTtSlot,
  getTtWorkload, getTtConflicts,
  exportClassTimetable, exportTeacherTimetable, exportSchoolTimetable,
  autoGenerateTimetable, aiTimetableChat, aiCheckSlot,
} from '../../api';

/* ── Constants ───────────────────────────────────────────────── */
const DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_S    = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const COLORS   = [
  { bg:'bg-blue-100',    text:'text-blue-800',    border:'border-blue-200',    hex:'#1d4ed8', chip:'bg-blue-500'    },
  { bg:'bg-emerald-100', text:'text-emerald-800', border:'border-emerald-200', hex:'#059669', chip:'bg-emerald-500' },
  { bg:'bg-violet-100',  text:'text-violet-800',  border:'border-violet-200',  hex:'#7c3aed', chip:'bg-violet-500'  },
  { bg:'bg-amber-100',   text:'text-amber-800',   border:'border-amber-200',   hex:'#d97706', chip:'bg-amber-500'   },
  { bg:'bg-rose-100',    text:'text-rose-800',    border:'border-rose-200',    hex:'#e11d48', chip:'bg-rose-500'    },
  { bg:'bg-sky-100',     text:'text-sky-800',     border:'border-sky-200',     hex:'#0284c7', chip:'bg-sky-500'     },
  { bg:'bg-orange-100',  text:'text-orange-800',  border:'border-orange-200',  hex:'#ea580c', chip:'bg-orange-500'  },
  { bg:'bg-teal-100',    text:'text-teal-800',    border:'border-teal-200',    hex:'#0d9488', chip:'bg-teal-500'    },
  { bg:'bg-pink-100',    text:'text-pink-800',    border:'border-pink-200',    hex:'#db2777', chip:'bg-pink-500'    },
  { bg:'bg-lime-100',    text:'text-lime-800',    border:'border-lime-200',    hex:'#65a30d', chip:'bg-lime-500'    },
];
const SEL = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all shadow-sm';
const INP = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all';

function getRole(){ try{ return JSON.parse(localStorage.getItem('staff_data')||'{}').role||'dos'; }catch{ return 'dos'; } }

/* ── Small Modal wrapper ─────────────────────────────────────── */
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide?'max-w-xl':'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Room / Period / Slot modals (compact) ───────────────────── */
function RoomModal({ room, onSave, onClose }) {
  const [form,setForm]=useState({name:room?.name||'',capacity:room?.capacity||40,room_type:room?.room_type||'classroom'});
  const [busy,setBusy]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const save=async()=>{if(!form.name.trim()){toast.error('Name required');return;}setBusy(true);try{room?.id?await updateTtRoom(room.id,form):await createTtRoom(form);toast.success('Saved!');onSave();}catch(e){toast.error(e.response?.data?.error||'Error');}finally{setBusy(false);}};
  return(
    <Modal title={room?.id?'Edit Room':'New Room'} onClose={onClose}>
      <div className="p-5 space-y-3">
        <div><label className="lbl">Room Name *</label><input className={INP} value={form.name} onChange={f('name')} autoFocus/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="lbl">Capacity</label><input type="number" className={INP} value={form.capacity} onChange={f('capacity')}/></div>
          <div><label className="lbl">Type</label><div className="relative"><select className={SEL} value={form.room_type} onChange={f('room_type')}>{['classroom','lab','hall','library'].map(t=><option key={t} value={t}>{t}</option>)}</select><ChevronDown className="abs-ch"/></div></div>
        </div>
      </div>
      <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center">{busy?'Saving…':'Save'}</button>
      </div>
    </Modal>
  );
}

function PeriodModal({ period, yearId, termId, onSave, onClose }) {
  const [form,setForm]=useState({name:period?.name||'',period_number:period?.period_number||1,start_time:period?.start_time||'07:00',end_time:period?.end_time||'07:45',is_break:period?.is_break||false,academic_year_id:yearId||'',term_id:termId||''});
  const [busy,setBusy]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const save=async()=>{if(!form.name.trim()){toast.error('Name required');return;}setBusy(true);try{period?.id?await updateTtPeriod(period.id,form):await createTtPeriod(form);toast.success('Saved!');onSave();}catch(e){toast.error(e.response?.data?.error||'Error');}finally{setBusy(false);}};
  return(
    <Modal title={period?.id?'Edit Period':'New Period'} onClose={onClose}>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="lbl">Name *</label><input className={INP} value={form.name} onChange={f('name')} autoFocus/></div>
          <div><label className="lbl">Order #</label><input type="number" className={INP} value={form.period_number} onChange={f('period_number')}/></div>
          <div><label className="lbl">Start</label><input type="time" className={INP} value={form.start_time} onChange={f('start_time')}/></div>
          <div><label className="lbl">End</label><input type="time" className={INP} value={form.end_time} onChange={f('end_time')}/></div>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer pt-1">
          <div onClick={()=>setForm(p=>({...p,is_break:!p.is_break}))} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${form.is_break?'bg-amber-500':'bg-gray-200'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_break?'translate-x-4':'translate-x-0.5'}`}/></div>
          <span className="text-sm font-medium text-gray-700">Break / Lunch period</span>
        </label>
      </div>
      <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center">{busy?'Saving…':'Save'}</button>
      </div>
    </Modal>
  );
}

/* ── Slot edit modal with live conflict check ────────────────── */
function SlotModal({ slot, classId, periodId, dayOfWeek, termId, yearId, subjects, staff, rooms, colorMap, onSave, onClose }) {
  const [form,setForm]=useState({subject_id:slot?.subject_id||'',teacher_id:slot?.teacher_id||'',room_id:slot?.room_id||''});
  const [busy,setBusy]=useState(false);
  const [warns,setWarns]=useState([]);
  const [checking,setChecking]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  useEffect(()=>{
    if(!form.teacher_id&&!form.subject_id){setWarns([]);return;}
    setChecking(true);
    aiCheckSlot({teacher_id:form.teacher_id||null,period_id:periodId,day_of_week:dayOfWeek,class_id:classId,subject_id:form.subject_id||null,academic_year_id:yearId})
      .then(r=>setWarns(r.data.warnings||[])).catch(()=>{}).finally(()=>setChecking(false));
  },[form.teacher_id,form.subject_id]);

  const save=async()=>{
    if(warns.filter(w=>w.severity==='error').length>0){toast.error('Fix conflicts first');return;}
    setBusy(true);
    try{
      await upsertTtSlot({class_id:classId,period_id:periodId,day_of_week:dayOfWeek,subject_id:form.subject_id||null,teacher_id:form.teacher_id||null,room_id:form.room_id||null,term_id:termId||null,academic_year_id:yearId||null});
      toast.success('Slot saved!');onSave();
    }catch(e){toast.error(e.response?.data?.error||'Error');}finally{setBusy(false);}
  };
  const del=async()=>{if(!slot?.id)return;await deleteTtSlot(slot.id);toast.success('Cleared');onSave();};

  const selSub=subjects.find(s=>s.id===form.subject_id);
  const col=selSub?colorMap[selSub.id]:null;

  return(
    <Modal title={`${DAYS[(dayOfWeek||1)-1]} — ${slot?.period?.name||'Period'}`} onClose={onClose}>
      {selSub&&col&&(
        <div className={`mx-5 mt-4 rounded-xl px-4 py-2 border ${col.bg} ${col.text} ${col.border} flex items-center gap-2`}>
          <div className={`w-2 h-2 rounded-full ${col.chip}`}/>
          <span className="font-bold text-sm">{(selSub.code||selSub.name||'').toUpperCase()}</span>
          <span className="opacity-50 text-xs ml-auto">{selSub.name}</span>
        </div>
      )}
      <div className="p-5 space-y-3">
        <div><label className="lbl">Subject</label><div className="relative"><select className={SEL} value={form.subject_id} onChange={f('subject_id')}><option value="">— None —</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown className="abs-ch"/></div></div>
        <div><label className="lbl">Teacher</label><div className="relative"><select className={SEL} value={form.teacher_id} onChange={f('teacher_id')}><option value="">— None —</option>{staff.filter(s=>s.role==='teacher'||s.role==='dos').map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select><ChevronDown className="abs-ch"/></div></div>
        <div><label className="lbl">Room</label><div className="relative"><select className={SEL} value={form.room_id} onChange={f('room_id')}><option value="">— None —</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><ChevronDown className="abs-ch"/></div></div>
        {checking&&<p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin inline-block"/>Checking…</p>}
        {warns.map((w,i)=>(
          <div key={i} className={`flex items-start gap-2 rounded-xl px-3.5 py-2 text-xs font-medium ${w.severity==='error'?'bg-red-50 border border-red-100 text-red-700':'bg-amber-50 border border-amber-100 text-amber-700'}`}>
            {w.severity==='error'?<AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>:<Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>}{w.message}
          </div>
        ))}
        {!checking&&form.teacher_id&&warns.filter(w=>w.severity==='error').length===0&&<p className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5"/>No conflicts</p>}
      </div>
      <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
        {slot?.id&&<button onClick={del} className="px-3.5 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4"/></button>}
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={save} disabled={busy||warns.filter(w=>w.severity==='error').length>0} className="btn-primary flex-1 justify-center disabled:opacity-50">{busy?'Saving…':'Save'}</button>
      </div>
    </Modal>
  );
}

/* ── Simple markdown renderer for AI messages ─────────────── */
function renderMarkdown(text) {
  if (!text) return null;
  // Split into lines for block-level handling
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2"/>);
      i++; continue;
    }

    // Bullet point: lines starting with - or •
    if (/^[-•]\s/.test(line.trim())) {
      const bullets = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) {
        bullets.push(<li key={i} className="ml-3 list-disc">{inlineFormat(lines[i].replace(/^[-•]\s/,''))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="space-y-0.5 my-1">{bullets}</ul>);
      continue;
    }

    // Numbered list: 1. 2. etc
    if (/^\d+\.\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(<li key={i} className="ml-3 list-decimal">{inlineFormat(lines[i].replace(/^\d+\.\s/,''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="space-y-0.5 my-1">{items}</ol>);
      continue;
    }

    // Normal paragraph line
    elements.push(<p key={i} className="leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }
  return elements;
}

function inlineFormat(text) {
  // Split by **bold**, *italic*, `code`
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    if (m[2] != null) parts.push(<strong key={key++} className="font-bold text-current">{m[2]}</strong>);
    else if (m[3] != null) parts.push(<em key={key++} className="italic">{m[3]}</em>);
    else if (m[4] != null) parts.push(<code key={key++} className="bg-black/10 rounded px-1 font-mono text-[10px]">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : text;
}
function AISmartPanel({ onClose, selYear, selTerm, selClass, dragging, slots, subjects, staff, workload, conflicts, colorMap }) {
  const [messages,setMessages]=useState([{role:'assistant',content:"Muraho! 👋 I'm your Smart Timetable Assistant. I can analyze your schedule, detect conflicts, and suggest improvements. Ask me anything!"}]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [posCheck,setPosCheck]=useState(null);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  // Auto-check position when drag is active
  useEffect(()=>{
    if(!dragging?.subject_id||!dragging?.periodId||!dragging?.day) return;
    aiCheckSlot({teacher_id:dragging.teacher_id||null,period_id:dragging.periodId,day_of_week:dragging.day,class_id:selClass,subject_id:dragging.subject_id,academic_year_id:selYear})
      .then(r=>{
        const warns=r.data.warnings||[];
        setPosCheck({warnings:warns,ok:warns.filter(w=>w.severity==='error').length===0});
      }).catch(()=>{});
  },[dragging?.periodId,dragging?.day]);

  // Timetable health stats
  const totalSlots=slots.length;
  const conflictCount=conflicts.length;
  const maxLoad=workload.length>0?Math.max(...workload.map(t=>t.total_periods)):0;
  const workloadStatus=maxLoad<=18?'Good':maxLoad<=24?'Fair':'Heavy';
  const workloadColor=maxLoad<=18?'text-emerald-600 bg-emerald-50':maxLoad<=24?'text-amber-600 bg-amber-50':'text-red-600 bg-red-50';

  // Day load check
  const dayLoad={};
  slots.forEach(s=>{ const d=DAYS[(s.day_of_week||1)-1]; dayLoad[d]=(dayLoad[d]||0)+1; });
  const maxDayLoad=Object.values(dayLoad).length>0?Math.max(...Object.values(dayLoad)):0;
  const heavyDay=Object.entries(dayLoad).find(([,v])=>v===maxDayLoad)?.[0]||'';

  const SUGGESTIONS=['Are there any teacher conflicts?','Which teacher has the most periods?','Suggest timetable improvements','Is workload balanced across days?'];

  const send=async(text)=>{
    const msg=(text||input).trim();if(!msg||busy)return;
    setInput('');
    setMessages(p=>[...p,{role:'user',content:msg}]);
    setBusy(true);
    try{
      const history=messages.slice(1).map(m=>({role:m.role,content:m.content}));
      const r=await aiTimetableChat({message:msg,history,academic_year_id:selYear,term_id:selTerm});
      setMessages(p=>[...p,{role:'assistant',content:r.data.reply}]);
    }catch(e){
      const errMsg = e.response?.data?.error || e.message;
      const isKeyError = errMsg?.toLowerCase().includes('mistral') || errMsg?.toLowerCase().includes('api key');
      setMessages(p=>[...p,{
        role:'assistant',
        content: isKeyError
          ? `⚠️ AI not configured: ${errMsg}\n\nTo fix: Go to Render dashboard → your backend service → Environment tab → add MISTRAL_API_KEY.`
          : `Sorry, I couldn't connect: ${errMsg}`
      }]);
    }finally{setBusy(false);}
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#0a2156] to-[#1a3570] shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-yellow-300"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-none">Smart Timetable Assistant</p>
          <p className="text-blue-300 text-[10px] mt-0.5">Powered by Mistral AI</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0">
          <X className="w-4 h-4"/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Current drag action ── */}
        {dragging?.subject_id && (
          <div className="mx-3 mt-3 rounded-xl border border-blue-100 bg-blue-50 overflow-hidden shrink-0">
            <div className="flex items-center justify-between px-3 py-2 bg-blue-100">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Current Action</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">Moving</span>
            </div>
            <div className="px-3 py-2 space-y-1 text-xs">
              {[
                ['Subject',  subjects.find(s=>s.id===dragging.subject_id)?.name||'?'],
                ['Teacher',  staff.find(s=>s.id===dragging.teacher_id)?.full_name||'—'],
                ['Duration', '1 Period'],
                ['To',       dragging.day&&dragging.periodId ? `${DAYS[(dragging.day||1)-1]} (drop target)` : 'Dragging…'],
              ].map(([k,v])=>(
                <div key={k} className="flex items-center justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className={`font-semibold ${k==='To'?'text-blue-600':k==='Subject'?'text-blue-800':'text-gray-800'}`}>{v}</span>
                </div>
              ))}
            </div>
            {/* Position evaluation */}
            {posCheck && (
              <div className="border-t border-blue-100 px-3 py-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Position Evaluation</p>
                {posCheck.warnings.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5"/> This position looks good!
                  </div>
                ) : posCheck.warnings.map((w,i) => (
                  <div key={i} className={`flex items-start gap-1.5 text-xs mb-1 ${w.severity==='error'?'text-red-600':'text-amber-600'}`}>
                    {w.severity==='error'?<AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>:<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>}
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Timetable Health ── */}
        <div className="mx-3 mt-3 rounded-xl border border-gray-100 overflow-hidden shrink-0">
          <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Timetable Health</p>
          {[
            { label:'Conflicts',        value: conflictCount===0?'None':conflictCount, status: conflictCount===0?'text-emerald-600 bg-emerald-50':'text-red-600 bg-red-50', dot: conflictCount===0?'bg-emerald-500':'bg-red-500' },
            { label:'Teacher Workload', value: workloadStatus, status: workloadColor, dot: maxLoad<=18?'bg-emerald-500':maxLoad<=24?'bg-amber-500':'bg-red-500' },
            { label:'Slots Filled',     value: `${totalSlots}`, status: 'text-blue-600 bg-blue-50', dot: 'bg-blue-500' },
            { label:'Heavy Day',        value: heavyDay||'Balanced', status: heavyDay?'text-orange-600 bg-orange-50':'text-emerald-600 bg-emerald-50', dot: heavyDay?'bg-orange-500':'bg-emerald-500' },
          ].map(row=>(
            <div key={row.label} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-600">{row.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${row.dot}`}/>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.status}`}>{row.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Chat messages ── */}
        <div className="px-3 pt-3 space-y-2.5">
          {messages.map((m,i)=>(
            <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
              {m.role==='assistant'&&(
                <div className="w-6 h-6 rounded-lg bg-[#0a2156] flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                  <Sparkles className="w-3 h-3 text-yellow-300"/>
                </div>
              )}
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed
                ${m.role==='user'?'bg-[#0a2156] text-white rounded-br-sm':'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                {m.role === 'assistant' ? (
                  <div className="space-y-0.5">{renderMarkdown(m.content)}</div>
                ) : m.content}
              </div>
            </div>
          ))}
          {busy&&(
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-lg bg-[#0a2156] flex items-center justify-center shrink-0 mr-1.5"><Sparkles className="w-3 h-3 text-yellow-300"/></div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
                <div className="flex gap-1">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Quick suggestions */}
        {messages.length<=1&&(
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s,i)=>(
              <button key={i} onClick={()=>send(s)} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">{s}</button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white shrink-0">
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="Ask about your timetable…"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-400 transition-all"/>
        <button onClick={()=>send()} disabled={!input.trim()||busy}
          className="w-8 h-8 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white flex items-center justify-center transition-colors disabled:opacity-40 shrink-0">
          <Send className="w-3.5 h-3.5"/>
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-2.5 shrink-0">
        <span className="text-[9px] text-gray-300 font-medium">Powered by Mistral AI</span>
      </div>
    </div>
  );
}

/* ── MAIN TIMETABLE PAGE ─────────────────────────────────────── */
export default function Timetable() {
  const role=getRole();
  const canEdit=['admin','dos'].includes(role);

  // Data
  const [years,setYears]=useState([]);const [terms,setTerms]=useState([]);const [classes,setClasses]=useState([]);
  const [subjects,setSubjects]=useState([]);const [staff,setStaff]=useState([]);const [rooms,setRooms]=useState([]);
  const [periods,setPeriods]=useState([]);const [slots,setSlots]=useState([]);
  const [workload,setWorkload]=useState([]);const [conflicts,setConflicts]=useState([]);
  const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);
  const [dlState,setDlState]=useState('');
  const [autoGenLoading,setAutoGenLoading]=useState(false);const [autoGenResult,setAutoGenResult]=useState(null);
  const [autoGenDays,setAutoGenDays]=useState(5);const [autoGenOverwrite,setAutoGenOverwrite]=useState(false);

  // Filters
  const [selYear,setSelYear]=useState('');const [selTerm,setSelTerm]=useState('');const [selClass,setSelClass]=useState('');
  // UI
  const [tab,setTab]=useState('timetable');
  const [slotModal,setSlotModal]=useState(null);const [roomModal,setRoomModal]=useState(null);const [periodModal,setPeriodModal]=useState(null);
  const [showDays,setShowDays]=useState([1,2,3,4,5]);
  const [showAI,setShowAI]=useState(false);
  const [genTeacher,setGenTeacher]=useState('');
  // Drag state — includes current hover target for AI panel preview
  const [dragging,setDragging]=useState(null); // {subject_id, teacher_id, room_id, periodId?, day?}
  const [dropTarget,setDropTarget]=useState(null); // {periodId, day}
  // Pending changes (for Save Timetable button)
  const [pendingSaves,setPendingSaves]=useState([]); // [{class_id,period_id,day_of_week,subject_id,teacher_id,room_id}]

  const colorMap=useMemo(()=>{const m={};subjects.forEach((s,i)=>{m[s.id]=COLORS[i%COLORS.length];});return m;},[subjects]);

  // ── Boot ──────────────────────────────────────────────────────
  useEffect(()=>{
    Promise.all([getAcademicYears(),getTerms(),getSmsClasses(),getStaff(),getTtRooms()])
      .then(([y,t,c,s,r])=>{
        const yrs=y.data.data||[];setYears(yrs);setTerms((t.data.data||[]).filter(x=>x.number!==4));
        setClasses(c.data.data||[]);setStaff(s.data.data||[]);setRooms(r.data.data||[]);
        const cur=yrs.find(yr=>yr.is_current);if(cur)setSelYear(cur.id);
      }).catch(()=>toast.error('Failed to load'));
  },[]);

  useEffect(()=>{
    if(!selYear)return;
    getTtPeriods({academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})}).then(r=>setPeriods(r.data.data||[]));
  },[selYear,selTerm]);

  useEffect(()=>{
    if(!selClass){setSubjects([]);return;}
    getSmsSubjects({class_id:selClass}).then(r=>setSubjects(r.data.data||[]));
  },[selClass]);

  const loadSlots=useCallback(()=>{
    if(!selClass||!selYear)return;
    setLoading(true);
    const p={class_id:selClass,academic_year_id:selYear};if(selTerm)p.term_id=selTerm;
    getTtSlots(p).then(r=>setSlots(r.data.data||[])).catch(()=>toast.error('Failed to load')).finally(()=>setLoading(false));
  },[selClass,selTerm,selYear]);
  useEffect(()=>{loadSlots();},[selClass,selTerm,selYear]);

  const loadReports=()=>{
    if(!selYear)return;
    const p={academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})};
    getTtWorkload(p).then(r=>setWorkload(r.data.data||[])).catch(()=>{});
    getTtConflicts(p).then(r=>setConflicts(r.data.data||[])).catch(()=>{});
  };
  useEffect(()=>{if(tab==='workload'||tab==='conflicts')loadReports();},[tab,selYear,selTerm]);
  // Also load reports when AI panel open
  useEffect(()=>{if(showAI&&selYear)loadReports();},[showAI]);

  const getSlot=(periodId,day)=>slots.find(s=>s.period_id===periodId&&s.day_of_week===day);

  // ── Drag handlers ─────────────────────────────────────────────
  const handleDragStart=(e,subject,teacher_id,room_id)=>{
    const data={subject_id:subject.id,teacher_id:teacher_id||'',room_id:room_id||''};
    e.dataTransfer.setData('application/json',JSON.stringify(data));
    e.dataTransfer.effectAllowed='copy';
    setDragging(data);
  };
  const handleDragEnd=()=>{setDragging(null);setDropTarget(null);};
  const handleDragOver=(e,periodId,day)=>{e.preventDefault();e.dataTransfer.dropEffect='copy';setDropTarget({periodId,day});setDragging(p=>p?{...p,periodId,day}:p);};
  const handleDragLeave=()=>{setDropTarget(null);setDragging(p=>p?{...p,periodId:null,day:null}:p);};
  const handleDrop=async(e,period,day)=>{
    e.preventDefault();setDropTarget(null);
    try{
      const data=JSON.parse(e.dataTransfer.getData('application/json'));
      if(!data.subject_id)return;
      const check=await aiCheckSlot({teacher_id:data.teacher_id||null,period_id:period.id,day_of_week:day,class_id:selClass,subject_id:data.subject_id,academic_year_id:selYear});
      const errors=(check.data.warnings||[]).filter(w=>w.severity==='error');
      if(errors.length>0){toast.error(`⚠ ${errors[0].message}`,{duration:4000});return;}
      await upsertTtSlot({class_id:selClass,period_id:period.id,day_of_week:day,subject_id:data.subject_id,teacher_id:data.teacher_id||null,room_id:data.room_id||null,term_id:selTerm||null,academic_year_id:selYear||null});
      const warns=(check.data.warnings||[]).filter(w=>w.severity==='warning');
      if(warns.length>0)toast(`⚠ ${warns[0].message}`,{icon:'⚠️',duration:3000});
      else toast.success('Slot placed!');
      loadSlots();
    }catch(err){toast.error(err.response?.data?.error||'Drop failed');}
    finally{setDragging(null);}
  };

  // ── Auto generate & exports ───────────────────────────────────
  const handleAutoGenerate=async()=>{
    if(!selYear){toast.error('Select year');return;}if(!periods.length){toast.error('Create periods first');return;}
    setAutoGenLoading(true);setAutoGenResult(null);
    try{
      const r=await autoGenerateTimetable({academic_year_id:selYear,term_id:selTerm||null,days_per_week:parseInt(autoGenDays),overwrite:autoGenOverwrite});
      setAutoGenResult(r.data);toast.success(r.data.message||'Generated!');loadSlots();
    }catch(e){toast.error(e.response?.data?.error||'Failed');}finally{setAutoGenLoading(false);}
  };
  const dlFile=async(fn,params,name)=>{
    try{const r=await fn(params);const url=URL.createObjectURL(new Blob([r.data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();URL.revokeObjectURL(url);document.body.removeChild(a);toast.success('Downloaded!');}catch(e){toast.error('Failed');}
  };

  const allPeriods=periods.sort((a,b)=>a.period_number-b.period_number);
  const selCls=classes.find(c=>c.id===selClass);const selTrmObj=terms.find(t=>t.id===selTerm);

  const TABS=[
    {key:'timetable',label:'Timetable Grid',icon:Grid3X3},
    {key:'periods',  label:'Time Periods',  icon:Clock},
    {key:'rooms',    label:'Rooms',         icon:MapPin},
    {key:'generate', label:'Generate / Export',icon:FileSpreadsheet},
    {key:'workload', label:'Teacher Workload',icon:BarChart2},
    {key:'conflicts',label:'Conflicts',     icon:AlertTriangle},
  ];

  // Subject legend (unique subjects in current slots)
  const legendSubjects=useMemo(()=>{
    const seen=new Set();return subjects.filter(s=>{if(seen.has(s.id))return false;seen.add(s.id);return true;}).slice(0,8);
  },[subjects]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top header bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm">
            <Calendar className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Timetable</h1>
            <p className="text-gray-400 text-[11px]">Manage class schedules, teacher allocations &amp; rooms</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowAI(p=>!p)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all
                ${showAI?'bg-[#0a2156] text-white border-[#0a2156] shadow-sm':'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              <Sparkles className={`w-3.5 h-3.5 ${showAI?'text-yellow-300':'text-violet-500'}`}/>
              AI Assistant
            </button>
            <button onClick={handleAutoGenerate} disabled={autoGenLoading||!selYear||!periods.length}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:border-gray-300 disabled:opacity-50 transition-all">
              {autoGenLoading?<span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>:<Zap className="w-3.5 h-3.5 text-amber-500"/>}
              Auto Generate
            </button>
            <button onClick={()=>{if(selClass&&selYear){setDlState('class');dlFile(exportClassTimetable,{class_id:selClass,academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},`${selCls?.name||'class'}_timetable.xlsx`).then(()=>setDlState(''));} else toast.error('Select class and year');}}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-xs font-bold shadow-sm transition-colors">
              <Save className="w-3.5 h-3.5"/>
              Save Timetable
            </button>
          </div>
        )}
      </div>

      {/* ── Body (grid + AI panel) ──────────────────────────── */}
      <div className="flex h-[calc(100vh-57px)] overflow-hidden">

        {/* ── Left: main content ──────────────────────────── */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${showAI?'mr-0':''}`}>

          {/* Filters */}
          <div className="flex items-end gap-3 px-5 py-3 bg-white border-b border-gray-100 flex-wrap shrink-0">
            <div className="flex-1 min-w-36">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Academic Year</label>
              <div className="relative"><select value={selYear} onChange={e=>{setSelYear(e.target.value);setSelTerm('');setSelClass('');}} className={SEL}>
                <option value="">— Select Year —</option>
                {years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
              </select><ChevronDown className="abs-ch"/></div>
            </div>
            <div className="flex-1 min-w-32">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Term</label>
              <div className="relative"><select value={selTerm} onChange={e=>setSelTerm(e.target.value)} className={SEL}>
                <option value="">— All Terms —</option>
                {terms.filter(t=>!selYear||t.academic_year_id===selYear).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select><ChevronDown className="abs-ch"/></div>
            </div>
            <div className="flex-1 min-w-32">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Class</label>
              <div className="relative"><select value={selClass} onChange={e=>setSelClass(e.target.value)} className={SEL}>
                <option value="">— Select Class —</option>
                {classes.filter(c=>!selYear||!c.academic_year_id||c.academic_year_id===selYear).map(c=><option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
              </select><ChevronDown className="abs-ch"/></div>
            </div>
            <button onClick={loadSlots} disabled={loading} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors self-end">
              <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 bg-white border-b border-gray-100 px-4 overflow-x-auto shrink-0">
            {TABS.map(t=>{const Icon=t.icon;return(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all
                  ${tab===t.key?'border-[#0a2156] text-[#0a2156]':'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}>
                <Icon className="w-3.5 h-3.5"/>{t.label}
                {t.key==='conflicts'&&conflicts.length>0&&<span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{conflicts.length}</span>}
              </button>
            );})}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {/* ════ TIMETABLE GRID ════ */}
            {tab==='timetable' && (
              <div className="flex gap-3 h-full">

                {/* Subject drag panel */}
                {canEdit && selClass && subjects.length > 0 && (
                  <div className="w-44 shrink-0 flex flex-col">
                    <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-full overflow-hidden">
                      <div className="px-3 py-2.5 bg-[#0a2156] shrink-0">
                        <p className="text-white text-[10px] font-bold uppercase tracking-widest">Subjects</p>
                        <p className="text-blue-200 text-[10px] mt-0.5">Drag onto grid</p>
                      </div>
                      {/* Teacher selector */}
                      <div className="p-2.5 border-b border-gray-100 space-y-2 shrink-0">
                        {[['Teacher',staff.filter(s=>s.role==='teacher'||s.role==='dos'),'dragTeacher'],['Room',rooms,'dragRoom']].map(([label,opts,key])=>(
                          <div key={key}>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                            <div className="relative">
                              <select className="w-full text-[11px] appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 pr-6 font-medium text-gray-800 focus:outline-none"
                                value={dragging?.[key==='dragTeacher'?'teacher_id':'room_id']||''}
                                onChange={e=>{const v=e.target.value;setDragging(p=>p?{...p,[key==='dragTeacher'?'teacher_id':'room_id']:v}:{[key==='dragTeacher'?'teacher_id':'room_id']:v});}}
                              >
                                <option value="">— None —</option>
                                {opts.map(o=><option key={o.id} value={o.id}>{o.full_name||o.name}</option>)}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"/>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Subject cards */}
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {subjects.map(sub=>{
                          const col=colorMap[sub.id]||COLORS[0];
                          return(
                            <div key={sub.id} draggable
                              onDragStart={e=>handleDragStart(e,sub,dragging?.teacher_id,dragging?.room_id)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none ${col.bg} ${col.text} ${col.border}`}>
                              <GripVertical className="w-3 h-3 opacity-40 shrink-0"/>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[11px] truncate leading-tight">{(sub.code||sub.name||'').toUpperCase()}</p>
                                <p className="text-[9px] opacity-60 truncate">{sub.name}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid */}
                <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                  {/* Grid header controls */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-wrap gap-2 shrink-0">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{selCls?selCls.name:'Select a class'}{selTrmObj?` · ${selTrmObj.name}`:''}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{allPeriods.length} periods · {slots.length} slots filled</p>
                    </div>
                    <div className="flex gap-1">
                      {DAYS.map((d,i)=>(
                        <button key={i} onClick={()=>setShowDays(p=>p.includes(i+1)?p.filter(x=>x!==i+1):[...p,i+1].sort())}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${showDays.includes(i+1)?'bg-[#0a2156] text-white':'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {DAY_S[i]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!selClass?(
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                      <Calendar className="w-12 h-12 mb-3 opacity-20"/>
                      <p className="font-semibold text-sm">Select a class to view timetable</p>
                    </div>
                  ):loading?(
                    <div className="flex-1 flex items-center justify-center">
                      <span className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  ):allPeriods.length===0?(
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                      <Clock className="w-10 h-10 mb-3 opacity-20"/>
                      <p className="font-semibold text-sm">No periods configured</p>
                      <button onClick={()=>setTab('periods')} className="text-blue-600 text-xs mt-2 hover:underline">Set up periods →</button>
                    </div>
                  ):(
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-xs border-collapse min-w-[500px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-[#0a2156]">
                            <th className="py-2.5 px-3 text-left text-white font-bold text-[11px] w-28 border-r border-blue-800/30">Periods<br/><span className="font-normal text-blue-300 text-[9px]">{allPeriods.filter(p=>!p.is_break).length} periods / {slots.length} slots</span></th>
                            {DAYS.map((d,i)=>showDays.includes(i+1)&&(
                              <th key={i} className="py-2.5 px-3 text-center text-white font-bold text-[11px] border-r border-blue-800/30 min-w-[100px]">{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allPeriods.map((period,pi)=>(
                            <tr key={period.id} className={pi%2===0?'bg-white':'bg-gray-50/50'}>
                              <td className="py-1.5 px-3 border-r border-b border-gray-100">
                                <p className="font-bold text-gray-800 text-[11px]">{period.name}</p>
                                <p className="text-[10px] text-gray-400">{period.start_time?.slice(0,5)} – {period.end_time?.slice(0,5)}</p>
                                {period.is_break&&<span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Break</span>}
                              </td>
                              {DAYS.map((d,di)=>{
                                if(!showDays.includes(di+1))return null;
                                if(period.is_break)return(
                                  <td key={di} className="border-r border-b border-gray-100 text-center">
                                    <div className="py-1.5 text-[10px] text-gray-300 bg-amber-50/40 font-medium">BREAK</div>
                                  </td>
                                );
                                const slot=getSlot(period.id,di+1);
                                const sub=slot?subjects.find(s=>s.id===slot.subject_id):null;
                                const col=sub?colorMap[sub.id]:null;
                                const isTarget=dropTarget?.periodId===period.id&&dropTarget?.day===di+1;
                                return(
                                  <td key={di}
                                    onDragOver={canEdit?e=>handleDragOver(e,period.id,di+1):undefined}
                                    onDragLeave={canEdit?handleDragLeave:undefined}
                                    onDrop={canEdit?e=>handleDrop(e,period,di+1):undefined}
                                    className={`border-r border-b border-gray-100 p-1 align-top min-w-[100px] transition-colors
                                      ${isTarget?'bg-blue-50 border-2 border-dashed border-blue-300 rounded':''}`}>
                                    {slot&&sub?(
                                      <div onClick={()=>canEdit&&setSlotModal({periodId:period.id,dayOfWeek:di+1,slot})}
                                        className={`rounded-lg border px-2 py-1.5 cursor-pointer hover:opacity-85 transition-opacity ${col.bg} ${col.text} ${col.border}`}>
                                        <p className="font-bold text-[11px] leading-tight">{(sub.code||sub.name?.slice(0,4)||'').toUpperCase()}</p>
                                        {slot.teacher&&<p className="text-[9px] opacity-70 mt-0.5 truncate">{slot.teacher.full_name}</p>}
                                        {slot.room&&<p className="text-[9px] opacity-50 truncate">{slot.room.name}</p>}
                                      </div>
                                    ):isTarget?(
                                      <div className="flex items-center justify-center h-10 rounded-lg border-2 border-dashed border-blue-300 text-blue-400 text-[10px] font-bold">Drop here</div>
                                    ):canEdit?(
                                      <button onClick={()=>setSlotModal({periodId:period.id,dayOfWeek:di+1,slot:null})}
                                        className="w-full h-10 rounded-lg border-2 border-dashed border-gray-200 text-gray-300 hover:border-blue-300 hover:text-blue-400 transition-colors flex items-center justify-center">
                                        <Plus className="w-3.5 h-3.5"/>
                                      </button>
                                    ):null}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Subject legend */}
                  {legendSubjects.length>0&&(
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 flex-wrap shrink-0 bg-gray-50/50">
                      {legendSubjects.map(sub=>{const col=colorMap[sub.id]||COLORS[0];return(
                        <div key={sub.id} className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${col.chip}`}/>
                          <span className={`text-[10px] font-bold ${col.text}`}>{(sub.code||sub.name?.slice(0,4)||'').toUpperCase()}</span>
                          <span className="text-[10px] text-gray-400">{sub.name}</span>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ PERIODS ════ */}
            {tab==='periods'&&(
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <p className="font-bold text-gray-900 text-sm">{periods.length} periods</p>
                  {canEdit&&<button onClick={()=>setPeriodModal('new')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2156] text-white text-xs font-bold hover:bg-[#0c2a6a]"><Plus className="w-3.5 h-3.5"/>Add Period</button>}
                </div>
                {allPeriods.length===0?(<div className="py-14 text-center text-gray-400"><Clock className="w-10 h-10 mx-auto mb-3 opacity-20"/><p className="text-sm font-semibold">No periods yet</p></div>):(
                  <div className="divide-y divide-gray-50">
                    {allPeriods.map(p=>(
                      <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${p.is_break?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{p.period_number}</div>
                        <div className="flex-1"><p className="font-semibold text-gray-900 text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.start_time?.slice(0,5)} – {p.end_time?.slice(0,5)}{p.is_break&&<span className="ml-2 text-amber-600 font-semibold">Break</span>}</p></div>
                        {canEdit&&<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>setPeriodModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={async()=>{if(window.confirm('Delete?')){await deleteTtPeriod(p.id);getTtPeriods({academic_year_id:selYear}).then(r=>setPeriods(r.data.data||[]));} }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════ ROOMS ════ */}
            {tab==='rooms'&&(
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <p className="font-bold text-gray-900 text-sm">{rooms.length} rooms</p>
                  {canEdit&&<button onClick={()=>setRoomModal('new')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2156] text-white text-xs font-bold hover:bg-[#0c2a6a]"><Plus className="w-3.5 h-3.5"/>Add Room</button>}
                </div>
                {rooms.length===0?(<div className="py-14 text-center text-gray-400"><MapPin className="w-10 h-10 mx-auto mb-3 opacity-20"/><p className="text-sm font-semibold">No rooms yet</p></div>):(
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
                    {rooms.map(r=>(
                      <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 group hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div><p className="font-bold text-gray-900 text-sm">{r.name}</p><p className="text-xs text-gray-400 capitalize">{r.room_type} · cap.{r.capacity}</p></div>
                          {canEdit&&<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>setRoomModal(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                            <button onClick={async()=>{if(window.confirm('Delete?')){await deleteTtRoom(r.id);getTtRooms().then(r=>setRooms(r.data.data||[]));} }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════ GENERATE / EXPORT ════ */}
            {tab==='generate'&&(
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-[#0a2156] to-[#1e3a8a] rounded-2xl p-5 text-white">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Zap className="w-5 h-5 text-yellow-300"/></div>
                    <div><h3 className="font-bold text-white text-sm">Auto-Generate Timetable</h3><p className="text-blue-200 text-xs mt-0.5">Builds all class timetables from teacher–subject assignments and configured periods.</p></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="block text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1.5">Days / Week</label><div className="relative"><select value={autoGenDays} onChange={e=>setAutoGenDays(e.target.value)} className="w-full appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 pr-8 text-sm font-medium focus:outline-none"><option value={5} className="text-gray-900">5 days (Mon–Fri)</option><option value={6} className="text-gray-900">6 days (Mon–Sat)</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-300 pointer-events-none"/></div></div>
                    <div className="flex items-end pb-0.5"><label className="flex items-center gap-2.5 cursor-pointer w-full"><div onClick={()=>setAutoGenOverwrite(v=>!v)} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${autoGenOverwrite?'bg-red-400':'bg-white/20'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoGenOverwrite?'translate-x-4':'translate-x-0.5'}`}/></div><div><p className="text-xs font-semibold text-white">Overwrite existing</p><p className="text-[10px] text-blue-300">{autoGenOverwrite?'Clears first':'Skips filled'}</p></div></label></div>
                    <div className="flex items-end"><button onClick={handleAutoGenerate} disabled={autoGenLoading||!selYear||!periods.length} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-[#0a2156] text-sm font-bold disabled:opacity-50 transition-colors">{autoGenLoading?<span className="w-4 h-4 border-2 border-[#0a2156] border-t-transparent rounded-full animate-spin"/>:<Zap className="w-4 h-4"/>}{autoGenLoading?'Generating…':'Generate Now'}</button></div>
                  </div>
                  {autoGenResult&&<div className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${autoGenResult.inserted>0?'bg-emerald-400/20 text-emerald-200':'bg-red-400/20 text-red-200'}`}>✅ {autoGenResult.message}{autoGenResult.conflicts>0&&<span className="ml-2 text-amber-300">⚠ {autoGenResult.conflicts} conflicts skipped</span>}</div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[{label:'Class Timetable',icon:Grid3X3,color:'bg-blue-600 hover:bg-blue-700',desc:`Class: ${selCls?.name||'none selected'}`,action:()=>{if(!selClass||!selYear){toast.error('Select class and year');return;}dlFile(exportClassTimetable,{class_id:selClass,academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},'class_timetable.xlsx');},dis:!selClass||!selYear},
                    {label:'Teacher Timetable',icon:User,color:'bg-violet-600 hover:bg-violet-700',extra:<div className="relative"><select value={genTeacher} onChange={e=>setGenTeacher(e.target.value)} className="w-full text-xs appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-7 font-medium text-gray-800 focus:outline-none"><option value="">— Select teacher —</option>{staff.filter(s=>s.role==='teacher'||s.role==='dos').map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"/></div>,action:()=>{if(!genTeacher||!selYear){toast.error('Select teacher and year');return;}dlFile(exportTeacherTimetable,{teacher_id:genTeacher,academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},'teacher_timetable.xlsx');},dis:!genTeacher||!selYear},
                    {label:'Full School',icon:FileSpreadsheet,color:'bg-emerald-600 hover:bg-emerald-700',desc:`All classes · ${years.find(y=>y.id===selYear)?.name||'select year'}`,action:()=>{if(!selYear){toast.error('Select year');return;}dlFile(exportSchoolTimetable,{academic_year_id:selYear,...(selTerm?{term_id:selTerm}:{})},'school_timetable.xlsx');},dis:!selYear},
                  ].map(card=>{const Icon=card.icon;return(
                    <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50"><div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.color.split(' ')[0].replace('bg-','bg-').replace('600','50')}`}><Icon className={`w-5 h-5 ${card.color.split(' ')[0].replace('bg-','text-')}`}/></div><div><p className="font-bold text-gray-900 text-sm">{card.label}</p></div></div>
                      <div className="p-4 flex flex-col gap-3 flex-1">{card.desc&&<p className="text-xs text-gray-500">{card.desc}</p>}{card.extra}{<button onClick={card.action} disabled={card.dis} className={`mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors ${card.color}`}><Download className="w-4 h-4"/>Download .xlsx</button>}</div>
                    </div>
                  );})}
                </div>
              </div>
            )}

            {/* ════ WORKLOAD ════ */}
            {tab==='workload'&&(
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100"><p className="font-bold text-gray-900 text-sm">Teacher Workload</p><p className="text-xs text-gray-400">Periods per teacher per week</p></div>
                {workload.length===0?(<div className="py-14 text-center text-gray-400"><BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-20"/><p className="text-sm font-semibold">No data yet</p></div>):(
                  <div className="divide-y divide-gray-50">{workload.map((t,i)=>(
                    <div key={t.id||i} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-9 h-9 rounded-xl bg-[#0a2156]/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-[#0a2156]"/></div>
                      <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 text-sm">{t.full_name}</p><p className="text-xs text-gray-400">{Object.entries(t.periods_per_day||{}).map(([d,n])=>`${d}: ${n}`).join(' · ')}</p></div>
                      <div className="text-right"><p className="text-lg font-bold text-[#0a2156]">{t.total_periods}</p><p className="text-[10px] text-gray-400">periods/wk</p></div>
                    </div>
                  ))}</div>
                )}
              </div>
            )}

            {/* ════ CONFLICTS ════ */}
            {tab==='conflicts'&&(
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100"><p className="font-bold text-gray-900 text-sm">{conflicts.length===0?'✅ No conflicts':'⚠️ '+conflicts.length+' conflict'+(conflicts.length>1?'s':'')+' found'}</p></div>
                {conflicts.length===0?(<div className="py-14 text-center"><div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="w-7 h-7 text-emerald-600"/></div><p className="font-semibold text-gray-700">Timetable is conflict-free</p></div>):(
                  <div className="divide-y divide-gray-50">{conflicts.map((c,i)=>(
                    <div key={i} className="flex items-start gap-3 px-5 py-4">
                      <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle className="w-4 h-4 text-red-600"/></div>
                      <div><p className="font-semibold text-red-800 text-sm capitalize">{c.type} conflict</p><p className="text-xs text-red-600 mt-0.5">{c.message}</p><p className="text-xs text-gray-400 mt-1">{c.slots?.map(s=>`${s.class?.name} (${DAYS[(s.day_of_week||1)-1]})`).join(' vs ')}</p></div>
                    </div>
                  ))}</div>
                )}
              </div>
            )}
          </div>{/* end tab content */}
        </div>{/* end left panel */}

        {/* ── Right: AI Smart Panel ──────────────────────── */}
        {showAI && (
          <div className="w-80 shrink-0 border-l border-gray-200 overflow-hidden">
            <AISmartPanel
              onClose={()=>setShowAI(false)}
              selYear={selYear} selTerm={selTerm} selClass={selClass}
              dragging={dragging} slots={slots} subjects={subjects}
              staff={staff} workload={workload} conflicts={conflicts}
              colorMap={colorMap}
            />
          </div>
        )}
      </div>{/* end body */}

      {/* ── Modals ─────────────────────────────────────────── */}
      {slotModal&&(
        <SlotModal slot={slotModal.slot} classId={selClass} periodId={slotModal.periodId} dayOfWeek={slotModal.dayOfWeek}
          termId={selTerm} yearId={selYear} subjects={subjects} staff={staff} rooms={rooms} colorMap={colorMap}
          onSave={()=>{setSlotModal(null);loadSlots();}} onClose={()=>setSlotModal(null)}/>
      )}
      {roomModal&&<RoomModal room={roomModal==='new'?null:roomModal} onSave={()=>{setRoomModal(null);getTtRooms().then(r=>setRooms(r.data.data||[]));}} onClose={()=>setRoomModal(null)}/>}
      {periodModal&&<PeriodModal period={periodModal==='new'?null:periodModal} yearId={selYear} termId={selTerm} onSave={()=>{setPeriodModal(null);getTtPeriods({academic_year_id:selYear}).then(r=>setPeriods(r.data.data||[]));}} onClose={()=>setPeriodModal(null)}/>}
    </div>
  );
}
