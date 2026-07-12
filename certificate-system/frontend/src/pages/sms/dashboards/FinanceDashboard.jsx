import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, Bell, Download, ArrowRight, TrendingUp,
  Users, CheckCircle2, AlertCircle, Clock, FileSpreadsheet,
  ChevronDown, Banknote, BarChart3, Receipt
} from 'lucide-react';
import {
  getFinanceSummary, getSmsClasses, getAcademicYears,
  exportStudentsExcel, exportFinanceExcel, downloadBlob
} from '../../../api';
import toast from 'react-hot-toast';

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function FinanceDashboard() {
  const [summary,  setSummary]  = useState({});
  const [classes,  setClasses]  = useState([]);
  const [years,    setYears]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [dlClass,  setDlClass]  = useState('');
  const [dlYear,   setDlYear]   = useState('');
  const [dlLoading,setDlLoading]= useState('');

  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');
  const initials = (staff.full_name || 'F').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    Promise.all([getFinanceSummary(), getSmsClasses(), getAcademicYears()])
      .then(([f, c, y]) => {
        setSummary(f.data.data || {});
        setClasses(c.data.data || []);
        setYears(y.data.data   || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (type) => {
    setDlLoading(type);
    try {
      const params = {};
      if (dlClass) params.class_id          = dlClass;
      if (dlYear)  params.academic_year_id  = dlYear;
      const res   = type === 'students' ? await exportStudentsExcel(params) : await exportFinanceExcel(params);
      const cls   = classes.find(c => c.id === dlClass);
      const ext   = 'xlsx';
      const fname = type === 'students'
        ? `students_${cls?.name || 'all'}.${ext}`
        : `finance_${cls?.name || 'all'}.${ext}`;
      downloadBlob(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }), fname);
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
  const collPct     = (collected + outstanding) > 0
    ? Math.round((collected / (collected + outstanding)) * 100)
    : 0;

  const SEL = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all shadow-sm';

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Header card ─────────────────────────────────── */}
        <div className="bg-[#0a2156] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-lg font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Finance Dashboard</p>
              <h1 className="text-xl font-bold text-white truncate">{staff.full_name || 'Accountant'}</h1>
              <p className="text-blue-200 text-xs mt-0.5 truncate">{school.school_name} · {school.active_year}</p>
            </div>
          </div>

          {/* Collection progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-blue-200 text-xs font-semibold">Collection Rate</span>
              <span className="text-white text-sm font-bold">{collPct}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${collPct}%` }}/>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-emerald-300">
                {fmt(collected)} RWF collected
              </span>
              <span className="text-[10px] text-red-300">
                {fmt(outstanding)} RWF outstanding
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats grid ──────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Total Collected',
              value: `${fmt(collected)} RWF`,
              sub:   'all payments',
              icon:  Banknote,
              bg:    'bg-emerald-50', border: 'border-emerald-100',
              color: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-600',
            },
            {
              label: 'Outstanding',
              value: `${fmt(outstanding)} RWF`,
              sub:   'not yet paid',
              icon:  AlertCircle,
              bg:    'bg-red-50', border: 'border-red-100',
              color: 'text-red-600', iconBg: 'bg-red-100 text-red-500',
            },
            {
              label: 'Fully Paid',
              value: paidCount,
              sub:   `${totalStud > 0 ? Math.round((paidCount/totalStud)*100) : 0}% of students`,
              icon:  CheckCircle2,
              bg:    'bg-emerald-50', border: 'border-emerald-100',
              color: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-600',
            },
            {
              label: 'Fee Issues',
              value: partCount + unpaidCount,
              sub:   `${partCount} partial · ${unpaidCount} unpaid`,
              icon:  Clock,
              bg:    'bg-amber-50', border: 'border-amber-100',
              color: 'text-amber-700', iconBg: 'bg-amber-100 text-amber-600',
            },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label}
                className={`rounded-2xl ${s.bg} border ${s.border} px-4 py-4 shadow-sm`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.iconBg}`}>
                    <Icon className="w-4 h-4"/>
                  </div>
                </div>
                <p className={`text-2xl font-bold leading-tight ${s.color}`}>
                  {loading ? '…' : s.value}
                </p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ── Quick actions ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/sms/finance"
            className="group flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-amber-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <CreditCard className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">Fees &amp; Payments</p>
              <p className="text-gray-400 text-xs mt-0.5">Record payments, view history</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0"/>
          </Link>

          <Link to="/sms/notifications"
            className="group flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <Bell className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">Fee Reminders</p>
              <p className="text-gray-400 text-xs mt-0.5">SMS parents with balance due</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0"/>
          </Link>
        </div>

        {/* ── Excel export ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>
            </div>
            <p className="font-bold text-gray-900 text-sm">Download Excel Reports</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Filter by Class</label>
                <div className="relative">
                  <select value={dlClass} onChange={e => setDlClass(e.target.value)} className={SEL}>
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Filter by Year</label>
                <div className="relative">
                  <select value={dlYear} onChange={e => setDlYear(e.target.value)} className={SEL}>
                    <option value="">All Years</option>
                    {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                </div>
              </div>
            </div>

            {/* Download buttons */}
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => handleDownload('students')} disabled={!!dlLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-60 transition-colors shadow-sm">
                {dlLoading === 'students'
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : <Users className="w-4 h-4"/>}
                Students List
              </button>
              <button onClick={() => handleDownload('finance')} disabled={!!dlLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60 transition-colors shadow-sm">
                {dlLoading === 'finance'
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : <Receipt className="w-4 h-4"/>}
                Finance Report
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
