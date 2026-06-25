import React, { useState, useRef } from 'react';
import { Upload, UserPlus, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { createStudent, bulkUploadStudents } from '../api';

const CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

export default function UploadStudents() {
  const [tab, setTab] = useState('individual');
  const [form, setForm] = useState({
    photo_number: '', first_name: '', last_name: '',
    class: 'Top Class', year: new Date().getFullYear(), school: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  // CSV upload state
  const [csvData, setCsvData] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const csvRef = useRef();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleIndividualSubmit = async (e) => {
    e.preventDefault();
    if (!form.photo_number || !form.first_name || !form.last_name) {
      toast.error('Fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photoFile) fd.append('photo', photoFile);
      await createStudent(fd);
      toast.success(`${form.first_name} ${form.last_name} saved!`);
      setForm({ photo_number: '', first_name: '', last_name: '', class: 'Top Class', year: new Date().getFullYear(), school: form.school });
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving student');
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        setCsvErrors(errors);
        // Normalize keys
        const normalized = data.map((row) => ({
          photo_number: String(row['Photo Number'] || row['photo_number'] || '').trim(),
          first_name: String(row['First Name'] || row['first_name'] || '').trim(),
          last_name: String(row['Last Name'] || row['last_name'] || '').trim(),
          class: String(row['Class'] || row['class'] || 'Top Class').trim(),
          year: String(row['Year'] || row['year'] || new Date().getFullYear()).trim(),
          school: String(row['School'] || row['school'] || '').trim(),
          status: 'active'
        }));
        setCsvData(normalized);
        toast.success(`${normalized.length} students loaded from CSV`);
      },
      error: (err) => toast.error('CSV parse error: ' + err.message)
    });
  };

  const handleBulkSubmit = async () => {
    if (!csvData.length) { toast.error('No data to upload'); return; }
    setUploading(true);
    try {
      const res = await bulkUploadStudents(csvData);
      toast.success(`${res.data.count} students uploaded!`);
      setCsvData([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Students</h1>
        <p className="text-gray-500 mt-1">Add students individually or upload a CSV file</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {[['individual', 'Individual', UserPlus], ['csv', 'CSV Upload', FileText]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Individual Form */}
      {tab === 'individual' && (
        <div className="card max-w-2xl">
          <form onSubmit={handleIndividualSubmit} className="space-y-4">
            <div className="flex gap-6">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-32 h-36 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => document.getElementById('photo-input').click()}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">Photo</span>
                      </div>
                  }
                </div>
                <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                {photoPreview && (
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="text-xs text-red-500 flex items-center gap-1">
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo Number <span className="text-red-500">*</span>
                  </label>
                  <input className="input-field" placeholder="e.g. 001"
                    value={form.photo_number}
                    onChange={(e) => setForm({ ...form, photo_number: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="John"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="Manzi"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select className="select-field" value={form.class}
                      onChange={(e) => setForm({ ...form, class: e.target.value })}>
                      {CLASSES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input className="input-field" type="number" value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                  <input className="input-field" placeholder="School name"
                    value={form.school}
                    onChange={(e) => setForm({ ...form, school: e.target.value })} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Saving...' : <><UserPlus className="w-4 h-4" /> Save Student</>}
            </button>
          </form>
        </div>
      )}

      {/* CSV Upload */}
      {tab === 'csv' && (
        <div className="space-y-4">
          {/* Template info */}
          <div className="card bg-blue-50 border-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-2">CSV Template Format:</p>
            <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
              Photo Number, First Name, Last Name, Class, Year, School
            </code>
            <p className="text-xs text-blue-600 mt-2">
              Example: 001, John, Manzi, Top Class, 2025, ABC School
            </p>
          </div>

          <div className="card">
            <label className="flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors"
              onClick={() => csvRef.current.click()}>
              <Upload className="w-10 h-10 text-gray-400" />
              <span className="text-gray-600 font-medium">Click to upload CSV file</span>
              <span className="text-xs text-gray-400">Supports .csv files</span>
            </label>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          </div>

          {/* Preview */}
          {csvData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-800">Preview ({csvData.length} students)</h3>
                <button onClick={handleBulkSubmit} disabled={uploading} className="btn-primary">
                  {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload All</>}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Photo #', 'First Name', 'Last Name', 'Class', 'Year'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-blue-600">{row.photo_number}</td>
                        <td className="py-2 px-3">{row.first_name}</td>
                        <td className="py-2 px-3">{row.last_name}</td>
                        <td className="py-2 px-3">{row.class}</td>
                        <td className="py-2 px-3">{row.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 20 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    ... and {csvData.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
