import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Bell, Download, ArrowRight, Users, FileSpreadsheet, Receipt, ChevronDown } from 'lucide-react';
import { getFinanceSummary, getSmsClasses, getAcademicYears, exportStudentsExcel, exportFinanceExcel, downloadBlob } from '../../../api';
import toast from 'react-hot-toast';

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function FinanceDashboard() {
  const [summary,   setSummary]   = useState({});
  const [classes,   setClasses]   = useState([]);
  const [years,     setYears]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [dlClass,   setDlClass]   = useState('');
  const [dlYear,    setDlYear]    = useState('');
  const [dlLoading, setDlLoading] = useState('');
  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');

  useEffect(() => {
    Promise.all([getFinanceSummary(), getSmsClasses(), getAcademicYears()])
      .then(([f, c, y]) => { setSummary(f.data.data||{}); setClasses(c.data.data||[]); setYears(y.data.data||[]); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (type) => {
    setDlLoading(type);
    try {
      const params = {};
      if (dlClass) params.class_id         = dlClass;
      if (dlYear)  params.academic_year_id = dlYear;
      const res = type === 'students' ? await exportStudentsExcel(params) : await exportFinanceExcel(params);
      const cls = classes.find(c => c.id === dlClass);
      downloadBlob(new Blob([res.data], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        type === 'students' ? `students_${cls?.name||'all'}.xlsx` : `finance_${cls?.name||'all'}.xlsx`);
      toast.success('Downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDlLoading(''); }
  };

  const collected   = summary.totalCollected   || 0;
  const outstanding = summary.totalOutstanding || 0;
  const paidCount   = summary.paidCount        || 0;
  const partCount   = summary.partialCount     || 0;
  const unpaidCount = summary.unpaidCount      || 0;
  const totalStud   = paidCount + partCount + unpaidCount;
  const collPct     = (collected + outstanding) > 0 ? Math.round((collected / (collected + outstanding)) * 100) : 0;

  const SEL = 'w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2156]/20 focus:border-[#0a2156] transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{staff.full_name} · {school.school_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Collected</p>
            <p className="text-3xl font-bold text-emerald-600">{loading?'—':fmt(collected)}</p>
            <p className="text-xs text-gray-400 mt-2">RWF total</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Outstanding</p>
            <p className="text-3xl font-bold text-red-500">{loading?'—':fmt(outstanding)}</p>
            <p className="text-xs text-gray-400 mt-2">RWF pending</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Fully Paid</p>
            <p className="text-3xl font-bold text-gray-900">{loading?'—':paidCount}</p>
            <p className="text-xs text-gray-400 mt-2">{totalStud>0?Math.round((paidCount/totalStud)*100):0}% of students</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Fee Issues</p>
            <p className="text-3xl font-bold text-amber-600">{loading?'—':partCount+unpaidCount}</p>
            <p className="text-xs text-gray-400 mt-2">{partCount} partial · {unpaidCount} unpaid</p>
          </div>
        </div>

        {/* Collection rate bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Collection Rate</p>
            <p className="text-sm font-bold text-gray-900">{collPct}%</p>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{width:`${collPct}%`}}/>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">{fmt(collected)} RWF collected</span>
            <span className="text-xs text-gray-400">{fmt(outstanding)} RWF remaining</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Link to="/sms/finance"
            className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Fees &amp; Payments</p>
              <p className="text-xs text-gray-400 mt-1">Record payments, view history</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5"/>
          </Link>
          <Link to="/sms/notifications"
            className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#0a2156] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Fee Reminders</p>
              <p className="text-xs text-gray-400 mt-1">SMS parents with balance due</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5"/>
          </Link>
        </div>

        {/* Excel export */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-gray-500"/>
            <h2 className="font-semibold text-gray-900">Download Reports</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Filter by Class</label>
                <select className={SEL} value={dlClass} onChange={e => setDlClass(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Filter by Year</label>
                <select className={SEL} value={dlYear} onChange={e => setDlYear(e.target.value)}>
                  <option value="">All Years</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => handleDownload('students')} disabled={!!dlLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-60 transition-colors">
                {dlLoading==='students' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Users className="w-4 h-4"/>}
                Students List
              </button>
              <button onClick={() => handleDownload('finance')} disabled={!!dlLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60 transition-colors">
                {dlLoading==='finance' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Receipt className="w-4 h-4"/>}
                Finance Report
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
