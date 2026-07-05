import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Check, ChevronDown, ChevronRight,
  GraduationCap, Calendar, BookOpen, Users, Layers, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAcademicYears, createAcademicYear, updateAcademicYear, deleteAcademicYear,
  getSmsClasses, createSmsClass, updateSmsClass, deleteSmsClass,
  getStaff,
} from '../../api';

// ── Generic modal ─────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Academic Year modal ───────────────────────────────────────
function YearModal({ year, onSave, onClose }) {
  const [form, setForm] = useState({
    name:       year?.name       || '',
    start_date: year?.start_date || '',
    end_date:   year?.end_date   || '',
    is_current: year?.is_current || false,
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Year name required'); return; }
    setLoading(true);
    try {
      if (year) await updateAcademicYear(year.id, form);
      else      await createAcademicYear(form);
      toast.success(year ? 'Year updated!' : 'Year created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={year ? 'Edit Academic Year' : 'New Academic Year'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Year Name *</label>
          <input className="input-field" value={form.name} onChange={f('name')}
            placeholder="e.g. 2025-2026 or 2026" autoFocus/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
            <input type="date" className="input-field" value={form.start_date} onChange={f('start_date')}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
            <input type="date" className="input-field" value={form.end_date} onChange={f('end_date')}/>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
            checked={form.is_current} onChange={e => setForm(p => ({ ...p, is_current: e.target.checked }))}/>
          <span className="text-sm font-medium text-gray-700">Set as current year</span>
        </label>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Class modal ───────────────────────────────────────────────
function ClassModal({ cls, years, staffList, onSave, onClose }) {
  const [form, setForm] = useState({
    name:             cls?.name             || '',
    level:            cls?.level            || '',
    level_order:      cls?.level_order      || 1,
    section:          cls?.section          || 'A',
    capacity:         cls?.capacity         || 40,
    academic_year_id: cls?.academic_year_id || years.find(y => y.is_current)?.id || '',
    class_teacher_id: cls?.class_teacher_id || '',
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Class name required'); return; }
    setLoading(true);
    try {
      if (cls) await updateSmsClass(cls.id, form);
      else     await createSmsClass(form);
      toast.success(cls ? 'Class updated!' : 'Class created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={cls ? 'Edit Class' : 'New Class'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class Name *</label>
            <input className="input-field" value={form.name} onChange={f('name')}
              placeholder="e.g. P1A, S3B, Form 2" autoFocus/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Level</label>
            <input className="input-field" value={form.level} onChange={f('level')}
              placeholder="e.g. Primary 1, Senior 3"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Section</label>
            <input className="input-field" value={form.section} onChange={f('section')} placeholder="A"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Order (for sorting)</label>
            <input type="number" className="input-field" value={form.level_order}
              onChange={f('level_order')} min={1}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Capacity</label>
            <input type="number" className="input-field" value={form.capacity}
              onChange={f('capacity')} min={1}/>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
            <select className="select-field" value={form.academic_year_id} onChange={f('academic_year_id')}>
              <option value="">— None —</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class Teacher (optional)</label>
            <select className="select-field" value={form.class_teacher_id} onChange={f('class_teacher_id')}>
              <option value="">— None assigned —</option>
              {staffList.filter(s => s.role === 'teacher' || s.role === 'dos').map(s =>
                <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
              )}
            </select>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : <><Check className="w-4 h-4"/> Save</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────
export default function SmsClasses() {
  const [years,     setYears]     = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selYear,   setSelYear]   = useState('all');
  const [expanded,  setExpanded]  = useState({});     // yearId → open/close

  // Modals
  const [yearModal,  setYearModal]  = useState(null); // null | 'new' | year object
  const [classModal, setClassModal] = useState(null); // null | 'new' | class object

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [yr, cl, st] = await Promise.all([getAcademicYears(), getSmsClasses(), getStaff()]);
      const yrs = yr.data.data || [];
      setYears(yrs);
      setClasses(cl.data.data || []);
      setStaffList(st.data.data || []);
      // Auto-expand current year
      const cur = yrs.find(y => y.is_current);
      if (cur) setExpanded(e => ({ ...e, [cur.id]: true }));
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteYear = async (y) => {
    const count = classes.filter(c => c.academic_year_id === y.id).length;
    if (!window.confirm(`Delete year "${y.name}"?${count ? ` It has ${count} classes.` : ''} This cannot be undone.`)) return;
    try {
      await deleteAcademicYear(y.id);
      toast.success('Year deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleDeleteClass = async (cls) => {
    if (!window.confirm(`Delete class "${cls.name}"? This cannot be undone.`)) return;
    try {
      await deleteSmsClass(cls.id);
      toast.success('Class deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // Filter classes by selected year
  const filteredYears = selYear === 'all'
    ? years
    : years.filter(y => y.id === selYear);

  const classesForYear = (yearId) =>
    classes.filter(c => c.academic_year_id === yearId);

  const unassigned = classes.filter(c => !c.academic_year_id);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600"/> Classes & Academic Years
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {years.length} academic year{years.length !== 1 ? 's' : ''} · {classes.length} classes total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setYearModal('new')}
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Calendar className="w-4 h-4"/> Add Year
          </button>
          <button onClick={() => setClassModal('new')}
            className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4"/> Add Class
          </button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setSelYear('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
            ${selYear === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
          All Years
        </button>
        {years.map(y => (
          <button key={y.id} onClick={() => setSelYear(y.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1
              ${selYear === y.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
            {y.is_current && <Star className="w-3 h-3 text-amber-400"/>}
            {y.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : (
        <div className="space-y-4">

          {/* ── Each academic year ────────────────────────── */}
          {filteredYears.map(year => {
            const yearClasses = classesForYear(year.id);
            const open = !!expanded[year.id];
            return (
              <div key={year.id} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

                {/* Year header */}
                <div className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none
                  ${year.is_current ? 'bg-blue-50 border-b border-blue-100' : 'bg-gray-50 border-b border-gray-100'}`}
                  onClick={() => setExpanded(e => ({ ...e, [year.id]: !open }))}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${year.is_current ? 'bg-blue-600' : 'bg-gray-400'}`}>
                    <Calendar className="w-4 h-4 text-white"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{year.name}</span>
                      {year.is_current && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                          <Star className="w-2.5 h-2.5"/> Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {yearClasses.length} class{yearClasses.length !== 1 ? 'es' : ''}
                      {year.start_date ? ` · ${year.start_date.slice(0,4)}` : ''}
                      {year.end_date   ? ` – ${year.end_date.slice(0,4)}`   : ''}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setYearModal(year)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Edit year">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => handleDeleteYear(year)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Delete year">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                </div>

                {/* Classes under this year */}
                {open && (
                  <div className="bg-white">
                    {yearClasses.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <GraduationCap className="w-8 h-8 text-gray-200 mx-auto mb-2"/>
                        <p className="text-sm text-gray-400">No classes yet for this year</p>
                        <button onClick={() => setClassModal({ _preset_year: year.id })}
                          className="text-xs text-blue-600 hover:underline mt-1">+ Add first class</button>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            {['Class','Level','Section','Capacity','Teacher','Actions'].map(h => (
                              <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-gray-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {yearClasses.map(cls => (
                            <tr key={cls.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-600"/>
                                  </div>
                                  <span className="font-semibold text-gray-900">{cls.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-500 text-xs">{cls.level || '—'}</td>
                              <td className="py-3 px-4 text-gray-500 text-xs">{cls.section || '—'}</td>
                              <td className="py-3 px-4 text-gray-500 text-xs">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3"/> {cls.capacity}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-500 text-xs truncate max-w-[120px]">
                                {cls.class_teacher?.full_name || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setClassModal(cls)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                                    <Edit2 className="w-3.5 h-3.5"/>
                                  </button>
                                  <button onClick={() => handleDeleteClass(cls)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete">
                                    <Trash2 className="w-3.5 h-3.5"/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {/* Add class button inside year */}
                    <div className="px-5 py-2.5 border-t border-dashed border-gray-100">
                      <button onClick={() => setClassModal({ _preset_year: year.id })}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5"/> Add class to {year.name}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Unassigned classes ─────────────────────────── */}
          {selYear === 'all' && unassigned.length > 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  No Year Assigned ({unassigned.length})
                </span>
              </div>
              <div className="bg-white divide-y divide-gray-50">
                {unassigned.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-gray-400"/>
                      <span className="font-medium text-gray-700">{cls.name}</span>
                      {cls.level && <span className="text-xs text-gray-400">· {cls.level}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setClassModal(cls)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDeleteClass(cls)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {years.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="font-semibold text-gray-500">No academic years yet</p>
              <p className="text-sm mt-1">Start by adding an academic year</p>
              <button onClick={() => setYearModal('new')} className="btn-primary mt-4 text-sm">
                <Calendar className="w-4 h-4"/> Add Academic Year
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {yearModal && (
        <YearModal
          year={yearModal === 'new' ? null : yearModal}
          onSave={() => { setYearModal(null); load(); }}
          onClose={() => setYearModal(null)}
        />
      )}
      {classModal && (
        <ClassModal
          cls={classModal === 'new' || classModal?._preset_year ? null : classModal}
          years={years}
          staffList={staffList}
          onSave={() => { setClassModal(null); load(); }}
          onClose={() => setClassModal(null)}
        />
      )}
    </div>
  );
}
