import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard, Download, Upload, Users, Edit2, X, Check,
  ChevronDown, Search, RefreshCw, Image, AlertCircle, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSmsClasses, getSmsStudents, getAcademicYears,
  updateSmsStudent, generateClassBadges, generateStudentBadge, downloadBlob
} from '../../api';

const SEL = 'w-full appearance-none bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all shadow-sm';

function PhotoUploadModal({ student, onSave, onClose }) {
  const [photo,   setPhoto]   = useState(null);
  const [preview, setPreview] = useState(student.photo_url || null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!photo) { onClose(); return; }
    setLoading(true);
    try {
      const { default: axios } = await import('axios');
      const token = localStorage.getItem('staff_token');
      const base  = import.meta.env.VITE_API_URL?.replace('/api','/api/sms') ||
        (window.location.hostname !== 'localhost'
          ? 'https://photographicsoftware-1.onrender.com/api/sms' : '/api/sms');

      const fd = new FormData();
      fd.append('photo', photo);
      await axios.patch(`${base}/students/${student.id}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
        timeout: 30000,
      });
      toast.success('Photo updated!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">Update Photo — {student.first_name} {student.last_name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-32 h-40 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center bg-gray-50">
            {preview
              ? <img src={preview} className="w-full h-full object-cover" alt="preview"/>
              : <div className="text-center"><Image className="w-8 h-8 text-gray-300 mx-auto mb-1"/><p className="text-xs text-gray-400">Click to upload</p></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleFile(e.target.files[0])}/>
          {photo && <p className="text-xs text-gray-500 truncate max-w-full">{photo.name}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={loading || !photo} className="btn-primary flex-1 justify-center">
            {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>Uploading…</> : <><Check className="w-4 h-4"/> Save Photo</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk class photo upload modal ────────────────────────────
function BulkPhotoModal({ students, onSave, onClose }) {
  const [matches,  setMatches]  = useState({}); // filename → studentId
  const [files,    setFiles]    = useState([]);
  const [uploading,setUploading]= useState(false);
  const [results,  setResults]  = useState(null);
  const fileRef = useRef();

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList);
    setFiles(arr);
    // Auto-match by various patterns
    const m = {};
    arr.forEach(f => {
      // Normalize filename: remove extension, lowercase, remove separators
      const base = f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[_\s\-\.]/g, '');
      const match = students.find(st => {
        // Try student_id match (e.g. "2026/0001" → "20260001")
        const sid = (st.student_id || '').toLowerCase().replace(/[/\\\s_\-]/g, '');
        if (base === sid || base.includes(sid) || sid.includes(base)) return true;
        // Try full name match
        const fullName = `${st.first_name}${st.last_name}`.toLowerCase().replace(/\s/g, '');
        const fullNameRev = `${st.last_name}${st.first_name}`.toLowerCase().replace(/\s/g, '');
        if (base === fullName || base === fullNameRev) return true;
        // Try partial: starts with last name
        const lastName = (st.last_name || '').toLowerCase().replace(/\s/g, '');
        const firstName = (st.first_name || '').toLowerCase().replace(/\s/g, '');
        if (base.startsWith(lastName) || base.startsWith(firstName)) return true;
        if (lastName.length >= 3 && base.includes(lastName)) return true;
        if (firstName.length >= 4 && base.includes(firstName)) return true;
        return false;
      });
      if (match) m[f.name] = match.id;
    });
    setMatches(m);
  };

  const handleUpload = async () => {
    setUploading(true);
    const ok = [], fail = [];
    try {
      const { default: axios } = await import('axios');
      const token = localStorage.getItem('staff_token');
      const base  = import.meta.env.VITE_API_URL?.replace('/api','/api/sms') ||
        (window.location.hostname !== 'localhost'
          ? 'https://photographicsoftware-1.onrender.com/api/sms' : '/api/sms');

      for (const file of files) {
        const studentId = matches[file.name];
        if (!studentId) { fail.push({ file: file.name, reason: 'No student matched — assign manually' }); continue; }
        try {
          // Use the dedicated PATCH /students/:id/photo endpoint
          try {
            const photoFd = new FormData();
            photoFd.append('photo', file);
            await axios.patch(`${base}/students/${studentId}/photo`, photoFd, {
              headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
              timeout: 30000,
            });
          } catch {
            // fallback: PUT with full form data
            await axios.put(`${base}/students/${studentId}`, fd, {
              headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
              timeout: 30000,
            });
          }
          ok.push(file.name);
        } catch (e) {
          fail.push({ file: file.name, reason: e.response?.data?.error || e.message || 'Upload error' });
        }
      }
      setResults({ ok, fail });
      if (ok.length > 0) { toast.success(`${ok.length} photo${ok.length!==1?'s':''} uploaded!`); onSave(); }
      if (fail.length > 0 && ok.length === 0) toast.error(`All ${fail.length} uploads failed`);
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Upload className="w-4 h-4 text-blue-600"/></div>
            <h2 className="font-bold text-gray-900">Bulk Photo Upload</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-bold">Naming convention for auto-match:</p>
            <p>• Use student ID: <span className="font-mono">2026_0001.jpg</span></p>
            <p>• Or full name: <span className="font-mono">ManziKwizera.jpg</span></p>
            <p>• Multiple files can be selected at once</p>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${files.length > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'}`}>
            <Upload className={`w-8 h-8 mx-auto mb-2 ${files.length > 0 ? 'text-blue-500' : 'text-gray-300'}`}/>
            {files.length > 0
              ? <p className="font-semibold text-blue-700">{files.length} file{files.length!==1?'s':''} selected</p>
              : <p className="font-semibold text-gray-500">Click to select photos</p>}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleFiles(e.target.files)}/>
          </div>

          {/* Match preview */}
          {files.length > 0 && !results && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map(f => {
                const sid = matches[f.name];
                const st  = sid ? students.find(s => s.id === sid) : null;
                return (
                  <div key={f.name} className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-xs
                    ${st ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${st ? 'bg-emerald-500' : 'bg-red-400'}`}>
                      {st ? <CheckCircle2 className="w-3 h-3 text-white"/> : <AlertCircle className="w-3 h-3 text-white"/>}
                    </div>
                    <span className="flex-1 truncate font-mono text-gray-600">{f.name}</span>
                    {st
                      ? <span className="font-semibold text-emerald-700">{st.first_name} {st.last_name}</span>
                      : (
                        <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          value={matches[f.name] || ''}
                          onChange={e => setMatches(p => ({ ...p, [f.name]: e.target.value }))}>
                          <option value="">— match manually —</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                        </select>
                      )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-2 text-xs">
              {results.ok.length > 0 && <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-emerald-700"><span className="font-bold">✅ {results.ok.length} uploaded:</span> {results.ok.join(', ')}</div>}
              {results.fail.length > 0 && <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-700"><span className="font-bold">❌ {results.fail.length} failed:</span> {results.fail.map(f=>f.file).join(', ')}</div>}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">{results ? 'Close' : 'Cancel'}</button>
          {!results && (
            <button onClick={handleUpload} disabled={uploading || files.length === 0}
              className="btn-primary flex-1 justify-center">
              {uploading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>Uploading…</>
                : <><Upload className="w-4 h-4"/> Upload {files.length} Photos</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function Badges() {
  const [years,     setYears]     = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [students,  setStudents]  = useState([]);
  const [selYear,   setSelYear]   = useState('');
  const [selClass,  setSelClass]  = useState('');
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [genLoading,setGenLoading]= useState(''); // 'class' | studentId
  const [photoModal,setPhotoModal]= useState(null); // student object
  const [bulkModal, setBulkModal] = useState(false);

  useEffect(() => {
    Promise.all([getAcademicYears(), getSmsClasses()])
      .then(([y, c]) => {
        const yrs = y.data.data || [];
        setYears(yrs);
        setClasses(c.data.data || []);
        const cur = yrs.find(yr => yr.is_current);
        if (cur) setSelYear(cur.id);
      });
  }, []);

  useEffect(() => {
    if (!selClass) { setStudents([]); return; }
    setLoading(true);
    getSmsStudents({ class_id: selClass })
      .then(r => setStudents(r.data.data || []))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  }, [selClass]);

  const handleDownloadClass = async () => {
    if (!selClass) { toast.error('Select a class first'); return; }
    setGenLoading('class');
    try {
      const cls = classes.find(c => c.id === selClass);
      const res = await generateClassBadges({ class_id: selClass, academic_year_id: selYear || '' });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `badges_${cls?.name || 'class'}.pdf`);
      toast.success('Badges downloaded!');
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenLoading(''); }
  };

  const handleDownloadOne = async (student) => {
    setGenLoading(student.id);
    try {
      const res = await generateStudentBadge({ student_id: student.id, academic_year_id: selYear || '' });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `badge_${student.student_id}.pdf`);
      toast.success('Badge downloaded!');
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenLoading(''); }
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !search || `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase().includes(q);
  });

  const filteredClasses = classes.filter(c => !selYear || !c.academic_year_id || c.academic_year_id === selYear);
  const selCls = classes.find(c => c.id === selClass);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm">
              <CreditCard className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Student Badges / ID Cards</h1>
              <p className="text-gray-400 text-xs">Generate printable ID cards for students</p>
            </div>
          </div>
          <div className="flex gap-2">
            {selClass && (
              <button onClick={() => setBulkModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:border-gray-300 transition-all shadow-sm">
                <Upload className="w-3.5 h-3.5 text-blue-500"/> Bulk Photos
              </button>
            )}
            <button onClick={handleDownloadClass} disabled={!!genLoading || !selClass}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
              {genLoading === 'class'
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Generating…</>
                : <><Download className="w-4 h-4"/> Print Class Badges</>}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-40">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Academic Year</label>
              <div className="relative">
                <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelClass(''); }} className={SEL}>
                  <option value="">— All Years —</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
                </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div className="flex-1 min-w-44">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Class</label>
              <div className="relative">
                <select value={selClass} onChange={e => setSelClass(e.target.value)} className={SEL}>
                  <option value="">— Select Class —</option>
                  {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
                </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            {selClass && (
              <div className="flex-1 min-w-48">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-400 transition-all"
                    placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Student grid */}
        {!selClass ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
            <p className="font-bold text-gray-500">Select a class to view students</p>
            <p className="text-gray-400 text-sm mt-1">Then generate ID badges for the whole class or individual students</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <span className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-20"/>
            <p className="font-semibold">No students found</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600">{filtered.length} student{filtered.length!==1?'s':''} · {selCls?.name}</p>
              <p className="text-xs text-gray-400">{students.filter(s=>s.photo_url).length}/{students.length} have photos</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map(st => (
                <div key={st.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                  {/* Photo area */}
                  <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
                    {st.photo_url
                      ? <img src={st.photo_url} alt={st.first_name} className="w-full h-full object-cover"/>
                      : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <div className="w-12 h-12 rounded-full bg-[#0a2156]/15 flex items-center justify-center text-[#0a2156] font-black text-lg">
                            {(st.first_name?.[0]||'').toUpperCase()}{(st.last_name?.[0]||'').toUpperCase()}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">No photo</p>
                        </div>
                      )}
                    {/* Edit photo button on hover */}
                    <button
                      onClick={() => setPhotoModal(st)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex flex-col items-center gap-1 text-white">
                        <Edit2 className="w-5 h-5"/>
                        <span className="text-[10px] font-bold">Change Photo</span>
                      </div>
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="font-bold text-gray-900 text-xs truncate leading-tight">
                      {(st.last_name||'').toUpperCase()} {st.first_name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{st.student_id}</p>
                    <button
                      onClick={() => handleDownloadOne(st)}
                      disabled={!!genLoading}
                      className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-[#0a2156]/8 hover:bg-[#0a2156] hover:text-white text-[#0a2156] text-[10px] font-bold transition-all disabled:opacity-40">
                      {genLoading === st.id
                        ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                        : <Download className="w-3 h-3"/>}
                      Print Badge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {photoModal && (
        <PhotoUploadModal
          student={photoModal}
          onSave={() => {
            setPhotoModal(null);
            getSmsStudents({ class_id: selClass }).then(r => setStudents(r.data.data || []));
          }}
          onClose={() => setPhotoModal(null)}
        />
      )}
      {bulkModal && selClass && (
        <BulkPhotoModal
          students={students}
          onSave={() => {
            setBulkModal(false);
            getSmsStudents({ class_id: selClass }).then(r => setStudents(r.data.data || []));
          }}
          onClose={() => setBulkModal(false)}
        />
      )}
    </div>
  );
}
