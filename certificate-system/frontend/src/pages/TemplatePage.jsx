import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateBatch, downloadBlob, printBlob } from '../api';

const CLASS_BG = {
  'Top Class': 'from-yellow-50 to-amber-50 border-amber-200',
  'P6': 'from-blue-50 to-sky-50 border-sky-200',
  'S3': 'from-green-50 to-emerald-50 border-emerald-200',
  'S6': 'from-red-50 to-rose-50 border-rose-200',
  'Nursery': 'from-purple-50 to-violet-50 border-violet-200',
  'Graduation': 'from-orange-50 to-amber-50 border-amber-300',
};

export default function TemplatePage() {
  const { templateId } = useParams();
  const [students, setStudents] = useState([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [templateId, year]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await getStudents({ class: templateId, year });
      setStudents(res.data.data || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async (action) => {
    if (!students.length) { toast.error('No students'); return; }
    setGenerating(true);
    try {
      const res = await generateBatch({ class: templateId, year, template: templateId });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, `${templateId}_certificates_${year}.pdf`);
      toast.success(`Done! ${students.length} certificates`);
    } catch {
      toast.error('Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const bgClass = CLASS_BG[templateId] || 'from-gray-50 to-gray-50 border-gray-200';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className={`card bg-gradient-to-r ${bgClass} mb-6`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{templateId} Certificate</h1>
            <p className="text-gray-500 mt-1">Manage and generate certificates for {templateId}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-gray-800">{loading ? '...' : students.length}</span>
              <span className="text-sm text-gray-400">students</span>
            </div>
            <div>
              <input className="input-field w-24" type="number" value={year}
                onChange={(e) => setYear(e.target.value)}
                onBlur={loadStudents} placeholder="Year" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => handleBatch('download')} disabled={generating || !students.length}
            className="btn-primary">
            <Download className="w-4 h-4" />
            {generating ? 'Generating...' : `Download All (${students.length})`}
          </button>
          <button onClick={() => handleBatch('print')} disabled={generating || !students.length}
            className="btn-secondary">
            <Printer className="w-4 h-4" />
            Print All
          </button>
        </div>
      </div>

      {/* Students grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No students in {templateId} for year {year}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {students.map((student) => (
            <div key={student.id} className="card p-3 text-center hover:shadow-md transition-shadow">
              <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-200">
                {student.photo_url
                  ? <img src={student.photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Photo</div>
                }
              </div>
              <p className="text-sm font-semibold text-gray-800 truncate">{student.first_name} {student.last_name}</p>
              <p className="text-xs font-mono text-blue-500">{student.photo_number}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
