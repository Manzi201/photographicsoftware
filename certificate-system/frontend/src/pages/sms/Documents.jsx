import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, FolderPlus, Upload, Trash2, Download, FileText,
  Image, File, X, Check, Edit2, FilePlus, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://photographicsoftware-1.onrender.com/api'
    : '/api'
);

const api = axios.create({ baseURL: BASE, timeout: 60000 });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('cert_token') || localStorage.getItem('staff_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const FOLDER_COLORS = [
  '#2563eb','#16a34a','#dc2626','#9333ea','#d97706','#0891b2','#be185d','#475569'
];

const FILE_ICONS = {
  pdf:   <FileText className="w-5 h-5 text-red-500"/>,
  image: <Image className="w-5 h-5 text-green-500"/>,
  doc:   <FileText className="w-5 h-5 text-blue-500"/>,
  excel: <FileText className="w-5 h-5 text-green-600"/>,
  ppt:   <FileText className="w-5 h-5 text-orange-500"/>,
  other: <File className="w-5 h-5 text-gray-400"/>,
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

// ── Create/Edit Folder Modal ───────────────────────────────────
function FolderModal({ folder, onSave, onClose }) {
  const [name,   setName]   = useState(folder?.name || '');
  const [desc,   setDesc]   = useState(folder?.description || '');
  const [color,  setColor]  = useState(folder?.color || '#2563eb');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Folder name required'); return; }
    setSaving(true);
    try {
      if (folder) await api.put(`/sms/documents/folders/${folder.id}`, { name, description: desc, color });
      else        await api.post('/sms/documents/folders', { name, description: desc, color });
      toast.success(folder ? 'Folder updated!' : 'Folder created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">{folder ? 'Edit Folder' : 'New Folder'}</h2>
          <button onClick={onClose}><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Folder Name *</label>
            <input className="input-field" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Student Records 2025" autoFocus/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input className="input-field" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Optional description"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Folder Color</label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map(c => (
                <button key={c} onClick={()=>setColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${color===c?'border-gray-900 scale-110':'border-transparent hover:border-gray-400'}`}
                  style={{ backgroundColor: c }}/>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving...' : <><Check className="w-4 h-4"/> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────
function UploadModal({ folderId, folderName, onSave, onClose }) {
  const [files,    setFiles]    = useState([]);
  const [uploading,setUploading]= useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef();

  const handleUpload = async () => {
    if (!files.length) { toast.error('Select files to upload'); return; }
    setUploading(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i+1}/${files.length}: ${file.name}`);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder_id', folderId);
        fd.append('name', file.name);
        await api.post('/sms/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        ok++;
      } catch { fail++; }
    }
    setUploading(false);
    if (ok)   toast.success(`${ok} file${ok>1?'s':''} uploaded!`);
    if (fail) toast.error(`${fail} failed`);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Upload to "{folderName}"</h2>
          <button onClick={onClose} disabled={uploading}><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6">
          {/* Drop zone */}
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFiles(p=>[...p,...Array.from(e.dataTransfer.files)]);}}
            onClick={()=>inputRef.current.click()}
            className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 mb-4">
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2"/>
            <p className="text-sm font-medium text-blue-700">Click or drag files here</p>
            <p className="text-xs text-blue-500 mt-1">PDF, Word, Excel, Images, etc.</p>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={e=>setFiles(p=>[...p,...Array.from(e.target.files)])}/>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
              {files.map((f,i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  {FILE_ICONS[f.name.split('.').pop()?.toLowerCase()] || FILE_ICONS.other}
                  <span className="text-xs flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>
                  <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3 mb-4">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
              <p className="text-xs text-blue-700">{progress}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} disabled={uploading} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !files.length} className="btn-primary flex-1 justify-center">
            {uploading ? 'Uploading...' : <><Upload className="w-4 h-4"/> Upload {files.length} File{files.length>1?'s':''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function Documents() {
  const [folders,      setFolders]      = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderModal,  setFolderModal]  = useState(null); // null | 'new' | folder object
  const [uploadModal,  setUploadModal]  = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => { if (activeFolder) loadDocuments(activeFolder.id); }, [activeFolder]);

  const loadFolders = async () => {
    setLoading(true);
    try { const r = await api.get('/sms/documents/folders'); setFolders(r.data.data||[]); }
    catch { toast.error('Failed to load folders'); }
    finally { setLoading(false); }
  };

  const loadDocuments = async (folderId) => {
    try { const r = await api.get('/sms/documents', { params: { folder_id: folderId } }); setDocuments(r.data.data||[]); }
    catch { toast.error('Failed to load documents'); }
  };

  const handleDeleteFolder = async (f) => {
    if (!window.confirm(`Delete folder "${f.name}" and ALL its files?`)) return;
    await api.delete(`/sms/documents/folders/${f.id}`);
    toast.success('Folder deleted');
    if (activeFolder?.id === f.id) { setActiveFolder(null); setDocuments([]); }
    loadFolders();
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    await api.delete(`/sms/documents/${doc.id}`);
    toast.success('File deleted');
    setDocuments(p => p.filter(d => d.id !== doc.id));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Documents</h1>
          <p className="text-gray-500 mt-0.5">Organize and store school files in folders</p>
        </div>
        <button onClick={() => setFolderModal('new')} className="btn-primary">
          <FolderPlus className="w-4 h-4"/> New Folder
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Folders panel */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Folders ({folders.length})</h2>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          ) : folders.length === 0 ? (
            <div className="card text-center py-10">
              <Folder className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
              <p className="text-gray-400 text-sm">No folders yet</p>
              <button onClick={()=>setFolderModal('new')} className="text-blue-600 text-xs mt-2 hover:underline">Create first folder →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {folders.map(f => (
                <div key={f.id}
                  onClick={() => setActiveFolder(f)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm
                    ${activeFolder?.id===f.id?'border-blue-300 bg-blue-50 shadow-sm':'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: f.color+'20', border:`2px solid ${f.color}40` }}>
                    <Folder className="w-5 h-5" style={{ color: f.color }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{f.name}</p>
                    {f.description && <p className="text-xs text-gray-400 truncate">{f.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e=>{e.stopPropagation();setFolderModal(f);}} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={e=>{e.stopPropagation();handleDeleteFolder(f);}} className="p-1 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents panel */}
        <div className="lg:col-span-2">
          {!activeFolder ? (
            <div className="card text-center py-16 h-full flex flex-col items-center justify-center">
              <Folder className="w-14 h-14 text-gray-200 mb-3"/>
              <p className="text-gray-400 font-medium">Select a folder to view files</p>
              <p className="text-gray-300 text-sm mt-1">or create a new folder to get started</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: activeFolder.color+'20' }}>
                    <Folder className="w-4 h-4" style={{ color: activeFolder.color }}/>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm">{activeFolder.name}</h2>
                    <p className="text-xs text-gray-400">{documents.length} file{documents.length!==1?'s':''}</p>
                  </div>
                </div>
                <button onClick={()=>setUploadModal(true)} className="btn-primary text-sm">
                  <FilePlus className="w-4 h-4"/> Upload Files
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="card text-center py-12">
                  <Upload className="w-10 h-10 text-gray-200 mx-auto mb-2"/>
                  <p className="text-gray-400 text-sm">No files in this folder</p>
                  <button onClick={()=>setUploadModal(true)} className="text-blue-600 text-xs mt-2 hover:underline">Upload first file →</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
                      <div className="shrink-0">{FILE_ICONS[doc.file_type] || FILE_ICONS.other}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">
                          {fmtSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('en-GB')}
                          {doc.uploader && ` · ${doc.uploader.full_name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View/Download">
                          <Eye className="w-4 h-4"/>
                        </a>
                        <a href={doc.file_url} download={doc.name}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Download">
                          <Download className="w-4 h-4"/>
                        </a>
                        <button onClick={()=>handleDeleteDoc(doc)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4"/>
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

      {/* Modals */}
      {folderModal && (
        <FolderModal folder={folderModal==='new'?null:folderModal}
          onSave={()=>{setFolderModal(null);loadFolders();}}
          onClose={()=>setFolderModal(null)}/>
      )}
      {uploadModal && activeFolder && (
        <UploadModal folderId={activeFolder.id} folderName={activeFolder.name}
          onSave={()=>{setUploadModal(false);loadDocuments(activeFolder.id);}}
          onClose={()=>setUploadModal(false)}/>
      )}
    </div>
  );
}
