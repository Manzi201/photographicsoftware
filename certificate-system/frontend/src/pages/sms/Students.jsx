import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Search, Download, Upload, Edit2, Trash2, Phone, Mail, X, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsStudents, getSmsClasses, getAcademicYears, createSmsStudent, updateSmsStudent, deleteSmsStudent } from '../../api';
import { useAuth } from '../../context/AuthContext';

const GENDERS = ['M','F'];
const STATUSES = ['active','inactive','graduated','transferred'];

function StudentModal({ student, classes, years, onSave, onClose }) {
  const [form, setForm] = useState(student || {
    first_name:'', last_name:'', other_names:'', date_of_birth:'',
    gender:'M', nationality:'Rwandan', parent_name:'', parent_phone:'',
    parent_email:'', parent_phone2:'', address:'', current_class_id:'',
    academic_year_id:'', status:'active',
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) { toast.error('First & Last name required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => { if(v) fd.append(k,v); });
      if (photo) fd.append('photo', photo);
      if (student?.id) await updateSmsStudent(student.id, form);
      else await createSmsStudent(fd);
      toast.success(student ? 'Student updated!' : 'Student registered!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{student ? 'Edit Student' : 'Register New Student'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {/* Photo */}
          <div className="col-span-2 flex items-center gap-4">
            <div onClick={() => fileRef.current.click()} className="w-20 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400">
              {(photo || form.photo_url)
                ? <img src={photo ? URL.createObjectURL(photo) : form.photo_url} className="w-full h-full object-cover"/>
                : <span className="text-xs text-gray-400 text-center">Photo</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files[0])}/>
            <div className="text-xs text-gray-400">Click to upload student photo</div>
          </div>

          {[['First Name *','first_name'],['Last Name *','last_name'],['Other Names','other_names']].map(([l,k]) => (
            <div key={k} className={k==='other_names'?'col-span-2':''}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
              <input className="input-field" value={form[k]||''} onChange={f(k)} placeholder={l.replace(' *','')}/>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
            <input type="date" className="input-field" value={form.date_of_birth||''} onChange={f('date_of_birth')}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
            <select className="select-field" value={form.gender||'M'} onChange={f('gender')}>
              <option value="M">Male</option><option value="F">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
            <select className="select-field" value={form.current_class_id||''} onChange={f('current_class_id')}>
              <option value="">— Select Class —</option>
              {(classes||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {(classes||[]).length === 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠ No classes found. Create classes in Classes &amp; Years first.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <select className="select-field" value={form.academic_year_id||''} onChange={f('academic_year_id')}>
              <option value="">— Select Year —</option>
              {(years||[]).map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
            </select>
            {(years||[]).length === 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠ No academic years found.</p>
            )}
          </div>

          <div className="col-span-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Parent / Guardian</p>
          </div>
          {[['Parent Name','parent_name'],['Phone *','parent_phone'],['Email','parent_email'],['Phone 2','parent_phone2']].map(([l,k]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
              <input className="input-field" value={form[k]||''} onChange={f(k)} placeholder={l.replace(' *','')}/>
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
            <input className="input-field" value={form.address||''} onChange={f('address')} placeholder="Home address"/>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Saving...' : <><Check className="w-4 h-4"/> Save Student</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SmsStudents() {
  const { school } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [years,    setYears]    = useState([]);
  const [search,   setSearch]   = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // null | 'add' | student object

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, yRes] = await Promise.all([
        getSmsStudents(),
        getSmsClasses(),
        getAcademicYears(),
      ]);
      setStudents(sRes.data.data || []);
      setClasses(cRes.data.data  || []);
      setYears(yRes.data.data    || []);
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Network error';
      const isAuth = e.response?.status === 401 || e.response?.status === 403;
      if (isAuth) {
        toast.error('Session expired — please sign in again');
      } else if (e.code === 'ECONNABORTED') {
        toast.error('Server is starting up (Render). Retrying in 10s…', { duration: 10000 });
        setTimeout(() => loadAll(), 10000);
      } else {
        toast.error(`Failed to load: ${msg}`);
        console.error('Students loadAll error:', e.response?.status, msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (student) => {
    const name = `${student.first_name} ${student.last_name}`;
    if (!window.confirm(
      `⚠️ DELETE "${name}" PERMANENTLY?\n\nThis will also delete:\n• All marks\n• All report cards (bulletins)\n• All payments\n• All notifications\n\nThis cannot be undone.`
    )) return;
    try {
      await deleteSmsStudent(student.id);
      toast.success(`${name} deleted permanently`);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search || `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase().includes(q);
    const matchClass  = !classFilter || s.current_class_id === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
          <p className="text-gray-500 mt-0.5">{students.length} students registered</p>
        </div>
      <div className="flex gap-2">
          <button onClick={loadAll} disabled={loading} className="btn-secondary text-sm">
            {loading ? '⟳' : '↺ Refresh'}
          </button>
          <button onClick={() => setModal('add')} className="btn-primary">
            <UserPlus className="w-4 h-4"/> Register Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input className="input-field pl-9" placeholder="Search name, ID, phone..."
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="select-field w-48" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {classes.length === 0 && !loading && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            ⚠ No classes — <button onClick={loadAll} className="underline hover:text-amber-800">retry</button>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Photo','ID','Name','Class','Parent Phone','Fee Status','Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No students found</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="w-9 h-11 rounded-lg overflow-hidden bg-gray-100 border">
                        {s.photo_url ? <img src={s.photo_url} className="w-full h-full object-cover"/> : null}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-blue-600 font-bold">{s.student_id}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-gray-400">{s.gender} · {s.date_of_birth || '—'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                        {s.current_class?.name || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">{s.parent_phone || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${s.fee_status==='paid'?'bg-green-100 text-green-700':s.fee_status==='partial'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                        {s.fee_status || 'unpaid'}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center gap-1">
                      <button onClick={() => setModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => handleDelete(s)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <StudentModal
          student={modal === 'add' ? null : modal}
          classes={classes} years={years}
          onSave={() => { setModal(null); loadAll(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
