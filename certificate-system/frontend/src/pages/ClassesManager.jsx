import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Users, Award, Download, Printer,
  BookOpen, ChevronRight, AlertTriangle, GraduationCap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getStudents, generateBatch, downloadBlob, printBlob, deleteStudent } from '../api';
import { Link } from 'react-router-dom';

const DEFAULT_CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

const CLASS_THEME = {
  'Top Class':  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  icon: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-800' },
  'P6':         { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   icon: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800' },
  'S3':         { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  icon: 'bg-green-500',  badge: 'bg-green-100 text-green-800' },
  'S6':         { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    icon: 'bg-red-500',    badge: 'bg-red-100 text-red-800' },
  'Nursery':    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', icon: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800' },
  'Graduation': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800' },
};

function getTheme(cls) {
  return CLASS_THEME[cls] || {
    bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800',
    icon: 'bg-gray-500', badge: 'bg-gray-100 text-gray-800'
  };
}

// ── Confirm delete modal ───────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, danger = true }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
          <AlertTriangle className={`w-6 h-6 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 justify-center flex items-center gap-2 font-medium py-2 px-4 rounded-lg transition-colors text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClassesManager() {
  const { school } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState(() => {
    // Load custom classes from localStorage per school
    const stored = localStorage.getItem(`classes_${school?.id}`);
    return stored ? JSON.parse(stored) : DEFAULT_CLASSES;
  });
  const [newClass, setNewClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'class'|'students', cls }
  const [expandedClass, setExpandedClass] = useState(null);
  const [classStudents, setClassStudents] = useState({});

  useEffect(() => {
    loadStudents();
  }, []);

  // Persist custom classes to localStorage
  useEffect(() => {
    if (school?.id) {
      localStorage.setItem(`classes_${school.id}`, JSON.stringify(classes));
    }
  }, [classes, school]);

  const loadStudents = async () => {
    try {
      const res = await getStudents({ year: school?.active_year });
      const data = res.data.data || [];
      setStudents(data);

      // Group by class
      const grouped = data.reduce((acc, s) => {
        if (!acc[s.class]) acc[s.class] = [];
        acc[s.class].push(s);
        return acc;
      }, {});
      setClassStudents(grouped);

      // Merge any classes from DB that aren't in our list
      const dbClasses = [...new Set(data.map((s) => s.class))];
      setClasses((prev) => {
        const merged = [...prev];
        dbClasses.forEach((c) => { if (!merged.includes(c)) merged.push(c); });
        return merged;
      });
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = () => {
    const trimmed = newClass.trim();
    if (!trimmed) { toast.error('Enter a class name'); return; }
    if (classes.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      toast.error('Class already exists');
      return;
    }
    setClasses((prev) => [...prev, trimmed]);
    setNewClass('');
    toast.success(`Class "${trimmed}" added`);
  };

  const handleDeleteClass = async (cls) => {
    const studentsInClass = classStudents[cls] || [];
    if (studentsInClass.length > 0) {
      setConfirmDelete({ type: 'withStudents', cls, count: studentsInClass.length });
    } else {
      setConfirmDelete({ type: 'emptyClass', cls });
    }
  };

  const confirmDeleteClass = async () => {
    const { cls, type } = confirmDelete;
    setConfirmDelete(null);

    if (type === 'withStudents') {
      // Delete all students in the class first
      const studentsToDelete = classStudents[cls] || [];
      let failed = 0;
      for (const s of studentsToDelete) {
        try { await deleteStudent(s.id); } catch { failed++; }
      }
      if (failed > 0) {
        toast.error(`${failed} students could not be deleted`);
        return;
      }
      toast.success(`Deleted ${studentsToDelete.length} students from ${cls}`);
    }

    setClasses((prev) => prev.filter((c) => c !== cls));
    setStudents((prev) => prev.filter((s) => s.class !== cls));
    setClassStudents((prev) => { const n = { ...prev }; delete n[cls]; return n; });
    toast.success(`Class "${cls}" removed`);
  };

  const handleBatchDownload = async (cls, action = 'download') => {
    const count = (classStudents[cls] || []).length;
    if (!count) { toast.error('No students in this class'); return; }
    setGenerating(`${cls}_${action}`);
    try {
      const res = await generateBatch({ class: cls, year: school?.active_year });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, `${cls}_certificates_${school?.active_year}.pdf`);
      toast.success(`${count} certificates ${action === 'print' ? 'sent to printer' : 'downloaded'}!`);
    } catch {
      toast.error('Failed to generate certificates');
    } finally {
      setGenerating('');
    }
  };

  const toggleExpand = async (cls) => {
    setExpandedClass(expandedClass === cls ? null : cls);
  };

  const totalStudents = students.length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Classes Manager</h1>
        <p className="text-gray-500 mt-1">
          Manage classes for <span className="font-semibold text-gray-700">{school?.school_name}</span> · Year {school?.active_year}
        </p>
      </div>

      {/* Add new class */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" /> Add New Class
        </h2>
        <div className="flex gap-3">
          <input
            className="input-field flex-1"
            placeholder="e.g. P5, Baby Class, Form 1..."
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
            maxLength={30}
          />
          <button onClick={handleAddClass} className="btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Class
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center py-4 border-blue-100">
          <p className="text-2xl font-bold text-blue-700">{classes.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Classes</p>
        </div>
        <div className="card text-center py-4 border-green-100">
          <p className="text-2xl font-bold text-green-700">{loading ? '—' : totalStudents}</p>
          <p className="text-xs text-gray-500 mt-1">Total Students</p>
        </div>
        <div className="card text-center py-4 border-amber-100">
          <p className="text-2xl font-bold text-amber-700">{school?.active_year || '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Active Year</p>
        </div>
      </div>

      {/* Classes list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => {
            const theme = getTheme(cls);
            const count = (classStudents[cls] || []).length;
            const isExpanded = expandedClass === cls;
            const isGenerating = generating.startsWith(cls);

            return (
              <div key={cls} className={`rounded-xl border ${theme.border} overflow-hidden`}>
                {/* Class header row */}
                <div className={`${theme.bg} px-5 py-4 flex items-center gap-4`}>
                  {/* Icon */}
                  <div className={`w-9 h-9 ${theme.icon} rounded-xl flex items-center justify-center shrink-0`}>
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>

                  {/* Name + count */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-base ${theme.text}`}>{cls}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${theme.badge}`}>
                        {count} student{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Year {school?.active_year}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* View students toggle */}
                    <button onClick={() => toggleExpand(cls)}
                      className="btn-secondary text-xs py-1.5 px-3">
                      <Users className="w-3.5 h-3.5" />
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {/* Download PDF */}
                    <button onClick={() => handleBatchDownload(cls, 'download')}
                      disabled={!count || isGenerating}
                      title="Download certificates"
                      className="p-2 rounded-lg bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40">
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Print */}
                    <button onClick={() => handleBatchDownload(cls, 'print')}
                      disabled={!count || isGenerating}
                      title="Print certificates"
                      className="p-2 rounded-lg bg-white border border-gray-200 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40">
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* Delete class */}
                    <button onClick={() => handleDeleteClass(cls)}
                      title="Delete class"
                      className="p-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Generating indicator */}
                {isGenerating && (
                  <div className="bg-yellow-50 border-t border-yellow-200 px-5 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-yellow-700 font-medium">Generating certificates...</span>
                  </div>
                )}

                {/* Expanded students list */}
                {isExpanded && (
                  <div className="bg-white border-t border-gray-100">
                    {count === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No students in this class yet</p>
                        <Link to="/upload" className="text-blue-600 text-xs hover:underline mt-1 inline-block">
                          Upload students →
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left py-2 px-4 text-xs text-gray-400 font-semibold">Photo</th>
                              <th className="text-left py-2 px-4 text-xs text-gray-400 font-semibold">Photo #</th>
                              <th className="text-left py-2 px-4 text-xs text-gray-400 font-semibold">Name</th>
                              <th className="text-left py-2 px-4 text-xs text-gray-400 font-semibold">Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(classStudents[cls] || []).map((student) => (
                              <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                                <td className="py-2 px-4">
                                  <div className="w-8 h-10 rounded bg-gray-100 overflow-hidden border border-gray-200">
                                    {student.photo_url
                                      ? <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                      : <div className="w-full h-full flex items-center justify-center">
                                          <Users className="w-3 h-3 text-gray-400" />
                                        </div>}
                                  </div>
                                </td>
                                <td className="py-2 px-4 font-mono text-blue-600 font-semibold text-xs">{student.photo_number}</td>
                                <td className="py-2 px-4 font-medium text-gray-800">{student.first_name} {student.last_name}</td>
                                <td className="py-2 px-4 text-gray-500">{student.year}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {count > 10 && (
                          <p className="text-xs text-gray-400 text-center py-2">
                            Showing all {count} students
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.type === 'withStudents'
            ? `Delete "${confirmDelete.cls}" class?`
            : `Remove "${confirmDelete.cls}"?`}
          message={confirmDelete.type === 'withStudents'
            ? `This class has ${confirmDelete.count} student${confirmDelete.count !== 1 ? 's' : ''}. Deleting the class will permanently delete all students and their data. This cannot be undone.`
            : `Remove this empty class from your list?`}
          onConfirm={confirmDeleteClass}
          onCancel={() => setConfirmDelete(null)}
          danger
        />
      )}
    </div>
  );
}
