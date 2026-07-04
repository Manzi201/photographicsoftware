import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, TrendingUp, AlertCircle, CheckCircle, Download, ArrowUpRight } from 'lucide-react';
import { getFinanceSummary, getSmsClasses, exportStudentsExcel, exportFinanceExcel, downloadBlob } from '../../../api';
import toast from 'react-hot-toast';

export default function FinanceDashboard() {
  const [summary, setSummary] = useState({});
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlClass, setDlClass] = useState('');
  const staff  = JSON.parse(localStorage.getItem('staff_data')||'{}');
  const school = JSON.parse(localStorage.getItem('staff_school')||'{}');

  useEffect(() => {
    Promise.all([getFinanceSummary(), getSmsClasses()]).then(([f,c]) => {
      setSummary(f.data.data||{}); setClasses(c.data.data||[]);
    }).finally(()=>setLoading(false));
  }, []);

  const handleDownloadExcel = async (type) => {
    try {
      const params = dlClass ? { class_id: dlClass } : {};
      const res = type==='students'
        ? await exportStudentsExcel(params)
        : await exportFinanceExcel(params);
      const cls = classes.find(c=>c.id===dlClass);
      const fname = type==='students'
        ? `students_${cls?.name||'all'}.csv`
        : `finance_${cls?.name||'all'}.csv`;
      downloadBlob(new Blob([res.data],{type:'text/csv'}), fname);
      toast.success('Excel file downloaded!');
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-amber-700 to-orange-600 rounded-2xl p-5 mb-6 text-white">
        <p className="text-amber-200 text-sm">Finance Dashboard</p>
        <h1 className="text-2xl font-bold">Welcome, {staff.full_name}</h1>
        <p className="text-amber-200 text-sm mt-0.5">{school.school_name} · {school.active_year}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label:'Collected',   value:`RWF ${(summary.totalCollected||0).toLocaleString()}`,    color:'text-green-700',  bg:'bg-green-50' },
          { label:'Outstanding', value:`RWF ${(summary.totalOutstanding||0).toLocaleString()}`,  color:'text-red-700',    bg:'bg-red-50' },
          { label:'Fully Paid',  value:summary.paidCount||0,    color:'text-green-700', bg:'bg-green-50' },
          { label:'Partial',     value:summary.partialCount||0, color:'text-amber-700', bg:'bg-amber-50' },
          { label:'Unpaid',      value:summary.unpaidCount||0,  color:'text-red-700',   bg:'bg-red-50' },
        ].map(s=>(
          <div key={s.label} className={`card ${s.bg} border-0 py-4 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{loading?'…':s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Excel download */}
      <div className="card mb-6 bg-green-50 border-green-100">
        <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
          <Download className="w-4 h-4"/> Download Excel Reports
        </h3>
        <div className="flex gap-3 flex-wrap mb-3">
          <select className="select-field flex-1 min-w-40" value={dlClass} onChange={e=>setDlClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={()=>handleDownloadExcel('students')} className="btn-primary text-sm">
            <Download className="w-3.5 h-3.5"/> Students List (Excel)
          </button>
          <button onClick={()=>handleDownloadExcel('finance')} className="btn-secondary text-sm">
            <Download className="w-3.5 h-3.5"/> Finance Report (Excel)
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { to:'/sms/finance', icon:CreditCard,  label:'Record Payment',    desc:'Enter fee payment',        color:'text-amber-600',  bg:'bg-amber-50' },
          { to:'/sms/notifications', icon:AlertCircle, label:'Fee Reminders', desc:'SMS parents with balance', color:'text-red-600', bg:'bg-red-50' },
        ].map(a=>{
          const Icon=a.icon;
          return (
            <Link key={a.to} to={a.to} className="card hover:shadow-md transition-shadow flex items-center gap-4">
              <div className={`${a.bg} p-3 rounded-xl shrink-0`}><Icon className={`w-5 h-5 ${a.color}`}/></div>
              <div><p className="font-semibold text-gray-900 text-sm">{a.label}</p><p className="text-xs text-gray-400">{a.desc}</p></div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 ml-auto"/>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
