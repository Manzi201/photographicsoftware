import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, X, Check, Key, Shield, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (typeof window!=='undefined'&&window.location.hostname!=='localhost'?'https://photographicsoftware-1.onrender.com/api':'/api'),
  timeout: 45000,
});
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('cert_token') || localStorage.getItem('staff_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const ROLES = { admin:'Admin', dos:'Director of Studies', teacher:'Teacher', secretary:'Secretary', finance:'Finance' };
const ROLE_COLORS = {
  admin:     'bg-red-100 text-red-700',
  dos:       'bg-purple-100 text-purple-700',
  teacher:   'bg-blue-100 text-blue-700',
  secretary: 'bg-green-100 text-green-700',
  finance:   'bg-amber-100 text-amber-700',
};

function StaffModal({ staff, onSave, onClose }) {
  const [form, setForm] = useState(staff || { full_name:'', email:'', phone:'', role:'teacher', username:'', password:'' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.full_name||!form.username||(!staff&&!form.password)||!form.role) { toast.error('Fill required fields'); return; }
    setLoading(true);
    try {
      if (staff) await API.put(`/sms/admin/staff/${staff.id}`, form);
      else await API.post('/sms/admin/staff', form);
      toast.success(staff?'Staff updated!':'Staff account created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error||'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-600"/>{staff?'Edit Staff':'Create Staff Account'}</h2>
          <button onClick={onClose}><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
              <input className="input-field" value={form.full_name} onChange={f('full_name')} placeholder="e.g. Jean Paul Manzi" autoFocus/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
              <select className="select-field" value={form.role} onChange={f('role')}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input className="input-field" value={form.phone||''} onChange={f('phone')} placeholder="07XXXXXXXX"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" className="input-field" value={form.email||''} onChange={f('email')} placeholder="email@example.com"/>
            </div>
            <div/>
            <div className="col-span-2 border-t pt-3">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Login Credentials</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Username *</label>
              <input className="input-field font-mono" value={form.username} onChange={f('username')} placeholder="e.g. jmanzi" autoCapitalize="none"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{staff?'New Password (leave blank to keep)':'Password *'}</label>
              <input type="password" className="input-field" value={form.password||''} onChange={f('password')} placeholder="••••••••"/>
            </div>
          </div>
          {/* Role permissions info */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-600 mb-1">Permissions for {ROLES[form.role]}:</p>
            <p className="text-xs text-gray-500">
              {form.role==='admin'?'Full access to everything'
              :form.role==='dos'?'Manage classes, enter marks, promote students'
              :form.role==='teacher'?'Enter marks for assigned subjects only'
              :form.role==='secretary'?'Register students, upload CSV/photos, print bulletins, edit marks'
              :'Manage fees, record payments, download Excel reports'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading?'Saving...':<><Check className="w-4 h-4"/> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStaff() {
  const { user, school } = useAuth();           // school owner from Supabase
  const [staff,   setStaff]  = useState([]);
  const [modal,   setModal]  = useState(null);
  const [loading, setLoading]= useState(true);
  const [resetId, setResetId]= useState(null);
  const [newPwd,  setNewPwd] = useState('');

  useEffect(() => { loadStaff(); }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const r = await API.get('/sms/admin/staff');
      setStaff(r.data.data||[]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Network error';
      if (err.response?.status === 401)        toast.error('Session expired. Please sign in again.');
      else if (err.response?.status === 403)   toast.error('Access denied — Admin role required');
      else if (err.code === 'ECONNABORTED')    toast.error('Server waking up (Render). Wait 30s and retry.');
      else toast.error(`Failed to load staff: ${msg}`);
    } finally { setLoading(false); }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this staff account?')) return;
    await API.delete(`/sms/admin/staff/${id}`);
    toast.success('Staff deactivated'); loadStaff();
  };

  const handleResetPwd = async () => {
    if (!newPwd || newPwd.length < 6) { toast.error('Min 6 chars'); return; }
    await API.post(`/sms/admin/staff/${resetId}/reset-password`, { new_password: newPwd });
    toast.success('Password reset!'); setResetId(null); setNewPwd('');
  };

  // School owner is always "1 Admin" even if not in staff table
  const byRole = Object.keys(ROLES).reduce((acc, r) => ({
    ...acc,
    [r]: staff.filter(s => s.role === r),
  }), {});

  // Admin count = staff admins + 1 (school owner)
  const adminCount = byRole['admin'].length + 1;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-500 mt-0.5">Create accounts for teachers, secretaries, finance, DoS</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadStaff} disabled={loading} className="btn-secondary text-sm">
            {loading ? '⟳ Loading...' : '↺ Refresh'}
          </button>
          <button onClick={() => setModal('new')} className="btn-primary">
            <UserPlus className="w-4 h-4"/> Add Staff
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-6">
        {Object.entries(ROLES).map(([k, v]) => (
          <div key={k} className={`card text-center py-3 sm:py-4 border-0 ${ROLE_COLORS[k].replace('text-','border-').replace('bg-','bg-')}`}>
            <p className={`text-xl sm:text-2xl font-bold ${ROLE_COLORS[k].split(' ')[1]}`}>
              {/* Admin card = staff admins + 1 school owner */}
              {k === 'admin' ? adminCount : byRole[k]?.length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{v}</p>
          </div>
        ))}
      </div>

      {/* ── Admin section: always show school owner ────────── */}
      <div className="card mb-4 overflow-hidden p-0">
        <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS['admin']}`}>Admin</span>
          <span className="text-xs text-gray-400">{adminCount} member{adminCount !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Name','Username / Email','Phone','Last Login','Status','Actions'].map(h => (
                <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ── School owner row (always present) ── */}
            <tr className="border-b border-amber-50 bg-amber-50/40">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0"/>
                  <span className="font-bold text-gray-900">{school?.school_name || 'School Owner'}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-xs text-gray-500 font-mono">{user?.email || '—'}</td>
              <td className="py-3 px-4 text-xs text-gray-400">—</td>
              <td className="py-3 px-4 text-xs text-gray-400">—</td>
              <td className="py-3 px-4">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Owner
                </span>
              </td>
              <td className="py-3 px-4 text-xs text-gray-300 italic">Cannot be removed</td>
            </tr>

            {/* ── Staff admin rows (from staff table) ── */}
            {byRole['admin'].map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold text-gray-900">{s.full_name}</td>
                <td className="py-3 px-4 font-mono text-blue-600 text-xs">{s.username}</td>
                <td className="py-3 px-4 text-xs text-gray-500">{s.phone || '—'}</td>
                <td className="py-3 px-4 text-xs text-gray-400">{s.last_login ? new Date(s.last_login).toLocaleDateString('en-GB') : 'Never'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4 flex items-center gap-1">
                  <button onClick={() => setModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                  <button onClick={() => { setResetId(s.id); setNewPwd(''); }} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg" title="Reset password"><Key className="w-3.5 h-3.5"/></button>
                  {s.is_active && <button onClick={() => handleDeactivate(s.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Deactivate"><Trash2 className="w-3.5 h-3.5"/></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Other roles ────────────────────────────────────── */}
      {Object.entries(ROLES).filter(([r]) => r !== 'admin').map(([role, roleLabel]) => {
        const members = byRole[role] || [];
        if (!members.length) return null;
        return (
          <div key={role} className="card mb-4 overflow-hidden p-0">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>{roleLabel}</span>
              <span className="text-xs text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name','Username','Phone','Email','Last Login','Status','Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">{s.full_name}</td>
                    <td className="py-3 px-4 font-mono text-blue-600 text-xs">{s.username}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{s.phone || '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 truncate max-w-[140px]">{s.email || '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-400">{s.last_login ? new Date(s.last_login).toLocaleDateString('en-GB') : 'Never'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center gap-1">
                      <button onClick={() => setModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => { setResetId(s.id); setNewPwd(''); }} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg" title="Reset password"><Key className="w-3.5 h-3.5"/></button>
                      {s.is_active && <button onClick={() => handleDeactivate(s.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Deactivate"><Trash2 className="w-3.5 h-3.5"/></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {loading && <p className="text-center text-gray-400 py-8">Loading staff…</p>}
      {!loading && staff.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-30"/>
          <p className="text-sm">No staff accounts yet.</p>
          <p className="text-xs mt-1">Click <strong>Add Staff</strong> to create the first one.</p>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {modal && (
        <StaffModal
          staff={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); loadStaff(); }}
          onClose={() => setModal(null)}
        />
      )}
      {resetId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Key className="w-4 h-4"/> Reset Password</h3>
            <input type="password" className="input-field mb-4" value={newPwd}
              onChange={e => setNewPwd(e.target.value)} placeholder="New password (min 6 chars)" autoFocus/>
            <div className="flex gap-3">
              <button onClick={() => setResetId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleResetPwd} className="btn-primary flex-1 justify-center">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
