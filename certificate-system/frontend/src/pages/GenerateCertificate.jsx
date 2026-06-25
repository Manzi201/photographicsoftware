import React, { useState, useEffect } from 'react';
import { Search, Award, Download, Printer, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateCertificate, downloadBlob, printBlob } from '../api';

// ── 3 Certificate templates (styles) ─────────────────────────
const STYLES = [
  {
    id: 'clean',
    label: 'Clean White',
    desc: 'Blue border, white background',
    preview: 'bg-white border-2 border-blue-700',
    dot: 'bg-blue-700',
  },
  {
    id: 'classic',
    label: 'Classic Gold',
    desc: 'Warm background, gold accents',
    preview: 'bg-amber-50 border-2 border-amber-700',
    dot: 'bg-amber-600',
  },
  {
    id: 'elegant',
    label: 'Elegant Red',
    desc: 'Cream background, red border',
    preview: 'bg-red-50 border-2 border-red-700',
    dot: 'bg-red-700',
  },
];

const CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

export default function GenerateCertificate() {
  const [query,    setQuery]    = useState('');
  const [student,  setStudent]  = useState(null);
  const [results,  setResults]  = useState([]);
  const [template, setTemplate] = useState('');
  const [style,    setStyle]    = useState('clean');
  const [loading,  setLoading]  = useState(false);
  const [generating, setGenerating] = useState('');

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setStudent(null);
    try {
      const res = await getStudents({ search: query });
      const found = res.data.data || [];
      setResults(found);
      if (found.length === 1) { setStudent(found[0]); setTemplate(found[0].class); }
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  };

  const handleGenerate = async (action = 'download') => {
    if (!student) return;
    setGenerating(action);
    try {
      const res = await generateCertificate(
        student.id,
        template || student.class,
        style           // pass style to backend
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const fname = `${student.photo_number}_${student.last_name}_certificate.pdf`;
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, fname);
      toast.success(action === 'print' ? 'Opening print dialog...' : '✅ Certificate downloaded!');
    } catch {
      toast.error('Failed to generate certificate');
    } finally { setGenerating(''); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Generate Certificate</h1>
        <p className="text-gray-500 mt-1">Search a student, choose a style, then download</p>
      </div>

      {/* Search */}
      <div className="card mb-5">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input className="input-field pl-9"
              placeholder="Photo number (001) or student name"
              value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">
            <Search className="w-4 h-4" /> Find
          </button>
        </form>
      </div>

      {/* Multiple results */}
      {results.length > 1 && !student && (
        <div className="card mb-5">
          <p className="text-sm text-gray-500 mb-3">Multiple students found. Select one:</p>
          <div className="space-y-2">
            {results.map(s => (
              <button key={s.id}
                onClick={() => { setStudent(s); setTemplate(s.class); setResults([]); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left transition-colors">
                <div className="w-10 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border">
                  {s.photo_url && <img src={s.photo_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">#{s.photo_number} · {s.class} · {s.year}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-center text-gray-400 py-6">Searching...</p>}

      {student && (
        <>
          {/* Student info card */}
          <div className="card mb-5 flex gap-5">
            <div className="w-24 h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
              {student.photo_url
                ? <img src={student.photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center">No Photo</div>}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{student.first_name} {student.last_name}</h2>
              <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-gray-500">
                <p>📷 <span className="font-mono font-semibold text-blue-600">#{student.photo_number}</span></p>
                <p>🎓 <span className="font-medium text-gray-700">{student.class}</span></p>
                <p>📅 <span className="font-medium text-gray-700">{student.year}</span></p>
              </div>

              {/* Class/Template selector */}
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Certificate Level</p>
                <div className="flex flex-wrap gap-1.5">
                  {CLASSES.map(c => (
                    <button key={c} onClick={() => setTemplate(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                        ${template === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Style selector (3 templates) ── */}
          <div className="card mb-5">
            <p className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-400" /> Choose Certificate Style
            </p>
            <div className="grid grid-cols-3 gap-3">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`rounded-xl border-2 overflow-hidden transition-all text-left
                    ${style === s.id ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}>
                  {/* Mini certificate preview */}
                  <div className={`${s.preview} h-24 relative p-2 flex flex-col gap-1.5`}>
                    {/* Logo placeholder */}
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 bg-gray-300 rounded" />
                      <div className="w-8 h-10 bg-gray-300 rounded" />
                    </div>
                    {/* School name box */}
                    <div className="border border-current mx-1 py-0.5">
                      <div className="h-1.5 bg-current opacity-40 mx-1" />
                    </div>
                    {/* Name lines */}
                    <div className={`h-1.5 ${s.dot} mx-2 rounded opacity-80`} />
                    <div className="h-1 bg-gray-400 mx-3 rounded opacity-50" />
                    <div className="h-1 bg-gray-400 mx-4 rounded opacity-40" />
                    {style === s.id && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <div className={`px-3 py-2 ${style === s.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
                    <p className="text-xs font-bold">{s.label}</p>
                    <p className={`text-xs ${style === s.id ? 'text-blue-100' : 'text-gray-400'}`}>{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Download / Print buttons */}
          <div className="flex gap-3">
            <button onClick={() => handleGenerate('download')}
              disabled={!!generating}
              className="btn-primary flex-1 justify-center py-3 text-base">
              {generating === 'download'
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                : <><Download className="w-5 h-5" /> Download PDF</>}
            </button>
            <button onClick={() => handleGenerate('print')}
              disabled={!!generating}
              className="btn-secondary flex-1 justify-center py-3 text-base">
              {generating === 'print'
                ? <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Opening...</>
                : <><Printer className="w-5 h-5" /> Print</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
