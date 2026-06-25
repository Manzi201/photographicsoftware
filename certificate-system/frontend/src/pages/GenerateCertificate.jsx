import React, { useState, useEffect } from 'react';
import { Search, Award, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, getTemplates, generateCertificate, downloadBlob, printBlob } from '../api';

export default function GenerateCertificate() {
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    getTemplates().then((r) => {
      setTemplates(r.data.data || []);
    });
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setStudent(null);
    try {
      const res = await getStudents({ search: query });
      const found = res.data.data || [];
      setResults(found);
      if (found.length === 1) {
        setStudent(found[0]);
        setSelectedTemplate(found[0].class);
      }
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (action = 'download') => {
    if (!student) return;
    setGenerating(true);
    try {
      const res = await generateCertificate(student.id, selectedTemplate || student.class);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, `${student.photo_number}_${student.last_name}_certificate.pdf`);
      toast.success(action === 'print' ? 'Opening print dialog...' : 'Certificate downloaded!');
    } catch {
      toast.error('Failed to generate certificate');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Generate Certificate</h1>
        <p className="text-gray-500 mt-1">Search a student then generate their certificate</p>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input className="input-field pl-9" placeholder="Photo number (001) or name (John Manzi)"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            <Search className="w-4 h-4" /> Find
          </button>
        </form>
      </div>

      {/* Multiple results */}
      {results.length > 1 && !student && (
        <div className="card mb-6">
          <p className="text-sm text-gray-500 mb-3">Multiple students found. Select one:</p>
          {results.map((s) => (
            <button key={s.id} onClick={() => { setStudent(s); setSelectedTemplate(s.class); setResults([]); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100 mb-2 text-left">
              <div className="w-10 h-12 rounded bg-gray-100 overflow-hidden shrink-0">
                {s.photo_url ? <img src={s.photo_url} alt={s.first_name} className="w-full h-full object-cover" /> : null}
              </div>
              <div>
                <p className="font-medium">{s.first_name} {s.last_name}</p>
                <p className="text-xs text-gray-400">#{s.photo_number} · {s.class} · {s.year}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Student card */}
      {student && (
        <div className="card mb-6">
          <div className="flex gap-6">
            {/* Photo */}
            <div className="w-28 h-36 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
              {student.photo_url
                ? <img src={student.photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center">No Photo</div>
              }
            </div>
            {/* Info */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{student.first_name} {student.last_name}</h2>
              <div className="mt-2 space-y-1 text-sm text-gray-500">
                <p>📷 Photo Number: <span className="font-mono font-semibold text-blue-600">{student.photo_number}</span></p>
                <p>🎓 Class: <span className="font-medium text-gray-700">{student.class}</span></p>
                <p>📅 Year: <span className="font-medium text-gray-700">{student.year}</span></p>
                {student.school && <p>🏫 School: <span className="font-medium text-gray-700">{student.school}</span></p>}
              </div>

              {/* Template selector */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Template</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                        ${selectedTemplate === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <button onClick={() => handleGenerate('download')} disabled={generating}
              className="btn-primary flex-1 justify-center">
              <Download className="w-4 h-4" />
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={() => handleGenerate('print')} disabled={generating}
              className="btn-secondary flex-1 justify-center">
              <Printer className="w-4 h-4" />
              Print Certificate
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-400">Searching...</div>}
    </div>
  );
}
