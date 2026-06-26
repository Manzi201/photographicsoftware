import React, { useState } from 'react';
import { Search, Download, Printer, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudents, generateCertificate, downloadBlob, printBlob } from '../api';

const CLASSES = ['Top Class','P6','S3','S6','Nursery','Graduation'];

const DESIGNS = [
  { id:'1', name:'Presidential',      desc:'White · Navy & Gold borders',     colors:['#0e2d80','#c09000','#fff'] },
  { id:'2', name:'Emerald Ribbon',    desc:'Cream · Deep green side ribbons', colors:['#065922','#c69400','#faf8ee'] },
  { id:'3', name:'Sapphire Modern',   desc:'Blue left panel · White right',   colors:['#0e38a0','#c09000','#fff'] },
  { id:'4', name:'Burgundy Prestige', desc:'Cream · Rich burgundy bands',     colors:['#7a0614','#d19e04','#faf7ee'] },
  { id:'5', name:'Midnight Gold',     desc:'Deep navy bg · Gold text',        colors:['#070d38','#e0ad14','#e8edff'] },
];

function DesignCard({ d, selected, onSelect }) {
  const [c1, c2, c3] = d.colors;
  return (
    <button onClick={onSelect}
      className={`rounded-2xl border-2 overflow-hidden text-left transition-all hover:shadow-lg w-full
        ${selected ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}>

      {/* Mini certificate preview */}
      <div className="h-28 relative p-0 overflow-hidden" style={{ backgroundColor: c3 }}>
        {/* top band */}
        <div className="absolute top-0 left-0 right-0 h-7" style={{ backgroundColor: c1 }} />
        {/* side stripes for designs 2,3,4 */}
        {(d.id==='2'||d.id==='3') && <div className="absolute top-0 left-0 bottom-0 w-5" style={{ backgroundColor: c1 }} />}
        {d.id==='3' && <div className="absolute top-0 left-5 bottom-0 w-1.5" style={{ backgroundColor: c2 }} />}
        {/* bottom band */}
        {d.id!=='5' && <div className="absolute bottom-0 left-0 right-0 h-5" style={{ backgroundColor: c1 }} />}

        {/* Gold borders for design 1,5 */}
        {(d.id==='1'||d.id==='5') && (
          <div className="absolute inset-1 border-2 rounded" style={{ borderColor: c2 }} />
        )}

        {/* Content lines */}
        <div className={`absolute flex flex-col items-center gap-1 ${d.id==='3'?'left-20 right-2':'left-2 right-2'} top-9`}>
          <div className="h-1.5 w-32 rounded" style={{ backgroundColor: c1, opacity:.5 }} />
          <div className="h-3 w-28 rounded" style={{ backgroundColor: c1, opacity:.8 }} />
          <div className="h-1 w-24 rounded" style={{ backgroundColor: c2 }} />
          <div className="h-1 w-20 rounded" style={{ backgroundColor: c1, opacity:.35 }} />
          <div className="h-1 w-18 rounded" style={{ backgroundColor: c1, opacity:.25 }} />
        </div>

        {/* Mini photo placeholder */}
        <div className="absolute top-1 right-2 w-9 h-12 rounded border-2"
          style={{ borderColor: c2, backgroundColor: c1+'33' }} />

        {/* Selected tick */}
        {selected && (
          <div className="absolute top-1.5 left-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}
      </div>

      {/* Label */}
      <div className={`px-3 py-2 ${selected ? 'bg-blue-600' : 'bg-white'}`}>
        <p className={`text-xs font-bold ${selected ? 'text-white' : 'text-gray-800'}`}>{d.name}</p>
        <p className={`text-xs ${selected ? 'text-blue-100' : 'text-gray-400'}`}>{d.desc}</p>
      </div>
    </button>
  );
}

export default function GenerateCertificate() {
  const [query,     setQuery]     = useState('');
  const [student,   setStudent]   = useState(null);
  const [results,   setResults]   = useState([]);
  const [template,  setTemplate]  = useState('');
  const [design,    setDesign]    = useState('1');
  const [loading,   setLoading]   = useState(false);
  const [generating,setGenerating]= useState('');

  const handleSearch = async e => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setStudent(null);
    try {
      const res = await getStudents({ search: query });
      const found = res.data.data || [];
      setResults(found);
      if (found.length===1) { setStudent(found[0]); setTemplate(found[0].class); }
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  };

  const handleGenerate = async (action='download') => {
    if (!student) return;
    setGenerating(action);
    try {
      const res = await generateCertificate(student.id, template||student.class, design);
      const blob = new Blob([res.data], { type:'application/pdf' });
      const name = `${student.photo_number}_${student.last_name}_certificate.pdf`;
      if (action==='print') printBlob(blob);
      else downloadBlob(blob, name);
      toast.success(action==='print' ? 'Opening print dialog...' : '✅ Certificate downloaded!');
    } catch { toast.error('Failed to generate'); }
    finally { setGenerating(''); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Generate Certificate</h1>
        <p className="text-gray-500 mt-1">Search student → choose design → download</p>
      </div>

      {/* Search */}
      <div className="card mb-5">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input className="input-field pl-9"
              placeholder="Photo number (001) or student name"
              value={query} onChange={e=>setQuery(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="btn-primary">
            <Search className="w-4 h-4" /> Search
          </button>
        </form>
      </div>

      {/* Multiple results */}
      {results.length>1 && !student && (
        <div className="card mb-5">
          <p className="text-sm text-gray-500 mb-3">Select student:</p>
          <div className="space-y-2">
            {results.map(s=>(
              <button key={s.id} onClick={()=>{setStudent(s);setTemplate(s.class);setResults([]);}}
                className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 text-left">
                <div className="w-10 h-12 rounded-lg bg-gray-100 overflow-hidden border shrink-0">
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

      {loading && <p className="text-center text-gray-400 py-6">Searching...</p>}

      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Student info */}
          <div className="space-y-4">
            <div className="card flex gap-4">
              <div className="w-20 h-28 rounded-xl overflow-hidden bg-gray-100 border shrink-0">
                {student.photo_url
                  ? <img src={student.photo_url} alt="" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Photo</div>}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{student.first_name} {student.last_name}</h2>
                <p className="text-sm text-gray-500 mt-1">📷 <span className="font-mono text-blue-600">#{student.photo_number}</span></p>
                <p className="text-sm text-gray-500">🎓 {student.class} · 📅 {student.year}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CLASSES.map(c=>(
                    <button key={c} onClick={()=>setTemplate(c)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all
                        ${template===c?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={()=>handleGenerate('download')} disabled={!!generating}
                className="btn-primary flex-1 justify-center py-3">
                {generating==='download'
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Generating...</>
                  : <><Download className="w-4 h-4"/> Download PDF</>}
              </button>
              <button onClick={()=>handleGenerate('print')} disabled={!!generating}
                className="btn-secondary flex-1 justify-center py-3">
                {generating==='print'
                  ? <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> Opening...</>
                  : <><Printer className="w-4 h-4"/> Print</>}
              </button>
            </div>
          </div>

          {/* Design selector */}
          <div>
            <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600"/> Choose Certificate Design
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DESIGNS.map(d=>(
                <DesignCard key={d.id} d={d} selected={design===d.id} onSelect={()=>setDesign(d.id)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
