import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Bell, Download, ArrowUpRight } from 'lucide-react';
import { getFinanceSummary, getSmsClasses, exportStudentsExcel, exportFinanceExcel, downloadBlob } from '../../../api';
import toast from 'react-hot-toast';

// Mirrors Finance sidebar sections
const SECTIONS = [
  {
    title: 'Finance',
    color: 'amber',
    items: [
      { to: '/sms/finance',       icon: CreditCard, label: 'Fees & Payments', desc: 'Record & view fee payments' },
      { to: '/sms/notifications', icon: Bell,       label: 'Fee Reminders',   desc: 'SMS parents with balance' },
    ],
  },
];

const SECTION_STYLES = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', head: 'text-amber-700', icon: 'bg-amber-100 text-amber-600' },
};

export default function FinanceDashboard() {
  const [summary, setSummary] = useState({});
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlClass, setDlClass] = useState('');
  const staff  = JSON.parse(localStorage.getItem('staff_data')   || '{}');
  const school = JSON.parse(localStorage.getItem('staff_school') || '{}');

  useEffect(() => {
    Promise.all([getFinanceSummary(), getSmsClasses()])
      .then(([f, c]) => {
        setSummary(f.data.data || {});
        setClasses(c.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (type) => {
    try {
      const params = dlClass ? { class_id: dlClass } : {};
      const res = type === 'students'
        ? await exportStudentsExcel(params)
        : await exportFinanceExcel(params);
      const cls   = classes.find(c => c.id === dlClass);
      const fname = type === 'students'
        ? `students_${cls?.name || 'all'}.csv`
        : `finance_${cls?.name || 'all'}.csv`;
      downloadBlob(new Blob([res.data], { type: 'text/csv' }), fname);
      toast.success('Downloaded!');
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-amber-600 rounded-2xl p-5 sm:p-6 text-white">
        <p className="text-amber-200 text-xs font-semibold uppercase tracking-wider">Finance Dashboard</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-0.5">Welcome, {staff.full_name}</h1>
        <p className="text-amber-200 text-sm mt-0.5">{school.school_name} · Year {school.active_year}</p>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Collected',   value: `${(summary.totalCollected   || 0).toLocaleString()} RWF`, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Outstanding', value: `${(summary.totalOutstanding || 0).toLocaleString()} RWF`, color: 'text-red-600',   bg: 'bg-red-50' },
          { label: 'Fully Paid',  value: summary.paidCount    || 0, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Partial',     value: summary.partialCount || 0, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Unpaid',      value: summary.unpaidCount  || 0, color: 'text-red-600',   bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white px-4 py-4 shadow-sm text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{loading ? '…' : s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Sections ──────────────────────────────────────── */}
      {SECTIONS.map(sec => {
        const st = SECTION_STYLES[sec.color];
        return (
          <div key={sec.title}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${st.head}`}>{sec.title}</span>
              <div className={`flex-1 h-px ${st.border.replace('border-', 'bg-')}`}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sec.items.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to}
                    className={`flex items-center gap-4 rounded-2xl border ${st.bg} ${st.border} px-4 py-3.5 hover:shadow-md transition-all group`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${st.icon}`}>
                      <Icon className="w-5 h-5"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                      <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors"/>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Excel downloads ───────────────────────────────── */}
      <div className="rounded-2xl bg-green-50 border border-green-100 p-4 sm:p-5">
        <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2 text-sm">
          <Download className="w-4 h-4"/> Download Excel Reports
        </h3>
        <div className="flex gap-3 flex-wrap mb-3">
          <select className="select-field flex-1 min-w-36 text-sm" value={dlClass} onChange={e => setDlClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => handleDownload('students')} className="btn-primary text-sm">
            <Download className="w-3.5 h-3.5"/> Students List
          </button>
          <button onClick={() => handleDownload('finance')} className="btn-secondary text-sm">
            <Download className="w-3.5 h-3.5"/> Finance Report
          </button>
        </div>
      </div>
    </div>
  );
}
