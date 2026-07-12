import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Folder, FolderPlus, Upload, Trash2, Download, FileText, Image,
  File, X, Check, Edit2, FilePlus, Eye, Lock, Unlock, KeyRound,
  Calendar, ChevronDown, ChevronRight, FileSpreadsheet, FileImage,
  AlertCircle, FolderOpen, Search, Grid3X3, List
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getAcademicYears } from '../../api';

const SMS = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || (
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://photographicsoftware-1.onrender.com/api'
      : '/api'
  )).replace(/\/api\/sms$/, '/api').replace(/\/api$/, '/api'),
  timeout: 60000,
});
SMS.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── Helpers ───────────────────────────────────────────────────
const FOLDER_COLORS = [
  '#2563eb','#16a34a','#dc2626','#9333ea',
  '#d97706','#0891b2','#be185d','#475569','#065f46','#7c3aed',
];

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ type, size = 5 }) {
  const cls = `w-${size} h-${size}`;
  switch (type) {
    case 'pdf':   return <FileText className={`${cls} text-red-500`}/>;
    case 'image': return <FileImage className={`${cls} text-emerald-500`}/>;
    case 'doc':   return <FileText className={`${cls} text-blue-500`}/>;
    case 'excel': return <FileSpreadsheet className={`${cls} text-green-600`}/>;
    case 'ppt':   return <FileText className={`${cls} text-orange-500`}/>;
    default:      return <File className={`${cls} text-gray-400`}/>;
  }
}

