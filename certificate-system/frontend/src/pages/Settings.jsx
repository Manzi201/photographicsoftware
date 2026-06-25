import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, Image as ImageIcon, Pen, CheckCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../api';
import { useAuth } from '../context/AuthContext';

// Built-in background presets (use placeholder colors — swap with real images)
const BG_PRESETS = [
  { id: 'none', label: 'None (Theme Color)', preview: null, gradient: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' },
  { id: 'floral', label: 'Floral Pattern', preview: '/bg-presets/floral.jpg', gradient: 'linear-gradient(135deg, #fdf2f8, #fce7f3)' },
  { id: 'geometric', label: 'Geometric', preview: '/bg-presets/geometric.jpg', gradient: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' },
  { id: 'gold', label: 'Gold Ornamental', preview: '/bg-presets/gold.jpg', gradient: 'linear-gradient(135deg, #fefce8, #fef9c3)' },
  { id: 'blue', label: 'Blue Marble', preview: '/bg-presets/blue.jpg', gradient: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
  { id: 'custom', label: 'Custom Upload', preview: null, gradient: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' },
];

const SECTION = ({ title, icon: Icon, children }) => (
  <div className="card mb-5">
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
      <div className="bg-blue-50 p-2 rounded-lg"><Icon className="w-4 h-4 text-blue-600" /></div>
      <h2 className="font-semibold text-gray-800">{title}</h2>
    </div>
    {children}
  </div>
);

const ImageUploadField = ({ label, hint, value, preview, onChange, accept = 'image/*' }) => {
  const inputRef = useRef();
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => inputRef.current.click()}>
          {preview
            ? <img src={preview} alt={label} className="w-full h-full object-contain p-1" />
            : <Upload className="w-5 h-5 text-gray-300" />}
        </div>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
        <div>
          <button type="button" onClick={() => inputRef.current.click()}
            className="btn-secondary text-sm py-1.5">
            <Upload className="w-3 h-3" /> {preview ? 'Change' : 'Upload'}
          </button>
          <p className="text-xs text-gray-400 mt-1">{hint}</p>
        </div>
      </div>
    </div>
  );
};

export default function Settings() {
  const { school, refreshSchool } = useAuth();
  const [form, setForm] = useState({ school_name: '', signatory_name: '', active_year: '' });
  const [logos, setLogos] = useState({ logo: null, stamp: null, signature: null, background: null });
  const [previews, setPreviews] = useState({ logo: null, stamp: null, signature: null, background: null });
  const [selectedBgPreset, setSelectedBgPreset] = useState('none');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (school) {
      setForm({
        school_name: school.school_name || '',
        signatory_name: school.signatory_name || '',
        active_year: school.active_year || String(new Date().getFullYear()),
      });
      setPreviews({
        logo: school.logo_url || null,
        stamp: school.stamp_url || null,
        signature: school.signature_url || null,
        background: school.background_url || null,
      });
      setSelectedBgPreset(school.bg_preset || 'none');
    }
  }, [school]);

  const handleFileChange = (key) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogos((l) => ({ ...l, [key]: file }));
    setPreviews((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
    if (key === 'background') setSelectedBgPreset('custom');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('school_name', form.school_name);
      fd.append('signatory_name', form.signatory_name);
      fd.append('active_year', form.active_year);
      if (logos.logo) fd.append('logo', logos.logo);
      if (logos.stamp) fd.append('stamp', logos.stamp);
      if (logos.signature) fd.append('signature', logos.signature);
      if (logos.background) fd.append('background', logos.background);
      if (selectedBgPreset !== 'none' && selectedBgPreset !== 'custom') {
        fd.append('bg_preset', selectedBgPreset);
      }
      if (selectedBgPreset === 'none') fd.append('bg_preset', 'none');
      await updateSettings(fd);
      await refreshSchool(); // update context so all pages see new school info
      setSaved(true);
      toast.success('Settings saved! All new certificates will use this background.');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure school info, logo, signature, stamp, and certificate background</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* School Info */}
        <SECTION title="School Information" icon={Pen}>
          <div className="space-y-4">
            <ImageUploadField
              label="School Logo"
              hint="PNG recommended, 200×200px"
              preview={previews.logo}
              onChange={handleFileChange('logo')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Name <span className="text-red-500">*</span>
              </label>
              <input className="input-field text-base font-semibold uppercase"
                placeholder="e.g. GREEN HILLS ACADEMY"
                value={form.school_name}
                onChange={(e) => setForm({ ...form, school_name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Appears at the top of every certificate (auto uppercase)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Active Academic Year
              </label>
              <input className="input-field w-36" type="number"
                placeholder="2025"
                value={form.active_year}
                onChange={(e) => setForm({ ...form, active_year: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Default year used by the mobile app when adding students</p>
            </div>
          </div>
        </SECTION>

        {/* Signature & Stamp */}
        <SECTION title="Signature & Stamp" icon={Stamp}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signatory Name / Title</label>
              <input className="input-field"
                placeholder="e.g. Head Teacher"
                value={form.signatory_name}
                onChange={(e) => setForm({ ...form, signatory_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploadField
                label="Signature Image"
                hint="PNG with transparent background"
                preview={previews.signature}
                onChange={handleFileChange('signature')}
              />
              <ImageUploadField
                label="School Stamp"
                hint="PNG, circular stamp image"
                preview={previews.stamp}
                onChange={handleFileChange('stamp')}
              />
            </div>
          </div>
        </SECTION>

        {/* ── BACKGROUND SELECTOR ── */}
        <SECTION title="Certificate Background" icon={ImageIcon}>
          <p className="text-sm text-gray-500 mb-4">
            Hitamo background imwe — izagira effect kuri <strong>certificates zose</strong> zoroshye.
          </p>

          {/* Preset grid */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSelectedBgPreset(preset.id);
                  if (preset.id !== 'custom') {
                    setLogos((l) => ({ ...l, background: null }));
                    if (preset.id === 'none') setPreviews((p) => ({ ...p, background: null }));
                  }
                }}
                className={`relative rounded-xl overflow-hidden border-2 transition-all
                  ${selectedBgPreset === preset.id ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
              >
                {/* Preview area */}
                <div className="h-20 w-full" style={{ background: preset.gradient }}>
                  {preset.preview && (
                    <img src={preset.preview} alt={preset.label}
                      className="w-full h-full object-cover opacity-70" />
                  )}
                  {preset.id === 'custom' && previews.background && (
                    <img src={previews.background} alt="Custom"
                      className="w-full h-full object-cover" />
                  )}
                  {preset.id === 'custom' && !previews.background && (
                    <div className="flex h-full items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className={`text-xs font-medium px-2 py-1.5 text-center
                  ${selectedBgPreset === preset.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                  {preset.label}
                </div>
                {selectedBgPreset === preset.id && (
                  <div className="absolute top-1.5 right-1.5 bg-blue-600 rounded-full p-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom upload (shown when custom selected) */}
          {selectedBgPreset === 'custom' && (
            <ImageUploadField
              label="Upload Custom Background"
              hint="JPG or PNG — will appear as subtle watermark behind certificate content"
              preview={previews.background}
              onChange={handleFileChange('background')}
            />
          )}

          {/* Background opacity info */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-4 flex gap-3">
            <Eye className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Uko Background ikora</p>
              <p className="text-xs text-amber-700 mt-1">
                Background ishyirwa nyuma ya certificate content kuri <strong>18% opacity</strong> kugira ngo inyandiko igihe cyose igaragara neza. 
                Ibara rya template (Top Class, P6, S3...) rizakomeza kugaragara hamwe na background.
              </p>
            </div>
          </div>
        </SECTION>

        {/* Preview card */}
        <div className="card mb-5 bg-gray-50 border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Certificate Preview Info</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-400 text-xs uppercase">School</span>
              <p className="font-bold text-gray-800 mt-0.5">{form.school_name || 'YOUR SCHOOL NAME'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs uppercase">Signature</span>
              <p className="font-medium text-gray-700 mt-0.5">{form.signatory_name || 'Head Teacher'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs uppercase">Background</span>
              <p className="font-medium text-gray-700 mt-0.5">
                {BG_PRESETS.find((b) => b.id === selectedBgPreset)?.label || 'None'}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-xs uppercase">Active Year</span>
              <p className="font-medium text-gray-700 mt-0.5">{form.active_year || '—'}</p>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className={`btn-primary w-full justify-center py-3 text-base ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`}>
          {saved ? (
            <><CheckCircle className="w-5 h-5" /> Saved Successfully!</>
          ) : loading ? 'Saving...' : (
            <><Save className="w-5 h-5" /> Save All Settings</>
          )}
        </button>
      </form>
    </div>
  );
}
