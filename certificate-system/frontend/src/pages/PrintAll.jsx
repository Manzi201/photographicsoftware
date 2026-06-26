import React, { useState, useEffect } from 'react';
import { Printer, Download, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateBatch, downloadBlob, printBlob } from '../api';

const CLASSES = ['All', 'Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];
const STYLES  = [
  { id:'1', label:'Presidential' },
  { id:'2', label:'Emerald' },
  { id:'3', label:'Sapphire' },
  { id:'4', label:'Burgundy' },
  { id:'5', label:'Midnight' },
  { id:'6', label:'Geometric' },
  { id:'7', label:'Blue Stripe' },
  { id:'8', label:'Navy Portrait' },
];

export default function PrintAll() {
  const [classFilter, setClassFilter] = useState('All');
  const [year, setYear]       = useState(String(new Date().getFullYear()));
  const [template, setTemplate] = useState('');
  const [style, setStyle]     = useState('clean');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    loadStudents();
  }, [classFilter, year]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = { year };
      if (classFilter !== 'All') params.class = classFilter;
      const res = await getStudents(params);
      setStudents(res.data.data || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async (action = 'download') => {
    if (!students.length) { toast.error('No students found'); return; }
    setGenerating(true);
    setProgress(`Generating ${students.length} certificates...`);
    try {
      const params = { year };
      if (classFilter !== 'All') params.class = classFilter;
      if (template) params.template = template;
      if (style)    params.style    = style;
      const res = await generateBatch(params);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const label = classFilter !== 'All' ? classFilter : 'all';
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, `${label}_certificates_${year}.pdf`);
      toast.success(`${students.length} certificates ${action === 'print' ? 'sent to printer' : 'downloaded'}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate batch');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Print All Certificates</h1>
        <p className="text-gray-500 mt-1">Generate and print certificates for all students or by class</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Class</label>
            <select className="select-field w-44" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              {CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input className="input-field w-28" type="number" value={year}
              onChange={(e) => setYear(e.target.value)} onBlur={loadStudents} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Override Template</label>
            <select className="select-field w-44" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">Use student's class</option>
              {CLASSES.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Style</label>
            <div className="flex gap-2">
              {STYLES.map(s => (
                <button key={s.id} type="button"
                  onClick={() => setStyle(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${style === s.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div className="card mb-6 bg-blue-50 border-blue-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-900">
              {loading ? '...' : students.length}
            </p>
            <p className="text-sm text-blue-600">
              Students {classFilter !== 'All' ? `in ${classFilter}` : 'total'} · Year {year}
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      {generating && (
        <div className="card mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-yellow-800 font-medium">{progress}</p>
          </div>
          <p className="text-xs text-yellow-600 mt-2">
            This may take a moment for large batches. Please wait...
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        <button onClick={() => handleBatchGenerate('download')}
          disabled={generating || loading || !students.length}
          className="btn-primary flex-1 justify-center py-3">
          <Download className="w-5 h-5" />
          {generating ? 'Generating...' : `Download All (${students.length}) PDF`}
        </button>
        <button onClick={() => handleBatchGenerate('print')}
          disabled={generating || loading || !students.length}
          className="btn-secondary flex-1 justify-center py-3">
          <Printer className="w-5 h-5" />
          Print All ({students.length})
        </button>
      </div>

      {/* Students list preview */}
      {!loading && students.length > 0 && (
        <div className="card mt-6 overflow-hidden p-0">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-600">Students in batch</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  {['#', 'Photo #', 'Name', 'Class'].map((h) => (
                    <th key={h} className="text-left py-2 px-4 text-gray-400 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2 px-4 font-mono text-blue-600">{s.photo_number}</td>
                    <td className="py-2 px-4">{s.first_name} {s.last_name}</td>
                    <td className="py-2 px-4 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.class}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
