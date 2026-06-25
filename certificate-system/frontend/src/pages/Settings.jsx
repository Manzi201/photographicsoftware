import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Upload, Image as ImageIcon, Pen, CheckCircle,
  Eye, PenLine, Stamp, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { updateSettings } from '../api';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const BG_PRESETS = [
  { id: 'none',     label: 'None',         gradient: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)' },
  { id: 'gold',     label: 'Gold',         gradient: 'linear-gradient(135deg,#fefce8,#fef08a)' },
  { id: 'blue',     label: 'Blue Marble',  gradient: 'linear-gradient(135deg,#eff6ff,#bfdbfe)' },
  { id: 'green',    label: 'Green',        gradient: 'linear-gradient(135deg,#f0fdf4,#bbf7d0)' },
  { id: 'rose',     label: 'Rose',         gradient: 'linear-gradient(135deg,#fff1f2,#fecdd3)' },
  { id: 'custom',   label: 'Custom',       gradient: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' },
];

// ── Section wrapper ────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="card mb-5">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
        <div className="bg-blue-50 p-2 rounded-lg">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Single image upload field ──────────────────────────────────
function ImageField({ label, hint, preview, onChange, accept = 'image/*', square = false }) {
  const ref = useRef();
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <div
          onClick={() => ref.current.click()}
          className={`${square ? 'w-20 h-20' : 'w-28 h-16'} bg-gray-50 rounded-xl border-2 border-dashed border-gray-200
            flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors`}>
          {preview
            ? <img src={preview} alt={label} className="w-full h-full object-contain p-1" />
            : <Upload className="w-5 h-5 text-gray-300" />}
        </div>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={onChange} />
        <div>
          <button type="button" onClick={() => ref.current.click()}
            className="btn-secondary text-sm py-1.5 px-3">
            <Upload className="w-3 h-3" /> {preview ? 'Change' : 'Upload'}
          </button>
          <p className="text-xs text-gray-400 mt-1">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { school, refreshSchool } = useAuth();
  const [form, setForm] = useState({ school_name: '', signatory_name: '', active_year: '' });
  const [files, setFiles]     = useState({ logo: null, stamp: null, signature: null, background: null });
  const [previews, setPreviews] = useState({ logo: null, stamp: null, signature: null, background: null });
  const [bgPreset, setBgPreset] = useState('none');
  const [loading, setLoading]  = useState(false);
  const [saved, setSaved]      = useState(false);
  const [uploading, setUploading] = useState('');

  useEffect(() => {
    if (school) {
      setForm({
        school_name:    school.school_name    || '',
        signatory_name: school.signatory_name || '',
        active_year:    school.active_year    || String(new Date().getFullYear()),
      });
      setPreviews({
        logo:       school.logo_url       || null,
        stamp:      school.stamp_url      || null,
        signature:  school.signature_url  || null,
        background: school.background_url || null,
      });
      setBgPreset(school.bg_preset || 'none');
    }
  }, [school]);

  const handleFile = (key) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFiles(f  => ({ ...f,  [key]: file }));
    setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }));
    if (key === 'background') setBgPreset('custom');
  };

  // Upload a single file to Supabase Storage and return public URL
  async function uploadAsset(file, name) {
    const { error } = await supabase.storage
      .from('assets')
      .upload(`${school.id}/${name}`, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase.storage.from('assets').getPublicUrl(`${school.id}/${name}`);
    return data.publicUrl;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.school_name.trim()) { toast.error('School name is required'); return; }
    setLoading(true);
    try {
      const update = {
        school_name:    form.school_name.trim(),
        signatory_name: form.signatory_name.trim(),
        active_year:    form.active_year,
        bg_preset:      bgPreset,
        logo_url:       school?.logo_url       || null,
        stamp_url:      school?.stamp_url      || null,
        signature_url:  school?.signature_url  || null,
        background_url: school?.background_url || null,
      };

      // Upload each changed file directly to Supabase Storage
      if (files.logo) {
        setUploading('Uploading logo...');
        update.logo_url = await uploadAsset(files.logo, 'logo.png');
      }
      if (files.stamp) {
        setUploading('Uploading stamp...');
        update.stamp_url = await uploadAsset(files.stamp, 'stamp.png');
      }
      if (files.signature) {
        setUploading('Uploading signature...');
        update.signature_url = await uploadAsset(files.signature, 'signature.png');
      }
      if (files.background) {
        setUploading('Uploading background...');
        update.background_url = await uploadAsset(files.background, 'background.jpg');
        update.bg_preset = 'custom';
      }
      if (bgPreset === 'none') update.background_url = null;

      // Save to schools table via Supabase
      const { error } = await supabase
        .from('schools')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', school.id);

      if (error) throw new Error(error.message);

      await refreshSchool();
      setFiles({ logo: null, stamp: null, signature: null, background: null });
      setSaved(true);
      toast.success('Settings saved!');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
      setUploading('');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">School info, logo, signature, stamp and certificate background</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── School Info ───────────────────────────── */}
        <Section title="School Information" icon={Pen}>
          <div className="space-y-4">
            <ImageField
              label="School Logo"
              hint="PNG recommended · 200×200px · shown on certificates"
              square
              preview={previews.logo}
              onChange={handleFile('logo')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Name <span className="text-red-500">*</span>
              </label>
              <input
                className="input-field font-semibold"
                placeholder="e.g. GREEN HILLS ACADEMY"
                value={form.school_name}
                onChange={(e) => setForm({ ...form, school_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signatory Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Head Teacher"
                  value={form.signatory_name}
                  onChange={(e) => setForm({ ...form, signatory_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📅 Active Year</label>
                <input
                  className="input-field"
                  type="number"
                  placeholder="2025"
                  value={form.active_year}
                  onChange={(e) => setForm({ ...form, active_year: e.target.value })}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Signature & Stamp ─────────────────────── */}
        <Section title="Signature & Stamp" icon={PenLine}>
          <div className="grid grid-cols-2 gap-6">
            <ImageField
              label="Signature Image"
              hint="PNG with transparent background"
              preview={previews.signature}
              onChange={handleFile('signature')}
            />
            <ImageField
              label="School Stamp / Seal"
              hint="PNG, circular stamp image"
              preview={previews.stamp}
              onChange={handleFile('stamp')}
            />
          </div>
        </Section>

        {/* ── Certificate Background ────────────────── */}
        <Section title="Certificate Background" icon={ImageIcon}>
          <p className="text-sm text-gray-500 mb-4">
            Hitamo background — izagira effect kuri <strong>certificates zose</strong> (18% opacity).
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {BG_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setBgPreset(p.id);
                  if (p.id !== 'custom') setFiles(f => ({ ...f, background: null }));
                }}
                className={`relative rounded-xl overflow-hidden border-2 transition-all
                  ${bgPreset === p.id ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="h-14 w-full" style={{ background: p.gradient }}>
                  {p.id === 'custom' && previews.background && (
                    <img src={previews.background} alt="Custom" className="w-full h-full object-cover" />
                  )}
                  {p.id === 'custom' && !previews.background && (
                    <div className="flex h-full items-center justify-center">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className={`text-xs font-medium px-1 py-1 text-center truncate
                  ${bgPreset === p.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                  {p.label}
                </div>
                {bgPreset === p.id && (
                  <CheckCircle className="absolute top-1 right-1 w-3.5 h-3.5 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>

          {bgPreset === 'custom' && (
            <ImageField
              label="Upload Custom Background"
              hint="JPG or PNG · appears at 18% opacity behind certificate content"
              preview={previews.background}
              onChange={handleFile('background')}
            />
          )}

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 mt-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Background izagaragara ku 18% opacity — inyandiko n'ifoto by'umunyeshuri bizakomeza kugaragara neza.
            </p>
          </div>
        </Section>

        {/* ── Preview ───────────────────────────────── */}
        <div className="card mb-5 bg-gray-50 border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex flex-wrap gap-6 items-center">
            {previews.logo && (
              <img src={previews.logo} alt="logo" className="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-white p-1" />
            )}
            <div className="space-y-1">
              <p className="font-bold text-gray-800 text-sm">{form.school_name || 'YOUR SCHOOL NAME'}</p>
              <p className="text-xs text-gray-500">Signed by: {form.signatory_name || 'Head Teacher'} · Year {form.active_year}</p>
              <p className="text-xs text-gray-400">Background: {BG_PRESETS.find(b => b.id === bgPreset)?.label}</p>
            </div>
          </div>
        </div>

        {/* ── Save button ───────────────────────────── */}
        <button type="submit" disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-colors text-sm
            ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-700 hover:bg-blue-800'} disabled:opacity-60`}>
          {loading
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {uploading || 'Saving...'}</>
            : saved
              ? <><CheckCircle className="w-5 h-5" /> Saved!</>
              : <><Save className="w-5 h-5" /> Save Settings</>}
        </button>
      </form>
    </div>
  );
}
