import React, { useState } from 'react';
import { Search, Download, Printer, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateCertificate, downloadBlob, printBlob } from '../api';

const CLASSES = ['Top Class','P6','S3','S6','Nursery','Graduation'];

const DESIGNS = [
  {
    id: 'A',
    name: 'Midnight Navy',
    sub: 'Portrait',
    desc: 'Deep navy · Gold V-curves · Gold seal',
    portrait: true,
    preview: {
      bg: '#071028',
      border: '#D4A205',
      accent: '#D4A205',
      name: 'rgb(212,162,5)',
    }
  },
  {
    id: 'B',
    name: 'Ivory Gold Classic',
    sub: 'Landscape',
    desc: 'Ivory · Ornate gold frame · Ribbon seal',
    portrait: false,
    preview: {
      bg: '#FDFBE9',
      border: '#B88F02',
      accent: '#0A2466',
      name: '#0A2466',
    }
  },
  {
    id: 'C',
    name: 'Geometric Burgundy',
    sub: 'Landscape',
    desc: 'White · Diagonal red shapes · Gold medal',
    portrait: false,
    preview: {
      bg: '#fff',
      border: '#6B0310',
      accent: '#D1A205',
      name: '#111',
    }
  },
  {
    id: 'D',
    name: 'Blue Diagonal Modern',
    sub: 'Landscape',
    desc: 'White · Blue+gold stripes · Ribbon badge',
    portrait: false,
    preview: {
      bg: '#fff',
      border: '#0E3882',
      accent: '#D4A305',
      name: '#111',
    }
  },
];

