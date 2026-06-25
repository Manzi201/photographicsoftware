import React, { useState } from 'react';
import { Search, Award, Download, Printer, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateCertificate, deleteStudent, downloadBlob, printBlob } from '../api';

const CLASSES = ['All', 'Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

export default function SearchStudent() {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState({});
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const params = { search: query };
      if (classFilter !== 'All') params.class = classFilter;
      const res = await getStudents(params);
      setResults(res.data.data || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (student, action = 'download') => {
    setGenerating((g) => ({ ...g, [student.id]: action }));
    try {
      const res = await generateCertificate(student.id, student.class);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, `${student.photo_number}_${student.last_name}_certificate.pdf`);
      toast.success(action === 'print' ? 'Opening print dialog...' : 'Certificate downloaded!');
    } catch (err) {
      toast.error('Failed to generate certificate');
    } finally {
      setGenerating((g) => ({ ...g, [student.id]: null }));
    }
  };

  const handleDelete = async (student) => {
    if (!window.confirm(`Delete ${student.first_name} ${student.last_name}?`)) return;
    try {
      await deleteStudent(student.id);
      setResults((r) => r.filter((s) => s.id !== student.id));
      toast.success('Student deleted');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search Student</h1>
        <p className="text-gray-500 mt-1">Search by photo number, name, or class</p>
      </div>

      {/* Search form */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input className="input-field pl-9" placeholder="Search by name or photo number (e.g. 001 or John Manzi)"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select-field w-40" value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}>
            {CLASSES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button type="submit" className="btn-primary whitespace-nowrap">
            <Search className="w-4 h-4" /> Search
          </button>
        </form>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center py-12 text-gray-400">Searching...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="card text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No students found</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">{results.length} student{results.length !== 1 ? 's' : ''} found</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Photo', 'Photo #', 'Name', 'Class', 'Year', 'Actions'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((student) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="w-10 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        {student.photo_url
                          ? <img src={student.photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No<br/>Photo</div>
                        }
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-blue-600 font-semibold">{student.photo_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{student.first_name} {student.last_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{student.class}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{student.year}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleGenerate(student, 'download')}
                          disabled={!!generating[student.id]}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Download PDF">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleGenerate(student, 'print')}
                          disabled={!!generating[student.id]}
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                          title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(student)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {generating[student.id] && (
                        <span className="text-xs text-gray-400">Generating...</span>
                      )}
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
