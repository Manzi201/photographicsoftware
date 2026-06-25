import React, { useState, useRef, useCallback } from 'react';
import { Upload, UserPlus, FileText, Image as PhotoIcon, X, Check, AlertCircle, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { createStudent, bulkUploadStudents } from '../api';
import { useAuth } from '../context/AuthContext';

const CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];
const TABS = [
  { key: 'individual', label: 'Individual',    icon: UserPlus   },
  { key: 'photos',     label: 'Batch Photos',  icon: PhotoIcon  },
  { key: 'csv',        label: 'CSV Import',    icon: FileText   },
];

// ── Batch photo item ──────────────────────────────────────────
function PhotoItem({ item, onUpdate, onRemove }) {
  const [open, setOpen] = useState(!item.first_name);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all
      ${item.saved ? 'border-green-300 bg-green-50' : item.error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>

      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-12 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
          <img src={item.preview} alt="" className="w-full h-full object-cover" />
        </div>

        {/* Status + name */}
        <div className="flex-1 min-w-0">
          {item.saved ? (
            <div className="flex items-center gap-1 text-green-700">
              <Check className="w-4 h-4" />
              <span className="text-sm font-semibold">{item.first_name} {item.last_name}</span>
            </div>
          ) : item.error ? (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="text-xs truncate">{item.error}</span>
            </div>
          ) : item.first_name ? (
            <p className="text-sm font-semibold text-gray-800 truncate">{item.first_name} {item.last_name}</p>
          ) : (
            <p className="text-sm text-blue-600 font-medium">Tap to fill details →</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {item.photo_number ? `#${item.photo_number}` : 'No number'} · {item.class}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!item.saved && (
            <button onClick={() => setOpen(o => !o)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
          )}
          {!item.saved && (
            <button onClick={() => onRemove(item.id)}
              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline form */}
      {open && !item.saved && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Photo # *</label>
              <input className="input-field text-sm py-1.5 font-mono"
                placeholder="001"
                value={item.photo_number}
                onChange={e => onUpdate(item.id, { photo_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <input className="input-field text-sm py-1.5"
                placeholder="John"
                value={item.first_name}
                onChange={e => onUpdate(item.id, { first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <input className="input-field text-sm py-1.5"
                placeholder="Manzi"
                value={item.last_name}
                onChange={e => onUpdate(item.id, { last_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
              <select className="select-field text-sm py-1.5"
                value={item.class}
                onChange={e => onUpdate(item.id, { class: e.target.value })}>
                {CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
              <input className="input-field text-sm py-1.5"
                type="number"
                value={item.year}
                onChange={e => onUpdate(item.id, { year: e.target.value })} />
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-blue-600 font-medium hover:underline">
            ✓ Done editing
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function UploadStudents() {
  const { school } = useAuth();
  const [tab, setTab] = useState('individual');

  // Individual
  const [form, setForm] = useState({
    photo_number: '', first_name: '', last_name: '',
    class: 'Top Class', year: school?.active_year || new Date().getFullYear(),
  });
  const [photoFile, setPhotoFile]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading]         = useState(false);

  // Batch photos
  const [photos, setPhotos]       = useState([]);
  const [saving, setSaving]       = useState(false);
  const [progress, setProgress]   = useState('');
  const dropRef = useRef();

  // CSV
  const [csvData, setCsvData]   = useState([]);
  const [uploading, setUploading] = useState(false);
  const csvRef = useRef();

  const currentYear = school?.active_year || String(new Date().getFullYear());

  // ── Individual handlers ────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleIndividualSubmit = async (e) => {
    e.preventDefault();
    if (!form.photo_number || !form.first_name || !form.last_name) {
      toast.error('Fill in all required fields'); return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photoFile) fd.append('photo', photoFile);
      await createStudent(fd);
      toast.success(`${form.first_name} ${form.last_name} saved!`);
      setForm({ photo_number: '', first_name: '', last_name: '', class: 'Top Class', year: currentYear });
      setPhotoFile(null); setPhotoPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving student');
    } finally { setLoading(false); }
  };

  // ── Batch photos helpers ───────────────────────────────────
  const addFiles = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) { toast.error('Please select image files'); return; }
    const newItems = imgs.map((file, i) => ({
      id:           `${Date.now()}_${i}`,
      file,
      preview:      URL.createObjectURL(file),
      photo_number: String(photos.length + i + 1).padStart(3, '0'),
      first_name:   '',
      last_name:    '',
      class:        'Top Class',
      year:         currentYear,
      saved:        false,
      saving:       false,
      error:        null,
    }));
    setPhotos(p => [...p, ...newItems]);
    toast.success(`${imgs.length} photo${imgs.length > 1 ? 's' : ''} added`);
  }, [photos.length, currentYear]);

  const handleDropFiles = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const updatePhoto = (id, changes) => {
    setPhotos(p => p.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const removePhoto = (id) => {
    setPhotos(p => p.filter(item => item.id !== id));
  };

  const saveAllPhotos = async () => {
    const ready = photos.filter(p => !p.saved && p.first_name && p.last_name && p.photo_number);
    if (!ready.length) {
      toast.error('Fill in names and photo numbers first'); return;
    }
    setSaving(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < ready.length; i++) {
      const item = ready[i];
      setProgress(`Saving ${i + 1}/${ready.length}: ${item.first_name} ${item.last_name}...`);
      updatePhoto(item.id, { saving: true });
      try {
        const fd = new FormData();
        fd.append('photo_number', item.photo_number);
        fd.append('first_name',   item.first_name);
        fd.append('last_name',    item.last_name);
        fd.append('class',        item.class);
        fd.append('year',         item.year);
        fd.append('photo',        item.file);
        await createStudent(fd);
        updatePhoto(item.id, { saved: true, saving: false, error: null });
        ok++;
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Upload failed';
        updatePhoto(item.id, { error: msg, saving: false });
        fail++;
      }
    }
    setSaving(false); setProgress('');
    if (ok)   toast.success(`✅ ${ok} student${ok > 1 ? 's' : ''} saved!`);
    if (fail) toast.error(`${fail} failed — check errors below`);
  };

  // ── CSV handlers ───────────────────────────────────────────
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data }) => {
        const normalized = data.map(row => ({
          photo_number: String(row['Photo Number'] || row['photo_number'] || '').trim(),
          first_name:   String(row['First Name']   || row['first_name']   || '').trim(),
          last_name:    String(row['Last Name']     || row['last_name']    || '').trim(),
          class:        String(row['Class']         || row['class']        || 'Top Class').trim(),
          year:         String(row['Year']          || row['year']         || currentYear).trim(),
          status: 'active',
        }));
        setCsvData(normalized);
        toast.success(`${normalized.length} students loaded`);
      },
      error: err => toast.error('CSV error: ' + err.message),
    });
  };

  const handleBulkSubmit = async () => {
    if (!csvData.length) { toast.error('No data'); return; }
    setUploading(true);
    try {
      const res = await bulkUploadStudents(csvData);
      toast.success(`${res.data.count} students uploaded!`);
      setCsvData([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const readyCount = photos.filter(p => !p.saved && p.first_name && p.last_name && p.photo_number).length;
  const savedCount = photos.filter(p => p.saved).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Students</h1>
        <p className="text-gray-500 mt-1">Add individually, upload photos in batch, or import CSV</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── INDIVIDUAL TAB ──────────────────────────────────── */}
      {tab === 'individual' && (
        <div className="card max-w-2xl">
          <form onSubmit={handleIndividualSubmit} className="space-y-4">
            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-32 h-36 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => document.getElementById('photo-input').click()}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Upload className="w-6 h-6" /><span className="text-xs">Photo</span>
                      </div>}
                </div>
                <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                {photoPreview && (
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="text-xs text-red-500 flex items-center gap-1">
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photo Number <span className="text-red-500">*</span></label>
                  <input className="input-field" placeholder="e.g. 001" value={form.photo_number}
                    onChange={e => setForm({ ...form, photo_number: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="John" value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="Manzi" value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select className="select-field" value={form.class}
                      onChange={e => setForm({ ...form, class: e.target.value })}>
                      {CLASSES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input className="input-field" type="number" value={form.year}
                      onChange={e => setForm({ ...form, year: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Saving...' : <><UserPlus className="w-4 h-4" /> Save Student</>}
            </button>
          </form>
        </div>
      )}

      {/* ── BATCH PHOTOS TAB ─────────────────────────────────── */}
      {tab === 'photos' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropFiles}
            className="card border-2 border-dashed border-blue-300 bg-blue-50 hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('batch-photo-input').click()}>
            <div className="flex flex-col items-center gap-3 py-6">
              <Images className="w-12 h-12 text-blue-400" />
              <div className="text-center">
                <p className="font-semibold text-blue-800">Click or drag photos here</p>
                <p className="text-sm text-blue-600 mt-1">Select multiple photos at once — JPG, PNG</p>
              </div>
              <span className="text-xs text-blue-400">You can select 50+ photos at once</span>
            </div>
          </div>
          <input
            id="batch-photo-input" type="file" accept="image/*" multiple className="hidden"
            onChange={e => addFiles(e.target.files)} />

          {/* Stats bar */}
          {photos.length > 0 && (
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">{photos.length} photos</span>
                <span className="text-green-600 font-medium">{savedCount} saved</span>
                {readyCount > 0 && <span className="text-blue-600 font-medium">{readyCount} ready</span>}
                {photos.filter(p => p.error).length > 0 && (
                  <span className="text-red-500">{photos.filter(p => p.error).length} errors</span>
                )}
              </div>
              <div className="flex gap-2">
                {savedCount > 0 && (
                  <button onClick={() => setPhotos(p => p.filter(x => !x.saved))}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200">
                    Clear saved
                  </button>
                )}
                <button onClick={saveAllPhotos}
                  disabled={saving || readyCount === 0}
                  className="btn-primary text-sm py-1.5">
                  {saving
                    ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> {progress || 'Saving...'}</>
                    : <><Upload className="w-3.5 h-3.5" /> Save {readyCount} Students</>}
                </button>
              </div>
            </div>
          )}

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="space-y-2">
              {photos.map(item => (
                <PhotoItem key={item.id} item={item} onUpdate={updatePhoto} onRemove={removePhoto} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CSV TAB ──────────────────────────────────────────── */}
      {tab === 'csv' && (
        <div className="space-y-4">
          <div className="card bg-blue-50 border-blue-100">
            <p className="text-sm font-semibold text-blue-800 mb-2">CSV Format:</p>
            <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block">
              Photo Number, First Name, Last Name, Class, Year
            </code>
            <p className="text-xs text-blue-600 mt-1.5">Example: 001, John, Manzi, Top Class, 2025</p>
          </div>
          <div className="card">
            <label className="flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors"
              onClick={() => csvRef.current.click()}>
              <Upload className="w-10 h-10 text-gray-400" />
              <span className="text-gray-600 font-medium">Click to upload CSV file</span>
            </label>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          </div>
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
                      {['Photo #', 'First Name', 'Last Name', 'Class', 'Year'].map(h => (
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
                  <p className="text-xs text-gray-400 text-center py-2">...and {csvData.length - 20} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