function DesignCard({ d, selected, onSelect }) {
  const { bg, border, accent, name } = d.preview;
  return (
    <button onClick={onSelect}
      className={`rounded-2xl overflow-hidden border-2 text-left transition-all hover:shadow-xl w-full group
        ${selected ? 'border-blue-500 shadow-lg ring-2 ring-blue-100 scale-[1.02]' : 'border-gray-200 hover:border-gray-300 hover:scale-[1.01]'}`}>

      {/* Certificate mini-preview */}
      <div className={`relative overflow-hidden ${d.portrait ? 'h-36' : 'h-28'}`}
        style={{ backgroundColor: bg }}>

        {/* Border */}
        <div className="absolute inset-1.5 rounded" style={{ border: `2px solid ${border}` }} />

        {/* Design-specific decorations */}
        {d.id === 'A' && <>
          <div className="absolute inset-0" style={{ backgroundColor:'#071028' }} />
          <div className="absolute inset-2" style={{ border:`1.5px solid ${border}` }} />
          {/* V-shape bottom */}
          <div className="absolute bottom-0 left-0 w-14 h-14" style={{ backgroundColor:accent, clipPath:'polygon(0 100%, 100% 100%, 0 0)' }} />
          <div className="absolute bottom-0 right-0 w-14 h-14" style={{ backgroundColor:accent, clipPath:'polygon(100% 100%, 0 100%, 100% 0)' }} />
          {/* Content */}
          <div className="absolute top-5 left-0 right-0 flex flex-col items-center gap-1">
            <div className="h-3 w-20 rounded" style={{ backgroundColor:accent, opacity:.9 }} />
            <div className="h-2 w-16 rounded" style={{ backgroundColor:accent, opacity:.6 }} />
            <div className="h-4 w-18 rounded" style={{ backgroundColor:accent, opacity:.7 }} />
          </div>
          {/* Seal circle */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full" style={{ backgroundColor:accent }} />
        </>}

        {d.id === 'B' && <>
          {/* Top gold ribbon */}
          <div className="absolute top-0 left-0 right-0 h-7" style={{ backgroundColor:border }} />
          {/* Bottom gold strip */}
          <div className="absolute bottom-0 left-0 right-0 h-5" style={{ backgroundColor:border }} />
          {/* Corner squares */}
          {[[1,1],[1,'auto'],[null,1],[null,'auto']].map(([t,b],i) => (
            <div key={i} className="absolute w-3 h-3" style={{ top:t?4:'auto', bottom:b==='auto'?4:'auto', left:i<2?4:'auto', right:i>=2?4:'auto', backgroundColor:border }} />
          ))}
          <div className="absolute top-9 left-0 right-0 flex flex-col items-center gap-1.5">
            <div className="h-3.5 w-24 rounded" style={{ backgroundColor:name, opacity:.7 }} />
            <div className="h-1 w-20 rounded" style={{ backgroundColor:accent }} />
            <div className="h-1 w-16 rounded" style={{ backgroundColor:'#888', opacity:.4 }} />
          </div>
        </>}

        {d.id === 'C' && <>
          {/* Diagonal shapes top-left */}
          <div className="absolute top-0 left-0 w-20 h-20" style={{ backgroundColor:border, clipPath:'polygon(0 0,100% 0,0 100%)' }} />
          <div className="absolute top-0 left-0 w-12 h-20" style={{ backgroundColor:'#200010', clipPath:'polygon(0 0,60% 0,0 100%)' }} />
          {/* Diagonal shapes bottom-right */}
          <div className="absolute bottom-0 right-0 w-20 h-20" style={{ backgroundColor:border, clipPath:'polygon(100% 0,100% 100%,0 100%)' }} />
          <div className="absolute bottom-0 right-0 w-12 h-20" style={{ backgroundColor:'#200010', clipPath:'polygon(100% 0,100% 100%,40% 100%)' }} />
          {/* Gold lines */}
          <div className="absolute top-4 left-6 w-14 h-0.5 rotate-[-30deg]" style={{ backgroundColor:accent }} />
          <div className="absolute bottom-4 right-6 w-14 h-0.5 rotate-[-30deg]" style={{ backgroundColor:accent }} />
          {/* Center content */}
          <div className="absolute top-8 left-0 right-0 flex flex-col items-center gap-1.5">
            <div className="h-3 w-22 rounded" style={{ backgroundColor:'#111', opacity:.6 }} />
            <div className="h-3.5 w-18 rounded" style={{ backgroundColor:accent }} />
            <div className="h-1 w-16 rounded" style={{ backgroundColor:'#888', opacity:.4 }} />
          </div>
        </>}

        {d.id === 'D' && <>
          {/* Blue thick border */}
          <div className="absolute inset-0" style={{ border:`8px solid ${border}` }} />
          {/* Gray diagonal strips (left) */}
          <div className="absolute top-0 bottom-0 left-4 w-6" style={{ backgroundColor:'#C8D4EE', transform:'skewX(-8deg)' }} />
          {/* Gold diagonal strip (left) */}
          <div className="absolute top-0 bottom-0 left-10 w-3" style={{ backgroundColor:accent, transform:'skewX(-8deg)' }} />
          {/* Gray diagonal strips (right) */}
          <div className="absolute top-0 bottom-0 right-4 w-6" style={{ backgroundColor:'#C8D4EE', transform:'skewX(-8deg)' }} />
          {/* Gold diagonal strip (right) */}
          <div className="absolute top-0 bottom-0 right-10 w-3" style={{ backgroundColor:accent, transform:'skewX(-8deg)' }} />
          {/* Center */}
          <div className="absolute inset-x-16 inset-y-1 bg-white flex flex-col items-center justify-center gap-1.5">
            <div className="h-3 w-22 rounded" style={{ backgroundColor:'#111', opacity:.5 }} />
            <div className="h-3.5 w-18 rounded" style={{ backgroundColor:name, opacity:.7 }} />
            <div className="h-1 w-14 rounded" style={{ backgroundColor:'#888', opacity:.3 }} />
          </div>
          {/* Badge bottom */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full" style={{ backgroundColor:accent }} />
        </>}

        {/* Selected tick */}
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow-md z-10">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}

        {/* Portrait badge */}
        {d.portrait && (
          <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded z-10">
            Portrait
          </div>
        )}
      </div>

      {/* Label */}
      <div className={`px-3 py-2.5 transition-colors ${selected ? 'bg-blue-600' : 'bg-white group-hover:bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-gray-900'}`}>{d.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${selected ? 'bg-blue-500 text-blue-100' : 'bg-gray-100 text-gray-500'}`}>
            {d.sub}
          </span>
        </div>
        <p className={`text-xs mt-0.5 ${selected ? 'text-blue-100' : 'text-gray-400'}`}>{d.desc}</p>
      </div>
    </button>
  );
}

export default function GenerateCertificate() {
  const [query,      setQuery]     = useState('');
  const [student,    setStudent]   = useState(null);
  const [results,    setResults]   = useState([]);
  const [template,   setTemplate]  = useState('');
  const [design,     setDesign]    = useState('A');
  const [loading,    setLoading]   = useState(false);
  const [generating, setGenerating]= useState('');

  const handleSearch = async e => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setStudent(null);
    try {
      const res = await getStudents({ search: query });
      const found = res.data.data || [];
      setResults(found);
      if (found.length === 1) { setStudent(found[0]); setTemplate(found[0].class); }
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  };

  const handleGenerate = async (action = 'download') => {
    if (!student) return;
    setGenerating(action);
    try {
      const res = await generateCertificate(student.id, template || student.class, design);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const fname = `${student.photo_number}_${student.last_name}_certificate.pdf`;
      if (action === 'print') printBlob(blob);
      else downloadBlob(blob, fname);
      toast.success(action === 'print' ? 'Opening print dialog...' : '✅ Certificate downloaded!');
    } catch { toast.error('Failed to generate certificate'); }
    finally { setGenerating(''); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Generate Certificate</h1>
        <p className="text-gray-500 mt-1">Search a student, choose a design, then download your PDF</p>
      </div>

      {/* Search */}
      <div className="card mb-5">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input className="input-field pl-9"
              placeholder="Photo number (001) or student name"
              value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">
            <Search className="w-4 h-4" /> Search
          </button>
        </form>
      </div>

      {/* Multiple results */}
      {results.length > 1 && !student && (
        <div className="card mb-5">
          <p className="text-sm text-gray-500 mb-3">Multiple found — select one:</p>
          <div className="space-y-2">
            {results.map(s => (
              <button key={s.id}
                onClick={() => { setStudent(s); setTemplate(s.class); setResults([]); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 text-left transition-colors">
                <div className="w-10 h-13 rounded-lg bg-gray-100 overflow-hidden border shrink-0">
                  {s.photo_url && <img src={s.photo_url} alt="" className="w-full h-full object-cover"/>}
                </div>
                <div>
                  <p className="font-semibold text-sm">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">#{s.photo_number} · {s.class} · {s.year}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-center text-gray-400 py-8">Searching...</p>}

      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Student + actions (2/5) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card flex gap-4">
              <div className="w-20 h-28 rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200 shrink-0">
                {student.photo_url
                  ? <img src={student.photo_url} alt="" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center">No Photo</div>}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 leading-tight">{student.first_name} {student.last_name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  📷 <span className="font-mono font-bold text-blue-600">#{student.photo_number}</span>
                </p>
                <p className="text-sm text-gray-500">🎓 {student.class} · 📅 {student.year}</p>
                {/* Class selector */}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {CLASSES.map(c => (
                    <button key={c} onClick={() => setTemplate(c)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all
                        ${template===c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleGenerate('download')} disabled={!!generating}
                className="btn-primary flex-1 justify-center py-3">
                {generating === 'download'
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating...</>
                  : <><Download className="w-4 h-4"/> Download PDF</>}
              </button>
              <button onClick={() => handleGenerate('print')} disabled={!!generating}
                className="btn-secondary flex-1 justify-center py-3">
                {generating === 'print'
                  ? <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> Opening...</>
                  : <><Printer className="w-4 h-4"/> Print</>}
              </button>
            </div>
          </div>

          {/* Design selector (3/5) */}
          <div className="lg:col-span-3">
            <p className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <Award className="w-4 h-4 text-blue-600"/> Choose Certificate Design
            </p>
            <div className="grid grid-cols-2 gap-3">
              {DESIGNS.map(d => (
                <DesignCard key={d.id} d={d}
                  selected={design === d.id}
                  onSelect={() => setDesign(d.id)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
