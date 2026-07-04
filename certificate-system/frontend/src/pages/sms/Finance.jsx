import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Download, TrendingUp, AlertCircle, CheckCircle, Clock, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsStudents, getPayments, recordPayment, getReceipt, getFinanceSummary, getTerms, downloadBlob } from '../../api';

const METHODS = ['cash','mtn','airtel','bank','cheque'];

function PaymentModal({ student, terms, onSave, onClose }) {
  const [form, setForm] = useState({ term_id:'', amount:'', payment_method:'cash', reference:'', notes:'' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.amount || !form.term_id) { toast.error('Amount and Term required'); return; }
    setLoading(true);
    try {
      const res = await recordPayment({ ...form, student_id: student.id, academic_year_id: '' });
      toast.success(`Payment recorded! Receipt: ${res.data.receipt_number}`);
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Record Payment</h2>
          <button onClick={onClose}><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="font-semibold text-blue-900">{student.first_name} {student.last_name}</p>
            <p className="text-xs text-blue-600">{student.student_id} · Balance: RWF {parseFloat(student.fee_balance||0).toLocaleString()}</p>
          </div>
          {[['Term','term_id','select'],['Amount (RWF)','amount','number'],['Payment Method','payment_method','select'],['Reference / Transaction ID','reference','text'],['Notes','notes','text']].map(([l,k,t]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
              {t === 'select' && k === 'term_id' ? (
                <select className="select-field" value={form[k]} onChange={f(k)}>
                  <option value="">— Select Term —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : t === 'select' ? (
                <select className="select-field" value={form[k]} onChange={f(k)}>
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              ) : (
                <input type={t} className="input-field" value={form[k]} onChange={f(k)} placeholder={l}/>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Saving...' : <><Check className="w-4 h-4"/> Record Payment</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SmsFinance() {
  const [students, setStudents]  = useState([]);
  const [payments, setPayments]  = useState([]);
  const [terms,    setTerms]     = useState([]);
  const [summary,  setSummary]   = useState({});
  const [search,   setSearch]    = useState('');
  const [tab,      setTab]       = useState('payments'); // payments | students | structure
  const [modal,    setModal]     = useState(null);
  const [loading,  setLoading]   = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, tRes, sumRes] = await Promise.all([
        getSmsStudents(), getPayments(), getTerms(), getFinanceSummary()
      ]);
      setStudents(sRes.data.data  || []);
      setPayments(pRes.data.data  || []);
      setTerms(tRes.data.data     || []);
      setSummary(sumRes.data.data || {});
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleReceipt = async (paymentId, receiptNum) => {
    try {
      const res = await getReceipt(paymentId);
      downloadBlob(new Blob([res.data], { type:'application/pdf' }), `receipt_${receiptNum}.pdf`);
    } catch { toast.error('Failed to download receipt'); }
  };

  const filtStudents = students.filter(s => {
    const q = search.toLowerCase();
    return !search || `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase().includes(q);
  });
  const filtPayments = payments.filter(p => {
    const q = search.toLowerCase();
    const st = p.student;
    return !search || `${st?.first_name} ${st?.last_name} ${p.receipt_number}`.toLowerCase().includes(q);
  });

  const statCards = [
    { label:'Total Collected', value:`RWF ${(summary.totalCollected||0).toLocaleString()}`, icon:TrendingUp, color:'text-green-600', bg:'bg-green-50' },
    { label:'Outstanding',     value:`RWF ${(summary.totalOutstanding||0).toLocaleString()}`, icon:AlertCircle, color:'text-red-600', bg:'bg-red-50' },
    { label:'Fully Paid',      value:summary.paidCount||0,    icon:CheckCircle, color:'text-blue-600',  bg:'bg-blue-50' },
    { label:'Partial',         value:summary.partialCount||0, icon:Clock,       color:'text-amber-600', bg:'bg-amber-50' },
    { label:'Not Paid',        value:summary.unpaidCount||0,  icon:AlertCircle, color:'text-red-600',   bg:'bg-red-50' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-gray-500 mt-0.5">School fees management and payment tracking</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`card ${s.bg} border-0 py-4`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${s.color}`}/>
                <span className="text-xs text-gray-500 font-medium">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {[['payments','Recent Payments'],['students','Fee Status']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab===k?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>{l}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card mb-4">
        <input className="input-field" placeholder="Search by name, ID, or receipt number..."
          value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Payments tab */}
      {tab === 'payments' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                {['Receipt','Student','Amount','Method','Term','Date','Action'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtPayments.slice(0,50).map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs text-blue-600">{p.receipt_number}</td>
                    <td className="py-3 px-4 font-medium">{p.student?.first_name} {p.student?.last_name}</td>
                    <td className="py-3 px-4 font-bold text-green-700">RWF {parseFloat(p.amount).toLocaleString()}</td>
                    <td className="py-3 px-4"><span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs uppercase">{p.payment_method}</span></td>
                    <td className="py-3 px-4 text-xs text-gray-500">{p.term?.name}</td>
                    <td className="py-3 px-4 text-xs text-gray-400">{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleReceipt(p.id, p.receipt_number)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Download className="w-3.5 h-3.5"/> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
                {filtPayments.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No payments found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Students fee status tab */}
      {tab === 'students' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                {['Student','ID','Class','Balance','Status','Action'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtStudents.map(st => (
                  <tr key={st.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{st.first_name} {st.last_name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-blue-600">{st.student_id}</td>
                    <td className="py-3 px-4 text-xs">{st.current_class?.name||'—'}</td>
                    <td className="py-3 px-4 font-bold text-red-700">RWF {parseFloat(st.fee_balance||0).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${st.fee_status==='paid'?'bg-green-100 text-green-700':st.fee_status==='partial'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                        {st.fee_status||'unpaid'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => setModal(st)} className="btn-primary text-xs py-1.5">
                        <Plus className="w-3.5 h-3.5"/> Pay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <PaymentModal student={modal} terms={terms} onSave={() => { setModal(null); loadAll(); }} onClose={() => setModal(null)}/>}
    </div>
  );
}
