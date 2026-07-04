import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp, Users, GraduationCap, ArrowUpRight, BarChart } from 'lucide-react';
import { getSmsStudentStats, getSmsClasses, getTerms } from '../../../api';

export default function DosDashboard() {
  const [stats,   setStats]   = useState({});
  const [classes, setClasses] = useState([]);
  const [terms,   setTerms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const staff  = JSON.parse(localStorage.getItem('staff_data')||'{}');
  const school = JSON.parse(localStorage.getItem('staff_school')||'{}');

  useEffect(() => {
    Promise.all([getSmsStudentStats(), getSmsClasses(), getTerms()]).then(([s,c,t]) => {
      setStats(s.data.data||{}); setClasses(c.data.data||[]); setTerms(t.data.data||[]);
    }).finally(()=>setLoading(false));
  }, []);

  const currentTerm = terms.find(t=>t.is_current);
  const actions = [
    { to:'/sms/marks',     icon:BookOpen,      label:'Marks Entry',      desc:'Enter/review marks',           color:'text-blue-600',   bg:'bg-blue-50' },
    { to:'/sms/bulletins', icon:GraduationCap, label:'Bulletins',        desc:'Generate report cards',        color:'text-green-600',  bg:'bg-green-50' },
    { to:'/sms/promotion', icon:TrendingUp,    label:'Promotion',        desc:'Promote or repeat students',   color:'text-purple-600', bg:'bg-purple-50' },
    { to:'/sms/students',  icon:Users,         label:'Students',         desc:'View & manage students',       color:'text-indigo-600', bg:'bg-indigo-50' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-purple-800 to-violet-700 rounded-2xl p-5 mb-6 text-white">
        <p className="text-purple-300 text-sm">Director of Studies</p>
        <h1 className="text-2xl font-bold">Welcome, {staff.full_name}</h1>
        <p className="text-purple-200 text-sm mt-0.5">{school.school_name} · {school.active_year} · {currentTerm?.name||'—'}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card bg-blue-50 border-0 text-center py-5">
          <p className="text-3xl font-bold text-blue-700">{loading?'…':stats.total||0}</p>
          <p className="text-xs text-gray-500 mt-1">Total Students</p>
        </div>
        <div className="card bg-purple-50 border-0 text-center py-5">
          <p className="text-3xl font-bold text-purple-700">{loading?'…':classes.length}</p>
          <p className="text-xs text-gray-500 mt-1">Classes</p>
        </div>
        <div className="card bg-green-50 border-0 text-center py-5">
          <p className="text-xl font-bold text-green-700">{currentTerm?.name||'—'}</p>
          <p className="text-xs text-gray-500 mt-1">Current Term</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {actions.map(a=>{const Icon=a.icon; return (
          <Link key={a.to} to={a.to} className="card hover:shadow-md transition-shadow flex items-center gap-4">
            <div className={`${a.bg} p-3 rounded-xl shrink-0`}><Icon className={`w-5 h-5 ${a.color}`}/></div>
            <div><p className="font-semibold text-gray-900">{a.label}</p><p className="text-xs text-gray-400">{a.desc}</p></div>
            <ArrowUpRight className="w-4 h-4 text-gray-300 ml-auto"/>
          </Link>
        );})}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 bg-gray-50 border-b"><span className="text-sm font-semibold text-gray-700">Classes Overview</span></div>
        <div className="divide-y divide-gray-50">
          {classes.map(cls=>(
            <div key={cls.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div><p className="font-semibold text-gray-900">{cls.name}</p><p className="text-xs text-gray-400">{cls.level||'—'}</p></div>
              <div className="flex gap-2">
                <Link to={`/sms/marks?class_id=${cls.id}`} className="btn-secondary text-xs py-1.5"><BookOpen className="w-3.5 h-3.5"/> Marks</Link>
                <Link to={`/sms/bulletins?class_id=${cls.id}`} className="btn-secondary text-xs py-1.5"><GraduationCap className="w-3.5 h-3.5"/> Bulletins</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