// ── Folder Modal (Create / Edit) ──────────────────────────────
function FolderModal({ folder, years, onSave, onClose }) {
  const [form, setForm] = useState({
    name:             folder?.name             || '',
    description:      folder?.description      || '',
    color:            folder?.color            || '#2563eb',
    academic_year_id: folder?.academic_year_id || '',
    password:         '',
    remove_password:  false,
  });
  const [saving, setSaving] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Folder name required'); return; }
    setSaving(true);
    try {
      const body = {
        name:             form.name.trim(),
        description:      form.description || null,
        color:            form.color,
        academic_year_id: form.academic_year_id || null,
      };
      if (form.remove_password) body.remove_password = true;
      if (form.password)        body.password = form.password;

      if (folder) await SMS.put(`/sms/documents/folders/${folder.id}`, body);
      else        await SMS.post('/sms/documents/folders', body);
      toast.success(folder ? 'Folder updated!' : 'Folder created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{folder ? 'Edit Folder' : 'New Folder'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Folder Name *</label>
            <input className="input-field" value={form.name} onChange={f('name')} placeholder="e.g. Student Records" autoFocus/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input className="input-field" value={form.description} onChange={f('description')} placeholder="Optional description"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <div className="relative">
              <select className="select-field pr-9" value={form.academic_year_id} onChange={f('academic_year_id')}>
                <option value="">— General (no year) —</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Folder Color</label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:border-gray-400'}`}
                  style={{ backgroundColor: c }}/>
              ))}
            </div>
          </div>
          {/* Password section */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-gray-500"/>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {folder?.is_locked ? 'Password Protected' : 'Folder Password (optional)'}
              </p>
            </div>
            {folder?.is_locked && !form.remove_password ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <Lock className="w-3 h-3"/> Locked
                </span>
                <button onClick={() => setForm(p => ({ ...p, remove_password: true, password: '' }))}
                  className="text-xs text-red-600 hover:underline">Remove password</button>
                <input className="input-field flex-1 text-xs" value={form.password} onChange={f('password')}
                  placeholder="New password (leave blank to keep)" type="password"/>
              </div>
            ) : form.remove_password ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600">Password will be removed</span>
                <button onClick={() => setForm(p => ({ ...p, remove_password: false }))} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </div>
            ) : (
              <input className="input-field" value={form.password} onChange={f('password')}
                placeholder="Set a password to protect this folder" type="password"/>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Password Unlock Modal ─────────────────────────────────────
function UnlockModal({ folder, onUnlocked, onClose }) {
  const [pwd,     setPwd]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handle = async () => {
    if (!pwd) { setError('Enter the password'); return; }
    setLoading(true); setError('');
    try {
      await SMS.post(`/sms/documents/folders/${folder.id}/unlock`, { password: pwd });
      onUnlocked(folder.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Wrong password');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-600"/>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Protected Folder</h2>
              <p className="text-xs text-gray-400">{folder.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Enter Password</label>
            <input type="password" className="input-field" value={pwd} onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()} placeholder="Folder password" autoFocus/>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5"/> {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handle} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Checking…' : <><Unlock className="w-4 h-4"/> Open Folder</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────
function UploadModal({ folder, onSave, onClose }) {
  const [files,     setFiles]     = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState('');
  const inputRef = useRef();

  const handleUpload = async () => {
    if (!files.length) { toast.error('Select files first'); return; }
    setUploading(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder_id', folder.id);
        fd.append('name', file.name);
        await SMS.post('/sms/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        ok++;
      } catch { fail++; }
    }
    setUploading(false);
    if (ok)   toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded!`);
    if (fail) toast.error(`${fail} file${fail > 1 ? 's' : ''} failed`);
    onSave();
  };

  const addFiles = fs => setFiles(p => {
    const existing = new Set(p.map(f => f.name + f.size));
    return [...p, ...Array.from(fs).filter(f => !existing.has(f.name + f.size))];
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: folder.color + '20' }}>
              <Upload className="w-4 h-4" style={{ color: folder.color }}/>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Upload Files</h2>
              <p className="text-xs text-gray-400">→ {folder.name}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={uploading} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current.click()}
            className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2"/>
            <p className="text-sm font-semibold text-blue-700">Click or drag & drop files</p>
            <p className="text-xs text-blue-400 mt-1">PDF, Word, Excel, Images, etc.</p>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden"
            onChange={e => addFiles(e.target.files)}/>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <FileIcon type={f.name.split('.').pop()?.toLowerCase()} size={4}/>
                  <span className="text-xs flex-1 truncate font-medium text-gray-700">{f.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 shrink-0">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"/>
              <p className="text-xs text-blue-700 truncate">{progress}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={uploading} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !files.length} className="btn-primary flex-1 justify-center">
            {uploading
              ? 'Uploading…'
              : <><Upload className="w-4 h-4"/> Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────
function UploadModal({ folder, onSave, onClose }) {
  const [files,     setFiles]     = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState('');
  const inputRef = useRef();

  const handleUpload = async () => {
    if (!files.length) { toast.error('Select files to upload'); return; }
    setUploading(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder_id', folder.id);
        fd.append('name', file.name);
        await SMS.post('/sms/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        ok++;
      } catch { fail++; }
    }
    setUploading(false);
    if (ok)   toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded!`);
    if (fail) toast.error(`${fail} failed`);
    onSave();
  };

  const addFiles = (list) => setFiles(p => {
    const existing = new Set(p.map(f => f.name + f.size));
    const newOnes  = Array.from(list).filter(f => !existing.has(f.name + f.size));
    return [...p, ...newOnes];
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: folder.color + '20' }}>
              <Folder className="w-4 h-4" style={{ color: folder.color }}/>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Upload Files</h2>
              <p className="text-xs text-gray-400">→ {folder.name}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={uploading} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current.click()}
            className="border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/30 rounded-xl p-8 text-center cursor-pointer transition-all">
            <Upload className="w-9 h-9 text-gray-300 mx-auto mb-2"/>
            <p className="text-sm font-semibold text-gray-600">Click or drag &amp; drop files</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images — any format</p>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden"
            onChange={e => addFiles(e.target.files)}/>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <FileIcon type={f.name.split('.').pop()?.toLowerCase()} size={4}/>
                  <span className="text-xs font-medium flex-1 truncate text-gray-800">{f.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"/>
              <p className="text-xs text-blue-700 truncate">{progress}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={uploading} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !files.length} className="btn-primary flex-1 justify-center">
            {uploading
              ? 'Uploading…'
              : <><Upload className="w-4 h-4"/> Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Documents Page ───────────────────────────────────────
export default function Documents() {
  const [folders,      setFolders]      = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [years,        setYears]        = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderModal,  setFolderModal]  = useState(null);
  const [uploadModal,  setUploadModal]  = useState(false);
  const [unlockModal,  setUnlockModal]  = useState(null);
  const [unlockedIds,  setUnlockedIds]  = useState(new Set()); // folders unlocked this session
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [viewMode,     setViewMode]     = useState('grid'); // 'grid' | 'list'
  const [selYear,      setSelYear]      = useState('all');
  const [expanded,     setExpanded]     = useState({});     // year group expand state

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadFolders(), getAcademicYears().then(r => setYears(r.data.data || []))])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeFolder) loadDocuments(activeFolder.id);
  }, [activeFolder]);

  const loadFolders = async () => {
    try {
      const r = await SMS.get('/sms/documents/folders');
      const data = r.data.data || [];
      setFolders(data);
      // Auto-expand current year
      const curYear = data.find(f => f.academic_year?.is_current);
      if (curYear?.academic_year_id) {
        setExpanded(e => ({ ...e, [curYear.academic_year_id]: true }));
      }
      setExpanded(e => ({ ...e, __general: true })); // always expand general
    } catch { toast.error('Failed to load folders'); }
  };

  const loadDocuments = async (folderId) => {
    try {
      const r = await SMS.get('/sms/documents', { params: { folder_id: folderId } });
      setDocuments(r.data.data || []);
    } catch { toast.error('Failed to load files'); }
  };

  const handleDeleteFolder = async (f) => {
    if (!window.confirm(`⚠️ Delete folder "${f.name}" and ALL its files permanently?`)) return;
    try {
      await SMS.delete(`/sms/documents/folders/${f.id}`);
      toast.success('Folder deleted');
      if (activeFolder?.id === f.id) { setActiveFolder(null); setDocuments([]); }
      loadFolders();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    try {
      await SMS.delete(`/sms/documents/${doc.id}`);
      toast.success('File deleted');
      setDocuments(p => p.filter(d => d.id !== doc.id));
    } catch { toast.error('Failed'); }
  };

  const handleFolderClick = (folder) => {
    if (folder.is_locked && !unlockedIds.has(folder.id)) {
      setUnlockModal(folder);
      return;
    }
    setActiveFolder(folder);
    setDocuments([]);
  };

  const handleUnlocked = (folderId) => {
    setUnlockedIds(p => new Set([...p, folderId]));
    setUnlockModal(null);
    const folder = folders.find(f => f.id === folderId);
    if (folder) { setActiveFolder(folder); setDocuments([]); }
  };

  // ── Group folders by academic year ──────────────────────────
  const groupedFolders = useMemo(() => {
    let list = folders;
    if (search) list = list.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    const groups = {};
    list.forEach(f => {
      const key  = f.academic_year_id || '__general';
      const label = f.academic_year?.name || 'General';
      const isCurrent = !!f.academic_year?.is_current;
      if (!groups[key]) groups[key] = { key, label, isCurrent, folders: [] };
      groups[key].folders.push(f);
    });

    // Sort: current year first, then by year name desc, general last
    return Object.values(groups).sort((a, b) => {
      if (a.key === '__general') return 1;
      if (b.key === '__general') return -1;
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return b.label.localeCompare(a.label);
    });
  }, [folders, search]);

  // ── Docs filtered by search ─────────────────────────────────
  const filteredDocs = useMemo(() => {
    if (!search || activeFolder) return documents;
    return documents.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  }, [documents, search, activeFolder]);

  const totalFiles = folders.reduce((s, f) => s + (f.doc_count?.[0]?.count || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0a2156] flex items-center justify-center shadow-sm">
              <Folder className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">School Documents</h1>
              <p className="text-gray-400 text-xs">{folders.length} folders · {totalFiles} files</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search folders / files…"
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 w-52 shadow-sm"/>
            </div>
            {/* View toggle */}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <button onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[#0a2156] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                <Grid3X3 className="w-4 h-4"/>
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[#0a2156] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                <List className="w-4 h-4"/>
              </button>
            </div>
            <button onClick={() => setFolderModal('new')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold shadow-sm transition-colors">
              <FolderPlus className="w-4 h-4"/> New Folder
            </button>
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">

          {/* ── LEFT: Folder tree by year ─────────────── */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
            ) : groupedFolders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center">
                <Folder className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                <p className="font-semibold text-gray-500 text-sm">No folders yet</p>
                <button onClick={() => setFolderModal('new')}
                  className="text-blue-600 text-xs mt-2 hover:underline">Create first folder →</button>
              </div>
            ) : (
              groupedFolders.map(group => (
                <div key={group.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Year group header */}
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [group.key]: !e[group.key] }))}
                    className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <Calendar className={`w-4 h-4 shrink-0 ${group.isCurrent ? 'text-blue-600' : 'text-gray-400'}`}/>
                    <span className={`font-bold text-sm flex-1 text-left ${group.isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>
                      {group.label}
                    </span>
                    {group.isCurrent && (
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>
                    )}
                    <span className="text-xs text-gray-400">{group.folders.length}</span>
                    {expanded[group.key]
                      ? <ChevronDown className="w-4 h-4 text-gray-400"/>
                      : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                  </button>

                  {/* Folders in this group */}
                  {expanded[group.key] && (
                    <div className="divide-y divide-gray-50">
                      {group.folders.map(f => {
                        const isActive   = activeFolder?.id === f.id;
                        const isLocked   = f.is_locked && !unlockedIds.has(f.id);
                        const docCount   = f.doc_count?.[0]?.count || 0;
                        return (
                          <div key={f.id}
                            onClick={() => handleFolderClick(f)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group
                              ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>

                            {/* Folder icon */}
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                              style={{ backgroundColor: f.color + '20', border: `2px solid ${f.color}40` }}>
                              {isLocked
                                ? <Lock className="w-4 h-4" style={{ color: f.color }}/>
                                : <FolderOpen className="w-4 h-4" style={{ color: f.color }}/>}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate leading-tight ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                                {f.name}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {docCount} file{docCount !== 1 ? 's' : ''}
                                {isLocked && <span className="ml-1.5 text-amber-500">· 🔒 locked</span>}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); setFolderModal(f); }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                <Edit2 className="w-3.5 h-3.5"/>
                              </button>
                              <button onClick={e => { e.stopPropagation(); handleDeleteFolder(f); }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ── RIGHT: Documents panel ────────────────── */}
          <div>
            {!activeFolder ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-gray-300"/>
                </div>
                <p className="font-bold text-gray-500">Select a folder</p>
                <p className="text-gray-400 text-sm mt-1">Click any folder on the left to view its files</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Folder header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: activeFolder.color + '20', border: `2px solid ${activeFolder.color}40` }}>
                      <FolderOpen className="w-5 h-5" style={{ color: activeFolder.color }}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-gray-900">{activeFolder.name}</h2>
                        {activeFolder.is_locked && unlockedIds.has(activeFolder.id) && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Unlock className="w-2.5 h-2.5"/> Unlocked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {documents.length} file{documents.length !== 1 ? 's' : ''}
                        {activeFolder.academic_year && ` · ${activeFolder.academic_year.name}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setUploadModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-xs font-bold shadow-sm transition-colors">
                    <FilePlus className="w-3.5 h-3.5"/> Upload Files
                  </button>
                </div>

                {/* Empty state */}
                {documents.length === 0 ? (
                  <div className="py-16 text-center">
                    <Upload className="w-10 h-10 text-gray-200 mx-auto mb-3"/>
                    <p className="font-semibold text-gray-500 text-sm">No files yet</p>
                    <button onClick={() => setUploadModal(true)} className="text-blue-600 text-xs mt-2 hover:underline">
                      Upload first file →
                    </button>
                  </div>
                ) : viewMode === 'grid' ? (

                  /* ── Grid view ── */
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredDocs.map(doc => (
                      <div key={doc.id}
                        className="group bg-gray-50 border border-gray-100 rounded-xl p-3 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer flex flex-col gap-2">
                        {/* File icon */}
                        <div className="flex items-center justify-center h-14 bg-white rounded-xl border border-gray-100">
                          <FileIcon type={doc.file_type} size={8}/>
                        </div>
                        {/* Name */}
                        <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 text-center">{doc.name}</p>
                        <p className="text-[10px] text-gray-400 text-center">{fmtSize(doc.file_size)}</p>
                        {/* Actions */}
                        <div className="flex justify-center gap-1 pt-1 border-t border-gray-100">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                            <Eye className="w-3.5 h-3.5"/>
                          </a>
                          <a href={doc.file_url} download={doc.name}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Download">
                            <Download className="w-3.5 h-3.5"/>
                          </a>
                          <button onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                ) : (

                  /* ── List view ── */
                  <div className="divide-y divide-gray-50">
                    {/* Column headers */}
                    <div className="grid grid-cols-[2rem_1fr_6rem_10rem_7rem] gap-3 px-5 py-2.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span/>
                      <span>Name</span>
                      <span className="text-center">Size</span>
                      <span>Uploaded</span>
                      <span className="text-center">Actions</span>
                    </div>
                    {filteredDocs.map((doc, i) => (
                      <div key={doc.id}
                        className={`grid grid-cols-[2rem_1fr_6rem_10rem_7rem] gap-3 items-center px-5 py-3 hover:bg-gray-50/60 transition-colors
                          ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <FileIcon type={doc.file_type} size={4}/>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                          {doc.uploader && <p className="text-[10px] text-gray-400">{doc.uploader.full_name}</p>}
                        </div>
                        <p className="text-xs text-gray-500 text-center">{fmtSize(doc.file_size)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {new Date(doc.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                        </p>
                        <div className="flex justify-center gap-1">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                            <Eye className="w-3.5 h-3.5"/>
                          </a>
                          <a href={doc.file_url} download={doc.name}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Download">
                            <Download className="w-3.5 h-3.5"/>
                          </a>
                          <button onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      {folderModal && (
        <FolderModal
          folder={folderModal === 'new' ? null : folderModal}
          years={years}
          onSave={() => { setFolderModal(null); loadFolders(); }}
          onClose={() => setFolderModal(null)}
        />
      )}
      {uploadModal && activeFolder && (
        <UploadModal
          folder={activeFolder}
          onSave={() => { setUploadModal(false); loadDocuments(activeFolder.id); loadFolders(); }}
          onClose={() => setUploadModal(false)}
        />
      )}
      {unlockModal && (
        <UnlockModal
          folder={unlockModal}
          onUnlocked={handleUnlocked}
          onClose={() => setUnlockModal(null)}
        />
      )}
    </div>
  );
}
