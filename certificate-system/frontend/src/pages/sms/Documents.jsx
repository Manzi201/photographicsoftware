import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Folder, FolderPlus, Upload, Trash2, Download, FileText,
  File, X, Check, Edit2, FilePlus, Eye, Lock, Unlock, KeyRound,
  Calendar, ChevronDown, ChevronRight, FileSpreadsheet, FileImage,
  AlertCircle, FolderOpen, Search, Grid3X3, List, GraduationCap,
  School, BookOpen, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getAcademicYears, getSmsClasses, getTerms } from '../../api';

const SMS = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://photographicsoftware-1.onrender.com/api' : '/api')),
  timeout: 60000,
});
SMS.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token') || localStorage.getItem('cert_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── Constants ─────────────────────────────────────────────────
const FOLDER_COLORS = [
  '#2563eb','#16a34a','#dc2626','#9333ea',
  '#d97706','#0891b2','#be185d','#475569','#065f46','#7c3aed',
];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const TERM_COLORS = {
  1: 'bg-blue-100 text-blue-700', 2: 'bg-emerald-100 text-emerald-700',
  3: 'bg-violet-100 text-violet-700', 4: 'bg-amber-100 text-amber-700',
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
function FileIcon({ type, size = 5 }) {
  const c = `w-${size} h-${size}`;
  if (type === 'pdf')   return <FileText className={`${c} text-red-500`}/>;
  if (type === 'image') return <FileImage className={`${c} text-emerald-500`}/>;
  if (type === 'doc')   return <FileText className={`${c} text-blue-500`}/>;
  if (type === 'excel') return <FileSpreadsheet className={`${c} text-green-600`}/>;
  if (type === 'ppt')   return <FileText className={`${c} text-orange-500`}/>;
  if (type === 'zip')   return <FileText className={`${c} text-purple-500`}/>;
  return <File className={`${c} text-gray-400`}/>;
}

// ── Unlock Modal ──────────────────────────────────────────────
function UnlockModal({ folder, onUnlocked, onClose }) {
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async () => {
    if (!pwd) { setError('Enter password'); return; }
    setLoading(true); setError('');
    try {
      await SMS.post(`/sms/documents/folders/${folder.id}/unlock`, { password: pwd });
      onUnlocked(folder.id);
    } catch (err) { setError(err.response?.data?.error || 'Wrong password'); }
    finally { setLoading(false); }
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
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{folder.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-3">
          <input type="password" className="input-field" value={pwd}
            onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key==='Enter'&&handle()}
            placeholder="Enter folder password" autoFocus/>
          {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="w-3.5 h-3.5"/>{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handle} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Checking…' : <><Unlock className="w-4 h-4"/> Open</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────
// Files ≤ 10MB → backend proxy
// Files > 10MB → signed URL direct to Supabase (supports up to 500MB)
function UploadModal({ folder, onSave, onClose }) {
  const [files,    setFiles]    = useState([]);
  const [uploading,setUploading]= useState(false);
  const [progress, setProgress] = useState('');
  const [progPct,  setProgPct]  = useState(0);
  const inputRef = useRef();

  const LARGE = 10 * 1024 * 1024; // 10 MB threshold

  const addFiles = fs => setFiles(p => {
    const ex = new Set(p.map(f => f.name+f.size));
    return [...p, ...Array.from(fs).filter(f => !ex.has(f.name+f.size))];
  });

  const uploadOne = async (file, idx, total) => {
    setProgress(`${idx+1}/${total}: ${file.name}`);
    setProgPct(Math.round((idx / total) * 100));

    if (file.size > LARGE) {
      // ── Try direct browser → Supabase upload (large files) ──
      try {
        const urlRes = await SMS.post('/sms/documents/upload-url', {
          folder_id: folder.id, file_name: file.name,
          file_size: file.size,
        });
        const { signed_url, public_url } = urlRes.data;

        // Upload directly with progress
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
              const pct = Math.round(((idx + e.loaded/e.total) / total) * 100);
              setProgPct(pct);
              setProgress(`${idx+1}/${total}: ${file.name} — ${Math.round(e.loaded/e.total*100)}%`);
            }
          };
          xhr.onload  = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: HTTP ${xhr.status} — ${xhr.responseText?.slice(0,200)}`));
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.open('PUT', signed_url);
          // Supabase signed upload uses PUT with the token in the URL — no auth header needed
          xhr.setRequestHeader('x-upsert', 'true');
          xhr.send(file);
        });

        // Confirm: save DB record
        await SMS.post('/sms/documents/confirm-upload', {
          folder_id: folder.id, name: file.name,
          file_url: public_url, file_size: file.size, file_name: file.name,
        });
      } catch (directErr) {
        // Fallback: try through backend (may timeout for very large files)
        console.warn('Direct upload failed, trying backend:', directErr.message);
        const fd = new FormData();
        fd.append('file', file); fd.append('folder_id', folder.id); fd.append('name', file.name);
        await SMS.post('/sms/documents', fd, {
          headers: {'Content-Type':'multipart/form-data'},
          timeout: 120000, // 2 min
        });
      }
    } else {
      // ── Small file: backend proxy ────────────────────────────
      const fd = new FormData();
      fd.append('file', file); fd.append('folder_id', folder.id); fd.append('name', file.name);
      await SMS.post('/sms/documents', fd, { headers: {'Content-Type':'multipart/form-data'} });
    }
  };

  const handleUpload = async () => {
    if (!files.length) { toast.error('Select files first'); return; }
    setUploading(true);
    let ok=0, fail=0;
    const errors = [];
    for (let i=0; i<files.length; i++) {
      try { await uploadOne(files[i], i, files.length); ok++; }
      catch(err) {
        console.error('upload error:', err.message);
        errors.push(`${files[i].name}: ${err.response?.data?.error || err.message}`);
        fail++;
      }
    }
    setUploading(false); setProgPct(100);
    if (ok)   toast.success(`${ok} file${ok>1?'s':''} uploaded!`);
    if (fail) toast.error(errors[0] || `${fail} file${fail>1?'s':''} failed`, { duration: 8000 });
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{backgroundColor:folder.color+'20'}}>
              <Upload className="w-4 h-4" style={{color:folder.color}}/>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Upload Files</h2>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">→ {folder.name}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={uploading} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files);}}
            onClick={()=>inputRef.current.click()}
            className="border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/30 rounded-xl p-8 text-center cursor-pointer transition-all">
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2"/>
            <p className="text-sm font-semibold text-gray-600">Click or drag &amp; drop</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images, ZIP, RAR — up to 500 MB</p>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.7z,.tar,.gz"
            onChange={e=>addFiles(e.target.files)}/>

          {files.length>0 && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {files.map((f,i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <FileIcon type={f.name.split('.').pop()?.toLowerCase()} size={4}/>
                  <span className="text-xs flex-1 truncate font-medium text-gray-700">{f.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                  {f.size > LARGE && (
                    <span className="text-[9px] text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                      Direct
                    </span>
                  )}
                  <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"/>
                <p className="text-xs text-blue-700 truncate flex-1">{progress}</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{width:`${progPct}%`}}/>
              </div>
              <p className="text-[11px] text-gray-400 text-right">{progPct}%</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={uploading} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleUpload} disabled={uploading||!files.length} className="btn-primary flex-1 justify-center">
            {uploading ? 'Uploading…' : <><Upload className="w-4 h-4"/> Upload {files.length>0?`${files.length} File${files.length>1?'s':''}`:''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Folder Modal ──────────────────────────────────────────────
function FolderModal({ folder, years, classes, terms, activeTab, onSave, onClose }) {
  const yr = new Date().getFullYear();
  const [form, setForm] = useState({
    folder_type:      folder?.folder_type      || activeTab || 'school',
    name:             folder?.name             || '',
    description:      folder?.description      || '',
    color:            folder?.color            || '#2563eb',
    academic_year_id: folder?.academic_year_id || years.find(y=>y.is_current)?.id || '',
    class_id:         folder?.class_id         || '',
    term_id:          folder?.term_id          || '',
    month_label:      folder?.month_label      || '',
    password:         '',
    remove_password:  false,
  });
  const [saving, setSaving] = useState(false);
  const f = k => e => setForm(p => ({...p,[k]:e.target.value}));

  const filteredTerms = terms.filter(t => !form.academic_year_id || t.academic_year_id === form.academic_year_id);

  // Auto-name for class folders
  const autoName = () => {
    if (form.folder_type === 'class') {
      const cls = classes.find(c=>c.id===form.class_id);
      const trm = terms.find(t=>t.id===form.term_id);
      if (cls && trm) return `${cls.name} — ${trm.name}`;
      if (cls) return cls.name;
    }
    if (form.folder_type === 'month' && form.month_label) return form.month_label;
    return form.name;
  };

  const handleSave = async () => {
    const finalName = form.name.trim() || autoName();
    if (!finalName) { toast.error('Folder name required'); return; }
    setSaving(true);
    try {
      const body = {
        name:             finalName,
        description:      form.description || null,
        color:            form.color,
        folder_type:      form.folder_type,
        academic_year_id: form.academic_year_id || null,
        class_id:         form.folder_type==='class' ? (form.class_id||null) : null,
        term_id:          form.folder_type==='class' ? (form.term_id||null)  : null,
        month_label:      form.folder_type==='month' ? (form.month_label||null) : null,
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

  const SEL = 'select-field appearance-none';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{folder ? 'Edit Folder' : 'New Folder'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">

          {/* Folder type selector */}
          {!folder && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Folder Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val:'class',  icon: GraduationCap, label:'Class', sub:'Per class + term' },
                  { val:'school', icon: School,         label:'School', sub:'Per academic year' },
                  { val:'month',  icon: Clock,          label:'Monthly', sub:'Per month' },
                ].map(t => (
                  <button key={t.val} type="button" onClick={()=>setForm(p=>({...p,folder_type:t.val}))}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition-all
                      ${form.folder_type===t.val
                        ? 'bg-[#0a2156] border-[#0a2156] text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <t.icon className="w-5 h-5"/>
                    <span>{t.label}</span>
                    <span className={`text-[10px] font-normal ${form.folder_type===t.val?'text-blue-200':'text-gray-400'}`}>{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Academic year (all types) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <select className={SEL} value={form.academic_year_id} onChange={f('academic_year_id')}>
              <option value="">— Select Year —</option>
              {years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
            </select>
          </div>

          {/* CLASS type: class + term selectors */}
          {form.folder_type==='class' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Class *</label>
                <select className={SEL} value={form.class_id} onChange={f('class_id')}>
                  <option value="">— Select Class —</option>
                  {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Term</label>
                <select className={SEL} value={form.term_id} onChange={f('term_id')}>
                  <option value="">— All Terms —</option>
                  {filteredTerms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* MONTH type: month picker */}
          {form.folder_type==='month' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Month</label>
              <select className={SEL} value={form.month_label} onChange={f('month_label')}>
                <option value="">— Select Month —</option>
                {MONTHS.map(m=><option key={m} value={`${m} ${yr}`}>{m} {yr}</option>)}
              </select>
            </div>
          )}

          {/* Name + description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Folder Name {form.folder_type!=='school' && <span className="text-gray-400">(auto-filled if blank)</span>}
            </label>
            <input className="input-field" value={form.name} onChange={f('name')}
              placeholder={autoName() || 'e.g. Student Records'}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input className="input-field" value={form.description} onChange={f('description')} placeholder="Optional"/>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map(c=>(
                <button key={c} onClick={()=>setForm(p=>({...p,color:c}))}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${form.color===c?'border-gray-900 scale-110 shadow-md':'border-transparent hover:border-gray-300'}`}
                  style={{backgroundColor:c}}/>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-gray-400"/>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Password (optional)</p>
            </div>
            {folder?.is_locked && !form.remove_password ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3"/> Locked
                </span>
                <button onClick={()=>setForm(p=>({...p,remove_password:true,password:''}))}
                  className="text-xs text-red-500 hover:underline">Remove</button>
                <input className="input-field flex-1 min-w-32 text-xs" type="password"
                  value={form.password} onChange={f('password')} placeholder="New password (blank = keep)"/>
              </div>
            ) : form.remove_password ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600">Password will be removed</span>
                <button onClick={()=>setForm(p=>({...p,remove_password:false}))} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </div>
            ) : (
              <input className="input-field" type="password" value={form.password} onChange={f('password')}
                placeholder="Set password to protect this folder"/>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File Panel (shared) ───────────────────────────────────────
function FilePanel({ folder, viewMode, documents, onUpload, onDelete }) {
  const filteredDocs = documents;
  if (!folder) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <FolderOpen className="w-7 h-7 text-gray-300"/>
      </div>
      <p className="font-bold text-gray-500">Select a folder</p>
      <p className="text-gray-400 text-sm mt-1">Click any folder to view its files</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Folder header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{backgroundColor:folder.color+'20', border:`2px solid ${folder.color}40`}}>
            <FolderOpen className="w-4.5 h-4.5 w-5 h-5" style={{color:folder.color}}/>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">{folder.name}</h2>
            <p className="text-xs text-gray-400">
              {filteredDocs.length} file{filteredDocs.length!==1?'s':''}
              {folder.academic_year && ` · ${folder.academic_year.name}`}
              {folder.term && ` · ${folder.term.name}`}
            </p>
          </div>
        </div>
        <button onClick={onUpload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-xs font-bold shadow-sm transition-colors">
          <FilePlus className="w-3.5 h-3.5"/> Upload
        </button>
      </div>

      {filteredDocs.length===0 ? (
        <div className="py-14 text-center">
          <Upload className="w-9 h-9 text-gray-200 mx-auto mb-3"/>
          <p className="text-sm font-semibold text-gray-400">No files yet</p>
          <button onClick={onUpload} className="text-blue-600 text-xs mt-1 hover:underline">Upload first file →</button>
        </div>
      ) : viewMode==='grid' ? (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredDocs.map(doc=>(
            <div key={doc.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 hover:shadow-md transition-all flex flex-col gap-2">
              <div className="flex items-center justify-center h-12 bg-white rounded-xl border border-gray-100">
                <FileIcon type={doc.file_type} size={7}/>
              </div>
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 text-center leading-tight">{doc.name}</p>
              <p className="text-[10px] text-gray-400 text-center">{fmtSize(doc.file_size)}</p>
              <div className="flex justify-center gap-1 pt-1 border-t border-gray-100">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-3.5 h-3.5"/></a>
                <a href={doc.file_url} download={doc.name}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Download"><Download className="w-3.5 h-3.5"/></a>
                <button onClick={()=>onDelete(doc)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          <div className="grid grid-cols-[2rem_1fr_6rem_10rem_7rem] gap-3 px-5 py-2.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span/><span>Name</span><span className="text-center">Size</span><span>Date</span><span className="text-center">Actions</span>
          </div>
          {filteredDocs.map((doc,i)=>(
            <div key={doc.id}
              className={`grid grid-cols-[2rem_1fr_6rem_10rem_7rem] gap-3 items-center px-5 py-3 hover:bg-gray-50/60
                ${i%2===0?'bg-white':'bg-gray-50/30'}`}>
              <FileIcon type={doc.file_type} size={4}/>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                {doc.uploader&&<p className="text-[10px] text-gray-400">{doc.uploader.full_name}</p>}
              </div>
              <p className="text-xs text-gray-500 text-center">{fmtSize(doc.file_size)}</p>
              <p className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
              <div className="flex justify-center gap-1">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5"/></a>
                <a href={doc.file_url} download={doc.name}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Download className="w-3.5 h-3.5"/></a>
                <button onClick={()=>onDelete(doc)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Folder List (left panel) ──────────────────────────────────
function FolderList({ folders, groups, expanded, setExpanded, activeFolder,
                      unlockedIds, onFolderClick, onEdit, onDelete, onNew, loading }) {
  if (loading) return (
    <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
  );
  if (groups.length===0) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
      <Folder className="w-9 h-9 text-gray-200 mx-auto mb-3"/>
      <p className="font-semibold text-gray-500 text-sm">No folders yet</p>
      <button onClick={onNew} className="text-blue-600 text-xs mt-2 hover:underline">Create first folder →</button>
    </div>
  );
  return (
    <div className="space-y-3">
      {groups.map(group=>(
        <div key={group.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button onClick={()=>setExpanded(e=>({...e,[group.key]:!e[group.key]}))}
            className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <group.Icon className={`w-4 h-4 shrink-0 ${group.accent}`}/>
            <span className={`font-bold text-sm flex-1 text-left ${group.accent}`}>{group.label}</span>
            {group.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${group.badgeCls}`}>{group.badge}</span>}
            <span className="text-xs text-gray-400">{group.folders.length}</span>
            {expanded[group.key]
              ? <ChevronDown className="w-4 h-4 text-gray-400"/>
              : <ChevronRight className="w-4 h-4 text-gray-400"/>}
          </button>
          {expanded[group.key] && (
            <div className="divide-y divide-gray-50">
              {group.folders.map(f=>{
                const isActive = activeFolder?.id===f.id;
                const isLocked = f.is_locked && !unlockedIds.has(f.id);
                const docCount = f.doc_count?.[0]?.count || 0;
                return (
                  <div key={f.id} onClick={()=>onFolderClick(f)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group
                      ${isActive?'bg-blue-50 border-l-4 border-blue-600':'hover:bg-gray-50/60 border-l-4 border-transparent'}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                      style={{backgroundColor:f.color+'20',border:`2px solid ${f.color}40`}}>
                      {isLocked
                        ? <Lock className="w-4 h-4" style={{color:f.color}}/>
                        : <FolderOpen className="w-4 h-4" style={{color:f.color}}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate leading-tight ${isActive?'text-blue-700':'text-gray-900'}`}>{f.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {docCount} file{docCount!==1?'s':''}
                        {isLocked&&<span className="ml-1 text-amber-500">· 🔒</span>}
                      </p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={e=>{e.stopPropagation();onEdit(f);}}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={e=>{e.stopPropagation();onDelete(f);}}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function Documents() {
  const [folders,      setFolders]      = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [years,        setYears]        = useState([]);
  const [classes,      setClasses]      = useState([]);
  const [terms,        setTerms]        = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderModal,  setFolderModal]  = useState(null);
  const [uploadModal,  setUploadModal]  = useState(false);
  const [unlockModal,  setUnlockModal]  = useState(null);
  const [unlockedIds,  setUnlockedIds]  = useState(new Set());
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState('class');  // 'class' | 'school' | 'month'
  const [viewMode,     setViewMode]     = useState('list');
  const [search,       setSearch]       = useState('');
  const [expanded,     setExpanded]     = useState({});

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      SMS.get('/sms/documents/folders').then(r => setFolders(r.data.data||[])),
      getAcademicYears().then(r  => {
        const yrs = r.data.data||[];
        setYears(yrs);
        const cur = yrs.find(y=>y.is_current);
        if (cur) setExpanded(e=>({...e, [`school_${cur.id}`]:true, class_all:true, month_all:true}));
      }),
      getSmsClasses().then(r  => setClasses(r.data.data||[])),
      getTerms().then(r       => setTerms(r.data.data||[])),
    ]).finally(() => setLoading(false));
  }, []);

  const loadFolders = () =>
    SMS.get('/sms/documents/folders').then(r => setFolders(r.data.data||[]))
       .catch(err => {
         const msg = err.response?.data?.error || '';
         if (msg.includes('relationship') || msg.includes('schema cache') || msg.includes('class_id')) {
           toast.error('Run the SQL migration in Supabase first — see database.sql', { duration: 8000 });
         } else {
           toast.error('Failed to load folders');
         }
       });

  useEffect(() => {
    if (activeFolder) {
      SMS.get('/sms/documents', {params:{folder_id:activeFolder.id}})
        .then(r => setDocuments(r.data.data||[]))
        .catch(() => toast.error('Failed to load files'));
    }
  }, [activeFolder]);

  const handleFolderClick = f => {
    if (f.is_locked && !unlockedIds.has(f.id)) { setUnlockModal(f); return; }
    setActiveFolder(f); setDocuments([]);
  };
  const handleUnlocked = id => {
    setUnlockedIds(p => new Set([...p,id]));
    setUnlockModal(null);
    const f = folders.find(x=>x.id===id);
    if (f) { setActiveFolder(f); setDocuments([]); }
  };
  const handleDeleteFolder = async f => {
    if (!window.confirm(`⚠️ Delete "${f.name}" and ALL its files permanently?`)) return;
    try {
      await SMS.delete(`/sms/documents/folders/${f.id}`);
      toast.success('Folder deleted');
      if (activeFolder?.id===f.id) { setActiveFolder(null); setDocuments([]); }
      loadFolders();
    } catch(err) { toast.error(err.response?.data?.error||'Failed'); }
  };
  const handleDeleteDoc = async doc => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    try {
      await SMS.delete(`/sms/documents/${doc.id}`);
      toast.success('Deleted');
      setDocuments(p=>p.filter(d=>d.id!==doc.id));
    } catch { toast.error('Failed'); }
  };

  // ── Tab definitions ─────────────────────────────────────────
  const TABS = [
    { key:'class',  label:'Class Docs',  icon: GraduationCap },
    { key:'school', label:'School Docs', icon: School },
    { key:'month',  label:'Monthly',     icon: Clock },
  ];

  // ── Group folders by tab type ────────────────────────────────
  const tabFolders = useMemo(() => {
    let list = folders.filter(f => (f.folder_type||'school') === activeTab);
    if (search) list = list.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [folders, activeTab, search]);

  // Build hierarchical groups per tab
  const groups = useMemo(() => {
    if (activeTab==='class') {
      // Group by class
      const byClass = {};
      tabFolders.forEach(f => {
        const key  = f.class_id || '__none';
        const label = f.class?.name || 'Unassigned';
        if (!byClass[key]) byClass[key] = { key, label, folders:[], Icon:GraduationCap, accent:'text-blue-600', badge:null, badgeCls:'' };
        byClass[key].folders.push(f);
      });
      return Object.values(byClass).sort((a,b)=>a.label.localeCompare(b.label));
    }
    if (activeTab==='school') {
      // Group by academic year
      const byYear = {};
      tabFolders.forEach(f => {
        const key   = f.academic_year_id || '__general';
        const label = f.academic_year?.name || 'General';
        const cur   = !!f.academic_year?.is_current;
        if (!byYear[key]) byYear[key] = { key, label, folders:[], isCurrent:cur, Icon:Calendar,
          accent: cur?'text-blue-600':'text-gray-600',
          badge:  cur?'Current':null, badgeCls:'bg-blue-600 text-white' };
        byYear[key].folders.push(f);
      });
      return Object.values(byYear).sort((a,b)=>{
        if(a.key==='__general') return 1; if(b.key==='__general') return -1;
        if(a.isCurrent) return -1; if(b.isCurrent) return 1;
        return b.label.localeCompare(a.label);
      });
    }
    if (activeTab==='month') {
      // Group by year extracted from month_label
      const byYear = {};
      tabFolders.forEach(f => {
        const parts = (f.month_label||'').split(' ');
        const yr    = parts[1] || 'Unknown';
        if (!byYear[yr]) byYear[yr] = { key:yr, label:`Year ${yr}`, folders:[], Icon:Clock, accent:'text-gray-600', badge:null, badgeCls:'' };
        byYear[yr].folders.push(f);
      });
      return Object.values(byYear).sort((a,b)=>b.label.localeCompare(a.label));
    }
    return [];
  }, [tabFolders, activeTab]);

  // Auto-expand first group
  useEffect(() => {
    if (groups.length>0 && !expanded[groups[0].key]) {
      setExpanded(e=>({...e,[groups[0].key]:true}));
    }
  }, [groups.length, activeTab]);

  const totalFiles = folders.reduce((s,f)=>s+(f.doc_count?.[0]?.count||0),0);

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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white w-44 focus:outline-none focus:border-blue-400 shadow-sm"/>
            </div>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <button onClick={()=>setViewMode('grid')}
                className={`p-2 ${viewMode==='grid'?'bg-[#0a2156] text-white':'text-gray-400 hover:text-gray-700'}`}>
                <Grid3X3 className="w-4 h-4"/>
              </button>
              <button onClick={()=>setViewMode('list')}
                className={`p-2 ${viewMode==='list'?'bg-[#0a2156] text-white':'text-gray-400 hover:text-gray-700'}`}>
                <List className="w-4 h-4"/>
              </button>
            </div>
            <button onClick={()=>setFolderModal('new')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a2156] hover:bg-[#0c2a6a] text-white text-sm font-bold shadow-sm transition-colors">
              <FolderPlus className="w-4 h-4"/> New Folder
            </button>
          </div>
        </div>

        {/* ── Type tabs ─────────────────────────────────── */}
        <div className="flex gap-1 bg-white border border-gray-100 p-1 rounded-2xl shadow-sm w-fit">
          {TABS.map(tab=>{
            const Icon=tab.icon;
            const cnt=folders.filter(f=>(f.folder_type||'school')===tab.key).length;
            return (
              <button key={tab.key} onClick={()=>{setActiveTab(tab.key);setActiveFolder(null);setDocuments([]);}}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${activeTab===tab.key?'bg-[#0a2156] text-white shadow-sm':'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4"/>
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  ${activeTab===tab.key?'bg-white/20 text-white':'bg-gray-100 text-gray-500'}`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Two-column layout ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          <FolderList
            folders={tabFolders} groups={groups}
            expanded={expanded} setExpanded={setExpanded}
            activeFolder={activeFolder} unlockedIds={unlockedIds}
            onFolderClick={handleFolderClick}
            onEdit={f=>setFolderModal(f)}
            onDelete={handleDeleteFolder}
            onNew={()=>setFolderModal('new')}
            loading={loading}
          />
          <FilePanel
            folder={activeFolder} viewMode={viewMode}
            documents={documents}
            onUpload={()=>setUploadModal(true)}
            onDelete={handleDeleteDoc}
          />
        </div>
      </div>

      {/* Modals */}
      {folderModal && (
        <FolderModal
          folder={folderModal==='new'?null:folderModal}
          years={years} classes={classes} terms={terms}
          activeTab={activeTab}
          onSave={()=>{setFolderModal(null);loadFolders();}}
          onClose={()=>setFolderModal(null)}
        />
      )}
      {uploadModal && activeFolder && (
        <UploadModal folder={activeFolder}
          onSave={()=>{setUploadModal(false);SMS.get('/sms/documents',{params:{folder_id:activeFolder.id}}).then(r=>setDocuments(r.data.data||[]));loadFolders();}}
          onClose={()=>setUploadModal(false)}
        />
      )}
      {unlockModal && (
        <UnlockModal folder={unlockModal} onUnlocked={handleUnlocked} onClose={()=>setUnlockModal(null)}/>
      )}
    </div>
  );
}
