import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Award, Download, Printer, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateBatch, downloadBlob, printBlob } from '../api';
import { useAuth } from '../context/AuthContext';

const DEFAULT_CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

const CLASS_THEME = {
  'Top Class': 'bg-amber-50 border-amber-200 text-amber-800',
  'P6':        'bg-blue-50 border-blue-200 text-blue-800',
  'S3':        'bg-green-50 border-green-200 text-green-800',
  'S6':        'bg-red-50 border-red-200 text-red-800',
  'Nursery':   'bg-purple-50 border-purple-200 text-purple-800',
  'Graduation':'bg-orange-50 border-orange-200 text-orange-800',
};

export default function ClassesManager() {
  const { school } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClass, setNewClass] = useState('');
  const [generating, setGenerating] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // We manage classes locally + stored in localStorage per school
  const storageKey = `classes_${school?.id || 'default'}`;
  const [classes, setClasses] = useState(() => {
    try {
      const stored = localStorage.getItem(`classes_${school?.id}`);
      return stored ? JSON.parse(stored) : DEFAULT_CLASSES;
    } catch { return DEFAULT_CLASSES; }
  });

  useEffect(() => {
    getStudents().then((res) => setStudents(res.data.data || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(classes));
  }, [classes, storageKey]);

  const byClass = students.reduce((acc, s) => {
    acc[s.class] = (acc[s.class] || 0) + 1;
    return acc;
  }, {});

  // All classes that have students OR are in our list
  const allClasses = [...new Set([...classes, ...Object.keys(byClass)])];

  const addClass = () => {
    const name = newClass.trim();
    if (!name) { toast.error('Enter a class name'); return; }
    if (classes.includes(name)) { toast.error('Class already exists'); return; }
    setClasses((c) => [...c, name]);
    setNewClass('');
    toast.success(`Class "${name}" added`);
  };

  const removeClass = (cls) => {
    const count = byClass[cls] || 0;
    if (count > 0) {
      setDeleteConfirm(cls);
      return;
    }
    setClasses((c) => c.filter((x) => x !== cls));
    toast.success(`Class "${cls}" removed`);
  };

  const confirmDelete = (cls) => {
    setClasses((c) => c.filter((x) => x !== cls));
    setDeleteConfirm(null);
    toast.success(`Class "${cls}" removed from list`);
  };

  const handleBatch = async (cls, action) => {
    setGenerating((g) => ({ ...g, [cls]: action }));
    try {
      const res = await generateBatch({ class: cls, year: school?.active_year });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, `${cls}_certificates_${school?.active_year || ''}.pdf`);
      toast.success(`${byClass[cls] || 0} certificates ${action === 'print' ? 'sent to printer' : 'downloaded'}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setGenerating((g) => ({ ...g, [cls]: null }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
        <p className="text-gray-500 mt-1">Add or remove classes · generate certificates per class</p>
      </div>

      {/* Add class */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Add New Class</h2>
        <div className="flex gap-3">
          <input
            className="input-field flex-1"
            placeholder="e.g. P5, Baby Class, Form 1..."
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addClass()}
          />
          <button onClick={addClass} className="btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Class
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Default classes: {DEFAULT_CLASSES.join(', ')}
        </p>
      </div>

      {/* Classes grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allClasses.map((cls) => {
            const count = byClass[cls] || 0;
            const theme = CLASS_THEME[cls] || 'bg-gray-50 border-gray-200 text-gray-800';
            const isGenerating = generating[cls];
            return (
              <div key={cls} className={`border-2 rounded-xl p-5 ${theme} flex flex-col gap-3`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{cls}</h3>
                    <p className="text-sm opacity-70 mt-0.5">
                      <Users className="w-3.5 h-3.5 inline mr-1" />
                      {count} student{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeClass(cls)}
                    className="opacity-50 hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/50"
                    title="Remove class">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                {count > 0 ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBatch(cls, 'download')}
                      disabled={!!isGenerating}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white/70 hover:bg-white rounded-lg py-2 text-xs font-semibold transition-colors">
                      {isGenerating === 'download'
                        ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      Download PDF
                    </button>
                    <button
                      onClick={() => handleBatch(cls, 'print')}
                      disabled={!!isGenerating}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white/70 hover:bg-white rounded-lg py-2 text-xs font-semibold transition-colors">
                      {isGenerating === 'print'
                        ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <Printer className="w-3.5 h-3.5" />}
                      Print All
                    </button>
                  </div>
                ) : (
                  <p className="text-xs opacity-50 italic">No students in this class yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Remove Class "{deleteConfirm}"?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This class has <strong>{byClass[deleteConfirm]} students</strong>. 
              Removing it only hides the class label — students remain in the database.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button onClick={() => confirmDelete(deleteConfirm)} className="btn-danger flex-1 justify-center">
                Remove Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
