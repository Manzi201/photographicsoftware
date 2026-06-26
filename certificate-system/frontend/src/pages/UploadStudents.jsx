import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, UserPlus, FileText, Image as PhotoIcon,
  X, Check, AlertCircle, Camera, FolderOpen, Save,
  ChevronDown, User, Hash, BookOpen, Calendar
} from 'lucide-react';import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { createStudent, bulkUploadStudents } from '../api';
import { useAuth } from '../context/AuthContext';

const CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];
const TABS = [
  { key: 'individual', label: 'Individual',   icon: UserPlus  },
  { key: 'photos',     label: 'Batch Photos', icon: Camera    },
  { key: 'csv',        label: 'CSV Import',   icon: FileText  },
];

// ── Edit modal for a single photo ────────────────────────────
function EditModal({ item, onSave, onClose, defaultYear }) {
  const [f, setF] = useState({
    photo_number: item.photo_number,
    first_name:   item.first_name,
    last_name:    item.last_name,
    class:        item.class,
    year:         item.year || defaultYear,
  });

  const valid = f.photo_number.trim() && f.first_name.trim() && f.last_name.trim();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-18 rounded-lg overflow-hidden border-2 border-white/30 shadow-lg shrink-0">
              <img src={item.preview} alt="" className="w-14 h-[72px] object-cover" />
            </div>
            <div>
              <p className="text-white font-bold">Fill Student Details</p>
              <p className="text-blue-200 text-xs">Photo #{item.photo_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-3">
          {/* Photo Number */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
              <Hash className="w-3.5 h-3.5" /> Photo Number *
            </label>
            <input
              className="input-field font-mono text-lg font-bold tracking-widest"
              placeholder="001"
              value={f.photo_number}
              onChange={e => setF(p => ({ ...p, photo_number: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                <User className="w-3.5 h-3.5" /> First Name *
              </label>
              <input className="input-field"
                placeholder="John" value={f.first_name}
                onChange={e => setF(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                <User className="w-3.5 h-3.5" /> Last Name *
              </label>
              <input className="input-field"
                placeholder="Manzi" value={f.last_name}
                onChange={e => setF(p => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>

          {/* Class chips */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Class
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CLASSES.map(cls => (
                <button key={cls} type="button"
                  onClick={() => setF(p => ({ ...p, class: cls }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                    ${f.class === cls ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
              <Calendar className="w-3.5 h-3.5" /> Year
            </label>
            <input className="input-field w-28" type="number"
              value={f.year} onChange={e => setF(p => ({ ...p, year: e.target.value }))} />
          </div>

          {/* Save */}
          <button
            onClick={() => { if (!valid) { toast.error('Fill required fields'); return; } onSave({ ...item, ...f }); }}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
              ${valid ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <Check className="w-4 h-4" /> Save Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Photo card in grid ────────────────────────────────────────
function PhotoCard({ item, onEdit, onRemove }) {
  return (
    <div className={`relative rounded-xl overflow-hidden border-2 cursor-pointer group transition-all hover:shadow-lg
      ${item.saved ? 'border-green-400' : item.error ? 'border-red-400' : item.first_name ? 'border-blue-400' : 'border-gray-200 hover:border-blue-400'}`}
      onClick={() => !item.saved && onEdit(item)}>

      {/* Photo */}
      <div className="aspect-[3/4] overflow-hidden bg-gray-100">
        <img src={item.preview} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
      </div>

      {/* Overlay for unfilled */}
      {!item.saved && !item.first_name && (
        <div className="absolute inset-0 bg-blue-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white rounded-xl px-3 py-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold text-blue-700">Fill Details</span>
          </div>
        </div>
      )}

      {/* Status badge */}
      {item.saved && (
        <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1 shadow-md">
          <Check className="w-3.5 h-3.5" />
        </div>
      )}
      {item.error && (
        <div className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 shadow-md">
          <AlertCircle className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Remove button */}
      {!item.saved && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(item.id); }}
          className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow">
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Info bar */}
      <div className={`px-2 py-1.5 ${item.saved ? 'bg-green-50' : item.error ? 'bg-red-50' : 'bg-white'}`}>
        {item.first_name ? (
          <>
            <p className="text-xs font-bold text-gray-800 truncate">{item.first_name} {item.last_name}</p>
            <p className="text-xs text-gray-400">#{item.photo_number} · {item.class}</p>
          </>
        ) : (
          <p className="text-xs text-blue-500 font-semibold text-center">Click to add info</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function UploadStudents() {
  const { school } = useAuth();
  const [tab, setTab] = useState('individual');

  // Individual
  const [form, setForm]           = useState({ photo_number:'', first_name:'', last_name:'', class:'Top Class', year: school?.active_year||new Date().getFullYear() });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading]     = useState(false);

  // Batch photos
  const [photos, setPhotos]     = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [progress, setProgress] = useState('');

  // CSV
  const [csvData, setCsvData]   = useState([]);
  const [uploading, setUploading] = useState(false);
  const csvRef = useRef();

  const currentYear = school?.active_year || String(new Date().getFullYear());

  // ── Individual ─────────────────────────────────────────────
  const handlePhotoChange = e => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file));
  };
  const handleIndividualSubmit = async e => {
    e.preventDefault();
    if (!form.photo_number||!form.first_name||!form.last_name) { toast.error('Fill required fields'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k,v));
      if (photoFile) fd.append('photo', photoFile);
      await createStudent(fd);
      toast.success(`${form.first_name} ${form.last_name} saved!`);
      setForm({ photo_number:'', first_name:'', last_name:'', class:'Top Class', year:currentYear });
      setPhotoFile(null); setPhotoPreview(null);
    } catch (err) { toast.error(err.response?.data?.error||'Error saving student'); }
    finally { setLoading(false); }
  };

  // ── Batch photos ───────────────────────────────────────────
  const addFiles = useCallback(files => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) { toast.error('Select image files'); return; }
    const startIdx = photos.length;
    const newItems = imgs.map((file,i) => ({
      id: `${Date.now()}_${i}`, file,
      preview: URL.createObjectURL(file),
      photo_number: String(startIdx+i+1).padStart(3,'0'),
      first_name:'', last_name:'',
      class:'Top Class', year:currentYear,
      saved:false, saving:false, error:null,
    }));
    setPhotos(p => [...p,...newItems]);
    toast.success(`${imgs.length} photo${imgs.length>1?'s':''} added`);
  }, [photos.length, currentYear]);

  const updatePhoto = (id, changes) => setPhotos(p => p.map(x => x.id===id?{...x,...changes}:x));
  const removePhoto = id => setPhotos(p => p.filter(x => x.id!==id));

  const handleSaveModal = updated => {
    updatePhoto(updated.id, updated);
    setEditItem(null);
    toast.success('Details saved');
  };

  const saveAllPhotos = async () => {
    const ready = photos.filter(p => !p.saved && p.first_name && p.last_name && p.photo_number);
    if (!ready.length) { toast.error('Fill in names and numbers first'); return; }
    setSaving(true); let ok=0, fail=0;
    for (let i=0; i<ready.length; i++) {
      const item = ready[i];
      setProgress(`Saving ${i+1}/${ready.length}: ${item.first_name} ${item.last_name}...`);
      updatePhoto(item.id, { saving:true });
      try {
        const fd = new FormData();
        fd.append('photo_number', item.photo_number);
        fd.append('first_name',   item.first_name);
        fd.append('last_name',    item.last_name);
        fd.append('class',        item.class);
        fd.append('year',         item.year);
        fd.append('photo',        item.file);
        await createStudent(fd);
        updatePhoto(item.id, { saved:true, saving:false, error:null }); ok++;
      } catch (err) {
        updatePhoto(item.id, { error:err.response?.data?.error||'Failed', saving:false }); fail++;
      }
    }
    setSaving(false); setProgress('');
    if (ok)   toast.success(`✅ ${ok} student${ok>1?'s':''} saved!`);
    if (fail) toast.error(`${fail} failed`);
  };

  // ── CSV ────────────────────────────────────────────────────
  const handleCsvUpload = e => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, {
      header:true, skipEmptyLines:true,
      complete:({data}) => {
        const rows = data.map(r => ({
          photo_number: String(r['Photo Number']||r['photo_number']||'').trim(),
          first_name:   String(r['First Name']  ||r['first_name']  ||'').trim(),
          last_name:    String(r['Last Name']   ||r['last_name']   ||'').trim(),
          class:        String(r['Class']       ||r['class']       ||'Top Class').trim(),
          year:         String(r['Year']        ||r['year']        ||currentYear).trim(),
          status:'active',
        }));
        setCsvData(rows); toast.success(`${rows.length} students loaded`);
      },
      error: err => toast.error('CSV error: '+err.message),
    });
  };
  const handleBulkSubmit = async () => {
    if (!csvData.length) return;
    setUploading(true);
    try {
      const res = await bulkUploadStudents(csvData);
      toast.success(`${res.data.count} students uploaded!`); setCsvData([]);
    } catch (err) { toast.error(err.response?.data?.error||'Upload failed'); }
    finally { setUploading(false); }
  };

  const readyCount = photos.filter(p=>!p.saved&&p.first_name&&p.last_name&&p.photo_number).length;
  const savedCount = photos.filter(p=>p.saved).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Students</h1>
        <p className="text-gray-500 mt-1">Add individually, batch photos, or CSV import</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {TABS.map(({key,label,icon:Icon}) => (
          <button key={key} onClick={()=>setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab===key?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4"/>{label}
          </button>
        ))}
      </div>

      {/* ── INDIVIDUAL ── */}
      {tab==='individual' && (
        <div className="card max-w-2xl">
          <form onSubmit={handleIndividualSubmit} className="space-y-4">
            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-32 h-36 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={()=>document.getElementById('photo-input').click()}>
                  {photoPreview
                    ? <img src={photoPreview} alt="" className="w-full h-full object-cover"/>
                    : <div className="flex flex-col items-center gap-1 text-gray-400"><Upload className="w-6 h-6"/><span className="text-xs">Photo</span></div>}
                </div>
                <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
                {photoPreview && (
                  <button type="button" onClick={()=>{setPhotoFile(null);setPhotoPreview(null);}} className="text-xs text-red-500 flex items-center gap-1">
                    <X className="w-3 h-3"/> Remove
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photo Number *</label>
                  <input className="input-field" placeholder="001" value={form.photo_number}
                    onChange={e=>setForm({...form,photo_number:e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input className="input-field" placeholder="John" value={form.first_name}
                      onChange={e=>setForm({...form,first_name:e.target.value})}/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input className="input-field" placeholder="Manzi" value={form.last_name}
                      onChange={e=>setForm({...form,last_name:e.target.value})}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select className="select-field" value={form.class} onChange={e=>setForm({...form,class:e.target.value})}>
                      {CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input className="input-field" type="number" value={form.year}
                      onChange={e=>setForm({...form,year:e.target.value})}/></div>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading?'Saving...':<><UserPlus className="w-4 h-4"/> Save Student</>}
            </button>
          </form>
        </div>
      )}

      {/* ── BATCH PHOTOS ── */}
      {tab==='photos' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files);}}
            onClick={()=>document.getElementById('batch-input').click()}
            className="card border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-500 cursor-pointer transition-all">
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
                <Camera className="w-8 h-8 text-white"/>
              </div>
              <div className="text-center">
                <p className="font-bold text-blue-900 text-lg">Click or drag photos here</p>
                <p className="text-blue-600 text-sm mt-1">Select multiple photos at once — JPG, PNG</p>
                <p className="text-blue-400 text-xs mt-1">Works with 50+ photos at a time</p>
              </div>
            </div>
          </div>
          <input id="batch-input" type="file" accept="image/*" multiple className="hidden"
            onChange={e=>addFiles(e.target.files)}/>

          {/* Stats + actions */}
          {photos.length>0 && (
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
              <div className="flex items-center gap-5 text-sm">
                <span className="font-semibold text-gray-700">{photos.length} photos</span>
                {savedCount>0 && <span className="flex items-center gap-1 text-green-600 font-medium"><Check className="w-3.5 h-3.5"/> {savedCount} saved</span>}
                {readyCount>0 && <span className="text-blue-600 font-medium">{readyCount} ready</span>}
                {photos.filter(p=>p.error).length>0 && <span className="text-red-500">{photos.filter(p=>p.error).length} errors</span>}
              </div>
              <div className="flex gap-2">
                {savedCount>0 && (
                  <button onClick={()=>setPhotos(p=>p.filter(x=>!x.saved))}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    Clear saved
                  </button>
                )}
                <button onClick={saveAllPhotos} disabled={saving||readyCount===0}
                  className="btn-primary text-sm py-2">
                  {saving
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>{progress||'Saving...'}</>
                    : <><Save className="w-3.5 h-3.5"/> Save {readyCount} Students</>}
                </button>
              </div>
            </div>
          )}

          {/* Photo grid */}
          {photos.length>0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {photos.map(item => (
                <PhotoCard key={item.id} item={item}
                  onEdit={setEditItem} onRemove={removePhoto}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CSV ── */}
      {tab==='csv' && (
        <div className="space-y-4">
          <div className="card bg-blue-50 border-blue-100">
            <p className="text-sm font-semibold text-blue-800 mb-2">CSV Format:</p>
            <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block">
              Photo Number, First Name, Last Name, Class, Year
            </code>
            <p className="text-xs text-blue-600 mt-1">Example: 001, John, Manzi, Top Class, 2025</p>
          </div>
          <div className="card cursor-pointer hover:border-blue-400 border-2 border-dashed border-gray-300 transition-colors"
            onClick={()=>csvRef.current.click()}>
            <div className="flex flex-col items-center gap-3 py-6">
              <FileText className="w-10 h-10 text-gray-400"/>
              <span className="text-gray-600 font-medium">Click to upload CSV file</span>
            </div>
          </div>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload}/>
          {csvData.length>0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-800">Preview ({csvData.length} students)</h3>
                <button onClick={handleBulkSubmit} disabled={uploading} className="btn-primary">
                  {uploading?'Uploading...':<><Upload className="w-4 h-4"/> Upload All</>}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    {['Photo #','First Name','Last Name','Class','Year'].map(h=>(
                      <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                    ))}</tr></thead>
                  <tbody>
                    {csvData.slice(0,20).map((row,i)=>(
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
                {csvData.length>20 && <p className="text-xs text-gray-400 text-center py-2">...and {csvData.length-20} more</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <EditModal item={editItem} onSave={handleSaveModal} onClose={()=>setEditItem(null)} defaultYear={currentYear}/>
      )}
    </div>
  );
}
