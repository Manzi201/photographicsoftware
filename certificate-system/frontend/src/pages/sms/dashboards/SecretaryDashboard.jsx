import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, FileText, Award, Download, Printer, Upload, ArrowUpRight, CheckCircle } from 'lucide-react';
import { getSmsStudents, getSmsClasses, getTerms, getBulletins, generateBatch, downloadBlob } from '../../../api';
import toast from 'react-hot-toast';

export default function SecretaryDashboard() {
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selClass, setSelClass] = useState('');
  const [selTerm,  setSelTerm]  = useState('');
  const [genAll,   setGenAll]   = useState(false);

  const school = JSON.parse(localStorage.getItem('staff_school')||'{}');
  const staff  = JSON.parse(localStorage.getItem('staff_data')||'{}');

  useEffect(() => {
    Promise.all([getSmsStudents(), getSmsClasses(), getTerms()]).then(([s,c,t]) => {
      setStudents(s.data.data||[]);
      setClasses(c.data.data||[]);
      setTerms(t.data.data||[]);
    }).finally(() => setLoading(false));
  }, []);

  const handlePrintAll = async () => {
    if (!selClass || !selTerm) { toast.error('Select class and term'); return; }
    setGenAll(true);
    try {
      const { generateClassBulletins } = await import('../../../api');
      const cls = classes.find(c => c.id === selClass);
      const trm = terms.find(t => t.id === selTerm);
      const res = await generateClassBulletins({ class_id: selClass, term_id: selTerm, academic_year_id: cls?.academic_year_id || '' });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `${cls?.name}_${trm?.name}_bulletins.pdf`);
      toast.success('All bulletins downloaded!');
    } catch { toast.error('Failed to generate'); }
    finally { setGenAll(false); }
  };

  const actions = [
    { to:'/sms/students', icon:UserPlus, label:'Register Student',    desc:'Add new student to class',             color:'text-blue-600',  bg:'bg-blue-50' },
    { to:'/upload',       icon:Upload,   label:'Upload Photos/CSV',   desc:'Batch upload student photos',          color:'text-green-600', bg:'bg-green-50' },
    { to:'/sms/bulletins',icon:FileText, label:'Print Bulletins',     desc:'Generate & print report cards',        color:'text-purple-600',bg:'bg-purple-50' },
    { to:'/search',       icon:Users,    label:'Search Student',      desc:'Find student by name or ID',           color:'text-indigo-600',bg:'bg-indigo-50' },
    { to:'/generate',     icon:Award,    label:'Generate Certificate', desc:'Print student certificate',            color:'text-amber-600', bg:'bg-amber-50' },
    { to:'/print-all',    icon:Printer,  label:'Print All Certs',     desc:'Batch print certificates by class',    color:'text-orange-600',bg:'bg-orange-50' },
  ];

  const feeUnpaid = students.filter(s => s.fee_status === 'unpaid').length;
  const feePartial= students.filter(s => s.fee_status === 'partial').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-teal-700 rounded-2xl p-5 mb-6 text-white">
        <p className="text-green-300 text-sm">Secretary Dashboard</p>
        <h1 className="text-2xl font-bold">{school.school_name||'School'}</h1>
        <p className="text-green-200 text-sm mt-0.5">Welcome, {staff.full_name} · Year {school.active_year}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card bg-blue-50 border-0 text-center py-4">
          <p className="text-2xl font-bold text-blue-700">{loading?'…':students.length}</p>
          <p className="text-xs text-gray-500">Total Students</p>
        </div>
        <div className="card bg-amber-50 border-0 text-center py-4">
          <p className="text-2xl font-bold text-amber-700">{loading?'…':feeUnpaid+feePartial}</p>
          <p className="text-xs text-gray-500">Fee Issues</p>
        </div>
        <div className="card bg-green-50 border-0 text-center py-4">
          <p className="text-2xl font-bold text-green-700">{loading?'…':classes.length}</p>
          <p className="text-xs text-gray-500">Classes</p>
        </div>
      </div>

      {/* Print All Bulletins quick action */}
      <div className="card mb-6 bg-purple-50 border-purple-100">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <Printer className="w-4 h-4"/> Quick: Print All Bulletins for a Class
        </h3>
        <div className="flex gap-3 flex-wrap">
          <select className="select-field flex-1 min-w-40" value={selClass} onChange={e=>setSelClass(e.target.value)}>
            <option value="">— Select Class —</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select-field flex-1 min-w-40" value={selTerm} onChange={e=>setSelTerm(e.target.value)}>
            <option value="">— Select Term —</option>
            {terms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={handlePrintAll} disabled={genAll || !selClass || !selTerm} className="btn-primary whitespace-nowrap">
            {genAll ? 'Generating...' : <><Download className="w-4 h-4"/> Download All PDFs</>}
          </button>
        </div>
      </div>

      {/* Action cards */}
      <h2 className="font-bold text-gray-800 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to} className="card hover:shadow-md transition-shadow flex items-center gap-3">
              <div className={`${a.bg} p-2.5 rounded-xl shrink-0`}><Icon className={`w-5 h-5 ${a.color}`}/></div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{a.label}</p>
                <p className="text-xs text-gray-400 truncate">{a.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent students */}
      {students.length > 0 && (
        <div className="card mt-6 overflow-hidden p-0">
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Recent Registrations</span>
            <Link to="/sms/students" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {students.slice(0,5).map(s=>(
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                <div className="w-9 h-11 rounded-lg overflow-hidden bg-gray-100 border shrink-0">
                  {s.photo_url && <img src={s.photo_url} className="w-full h-full object-cover"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">{s.student_id} · {s.current_class?.name||'—'}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
                  ${s.fee_status==='paid'?'bg-green-100 text-green-700':s.fee_status==='partial'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                  {s.fee_status||'unpaid'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
