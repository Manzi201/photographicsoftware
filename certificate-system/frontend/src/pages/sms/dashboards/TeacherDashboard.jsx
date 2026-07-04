import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Save, Users, ArrowUpRight } from 'lucide-react';
import { getSmsClasses, getTerms, getSmsStudents } from '../../../api';

export default function TeacherDashboard() {
  const [classes,  setClasses]  = useState([]);
  const [terms,    setTerms]    = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const staff  = JSON.parse(localStorage.getItem('staff_data')||'{}');
  const school = JSON.parse(localStorage.getItem('staff_school')||'{}');

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getSmsStudents()]).then(([c,t,s]) => {
      setClasses(c.data.data||[]); setTerms(t.data.data||[]); setStudents(s.data.data||[]);
    }).finally(() => setLoading(false));
  }, []);

  const currentTerm = terms.find(t => t.is_current);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-indigo-800 to-blue-700 rounded-2xl p-5 mb-6 text-white">
        <p className="text-indigo-300 text-sm">Teacher Dashboard</p>
        <h1 className="text-2xl font-bold">Welcome, {staff.full_name}</h1>
        <p className="text-indigo-200 text-sm mt-0.5">{school.school_name} · {school.active_year} · {currentTerm?.name||'—'}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card bg-blue-50 border-0 text-center py-5">
          <p className="text-3xl font-bold text-blue-700">{loading?'…':classes.length}</p>
          <p className="text-xs text-gray-500 mt-1">My Classes</p>
        </div>
        <div className="card bg-indigo-50 border-0 text-center py-5">
          <p className="text-3xl font-bold text-indigo-700">{loading?'…':students.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Students</p>
        </div>
        <div className="card bg-green-50 border-0 text-center py-5">
          <p className="text-3xl font-bold text-green-700">{currentTerm?.name||'—'}</p>
          <p className="text-xs text-gray-500 mt-1">Current Term</p>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600"/> Enter Marks
        </h3>
        <p className="text-sm text-gray-500 mb-4">Select a class and subject to enter student marks.</p>
        <Link to="/sms/marks" className="btn-primary inline-flex">
          <BookOpen className="w-4 h-4"/> Go to Marks Entry
        </Link>
      </div>

      {/* My classes */}
      {classes.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 bg-gray-50 border-b">
            <span className="text-sm font-semibold text-gray-700">My Classes</span>
          </div>
          <div className="divide-y divide-gray-50">
            {classes.map(cls => {
              const count = students.filter(s => s.current_class_id === cls.id).length;
              return (
                <div key={cls.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-semibold text-gray-900">{cls.name}</p>
                    <p className="text-xs text-gray-400">{count} students</p>
                  </div>
                  <Link to={`/sms/marks?class_id=${cls.id}`} className="btn-secondary text-xs py-1.5">
                    <BookOpen className="w-3.5 h-3.5"/> Enter Marks
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
