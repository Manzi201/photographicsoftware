import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Send, Users, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsStudents, getSmsClasses, getTerms, getNotifications, sendFeeReminder, sendCustomNotif, notifyBulletinReady } from '../../api';

const TABS = [
  { id: 'fee',      label: 'Fee Reminder',    icon: Bell },
  { id: 'bulletin', label: 'Bulletin Ready',  icon: CheckCircle },
  { id: 'custom',   label: 'Custom Message',  icon: MessageSquare },
  { id: 'history',  label: 'History',         icon: Mail },
];

export default function SmsNotifications() {
  const [tab,       setTab]      = useState('fee');
  const [classes,   setClasses]  = useState([]);
  const [terms,     setTerms]    = useState([]);
  const [students,  setStudents] = useState([]);
  const [notifs,    setNotifs]   = useState([]);
  const [selected,  setSelected] = useState([]); // student IDs
  const [selClass,  setSelClass] = useState('');
  const [selTerm,   setSelTerm]  = useState('');
  const [feeTemplate, setFeeTemplate] = useState("Dear Parent, {name}'s school fees balance is RWF {balance} for {term}. Please pay at {school}. Thank you.");
  const [customMsg,   setCustomMsg]   = useState('');
  const [customSubj,  setCustomSubj]  = useState('');
  const [customType,  setCustomType]  = useState('sms');
  const [sending,  setSending]  = useState(false);

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getNotifications()]).then(([c,t,n]) => {
      setClasses(c.data.data||[]); setTerms(t.data.data||[]); setNotifs(n.data.data||[]);
    });
  }, []);

  useEffect(() => {
    if (selClass) getSmsStudents({ class_id: selClass }).then(r => {
      const data = r.data.data||[];
      setStudents(data);
      setSelected(data.map(s => s.id));
    });
  }, [selClass]);

  const toggleStudent = id => setSelected(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id]);
  const toggleAll = () => setSelected(selected.length === students.length ? [] : students.map(s => s.id));

  const handleSendFeeReminder = async () => {
    if (!selected.length || !selTerm) { toast.error('Select students and term'); return; }
    setSending(true);
    try {
      const res = await sendFeeReminder({ student_ids: selected, term_id: selTerm, message_template: feeTemplate });
      toast.success(`Sent to ${res.data.sent} parents!`);
      getNotifications().then(r => setNotifs(r.data.data||[]));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSending(false); }
  };

  const handleBulletinNotify = async () => {
    if (!selClass || !selTerm) { toast.error('Select class and term'); return; }
    setSending(true);
    try {
      const res = await notifyBulletinReady({ class_id: selClass, term_id: selTerm });
      toast.success(`Notified ${res.data.sent} parents!`);
      getNotifications().then(r => setNotifs(r.data.data||[]));
    } catch (err) { toast.error('Failed'); }
    finally { setSending(false); }
  };

  const handleCustom = async () => {
    if (!selected.length || !customMsg) { toast.error('Select students and write message'); return; }
    setSending(true);
    try {
      const res = await sendCustomNotif({ student_ids: selected, message: customMsg, subject: customSubj, type: customType });
      toast.success(`Sent to ${res.data.sent}!`);
      getNotifications().then(r => setNotifs(r.data.data||[]));
    } catch (err) { toast.error('Failed'); }
    finally { setSending(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-0.5">Send SMS & email notifications to parents</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab===id?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4"/>{label}
          </button>
        ))}
      </div>

      {/* FEE REMINDER */}
      {tab === 'fee' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Fee Payment Reminder</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
                <select className="select-field" value={selClass} onChange={e => setSelClass(e.target.value)}>
                  <option value="">— All students —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Term *</label>
                <select className="select-field" value={selTerm} onChange={e => setSelTerm(e.target.value)}>
                  <option value="">— Select Term —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Message Template</label>
              <textarea className="input-field h-20 resize-none" value={feeTemplate} onChange={e => setFeeTemplate(e.target.value)}/>
              <p className="text-xs text-gray-400 mt-1">Variables: <code>{'{name}'}</code> <code>{'{balance}'}</code> <code>{'{term}'}</code> <code>{'{school}'}</code></p>
            </div>
            <button onClick={handleSendFeeReminder} disabled={sending || !selected.length}
              className="btn-primary w-full justify-center py-3">
              {sending ? 'Sending...' : <><Send className="w-4 h-4"/> Send to {selected.length} parents</>}
            </button>
          </div>
          {students.length > 0 && <StudentSelector students={students} selected={selected} onToggle={toggleStudent} onToggleAll={toggleAll}/>}
        </div>
      )}

      {/* BULLETIN READY */}
      {tab === 'bulletin' && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Notify Parents: Bulletin is Ready</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Class *</label>
              <select className="select-field" value={selClass} onChange={e => setSelClass(e.target.value)}>
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Term *</label>
              <select className="select-field" value={selTerm} onChange={e => setSelTerm(e.target.value)}>
                <option value="">— Select Term —</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm text-blue-700">
            Message: <em>"Dear Parent, the [Term] report card for [Name] is ready. Please collect it from [School]."</em>
          </div>
          <button onClick={handleBulletinNotify} disabled={sending || !selClass || !selTerm}
            className="btn-primary w-full justify-center py-3">
            {sending ? 'Sending...' : <><Send className="w-4 h-4"/> Notify All Parents in Class</>}
          </button>
        </div>
      )}

      {/* CUSTOM */}
      {tab === 'custom' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Custom Message</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Send via</label>
                <div className="flex gap-2">
                  {['sms','email','both'].map(t => (
                    <button key={t} onClick={() => setCustomType(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                        ${customType===t?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200'}`}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Class filter</label>
                <select className="select-field" value={selClass} onChange={e => setSelClass(e.target.value)}>
                  <option value="">All students</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {(customType==='email'||customType==='both') && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                <input className="input-field" value={customSubj} onChange={e => setCustomSubj(e.target.value)} placeholder="Email subject"/>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Message *</label>
              <textarea className="input-field h-24 resize-none" value={customMsg} onChange={e => setCustomMsg(e.target.value)} placeholder="Your message here... Use {name} for student name"/>
            </div>
            <button onClick={handleCustom} disabled={sending || !selected.length || !customMsg}
              className="btn-primary w-full justify-center py-3">
              {sending ? 'Sending...' : <><Send className="w-4 h-4"/> Send to {selected.length} parents</>}
            </button>
          </div>
          {students.length > 0 && <StudentSelector students={students} selected={selected} onToggle={toggleStudent} onToggleAll={toggleAll}/>}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                {['Type','Recipient','Message','Status','Date'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {notifs.slice(0,50).map(n => (
                  <tr key={n.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.type==='sms'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>
                        {n.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-600">{n.recipient}</td>
                    <td className="py-2 px-4 text-xs text-gray-500 max-w-xs truncate">{n.message}</td>
                    <td className="py-2 px-4">
                      {n.status === 'sent'
                        ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3"/> Sent</span>
                        : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3"/> Failed</span>}
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-400">{new Date(n.sent_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
                {notifs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No notifications sent yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentSelector({ students, selected, onToggle, onToggleAll }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">{selected.length}/{students.length} selected</p>
        <button onClick={onToggleAll} className="text-xs text-blue-600 hover:underline">
          {selected.length === students.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {students.map(s => (
          <div key={s.id} onClick={() => onToggle(s.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer border transition-all
              ${selected.includes(s.id)?'border-blue-300 bg-blue-50':'border-gray-100 hover:bg-gray-50'}`}>
            <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected.includes(s.id)?'bg-blue-600 border-blue-600':'border-gray-300'}`}>
              {selected.includes(s.id) && <CheckCircle className="w-3 h-3 text-white"/>}
            </div>
            <span className="text-sm font-medium text-gray-800">{s.first_name} {s.last_name}</span>
            <span className="text-xs text-gray-400 ml-auto">{s.parent_phone||'No phone'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
