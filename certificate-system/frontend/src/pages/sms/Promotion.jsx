import React, { useState, useEffect } from 'react';
import { ArrowUp, RefreshCw, TrendingUp, TrendingDown, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSmsClasses, getTerms, getAcademicYears } from '../../api';
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (typeof window!=='undefined'&&window.location.hostname!=='localhost'?'https://photographicsoftware-1.onrender.com/api':'/api'),
  timeout: 30000,
});
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('cert_token') || localStorage.getItem('staff_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export default function Promotion() {
  const [classes,      setClasses]      = useState([]);
  const [terms,        setTerms]        = useState([]);
  const [years,        setYears]        = useState([]);
  const [nextClasses,  setNextClasses]  = useState([]);
  const [report,       setReport]       = useState([]);
  const [decisions,    setDecisions]    = useState({});
  const [selClass,     setSelClass]     = useState('');
  const [selTerm,      setSelTerm]      = useState('');
  const [selYear,      setSelYear]      = useState('');
  const [nextYear,     setNextYear]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [applying,     setApplying]     = useState(false);

  useEffect(() => {
    Promise.all([getSmsClasses(), getTerms(), getAcademicYears()]).then(([c,t,y]) => {
      setClasses(c.data.data||[]); setTerms(t.data.data||[]); setYears(y.data.data||[]);
    });
  }, []);

  const loadReport = async () => {
    if (!selClass||!selTerm||!selYear) { toast.error('Select class, term and year'); return; }
    setLoading(true);
    try {
      const r = await API.get('/sms/promotion/report', { params: { class_id:selClass, term_id:selTerm, academic_year_id:selYear, next_year_id:nextYear||selYear }});
      const { report: rpt, nextClasses: nc } = r.data.data;
      setReport(rpt);
      setNextClasses(nc||[]);
      // Init decisions from suggestions
      const dec = {};
      rpt.forEach(r => { dec[r.student.id] = { action: r.suggestion, to_class_id: '' }; });
      setDecisions(dec);
    } catch (err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setLoading(false); }
  };

  const handleApply = async () => {
    const decArr = report.map(r => ({
      student_id: r.student.id,
      action: decisions[r.student.id]?.action || r.suggestion,
      to_class_id: decisions[r.student.id]?.to_class_id || null,
      percentage: r.percentage,
    }));
    if (decArr.some(d => !d.to_class_id && d.action === 'promote')) {
      toast.error('Assign a class for all students being promoted');
      return;
    }
    setApplying(true);
    try {
      const res = await API.post('/sms/promotion/apply', { decisions: decArr, academic_year_id: nextYear||selYear, term_id: selTerm });
      const { promoted, repeated, graduated } = res.data.data;
      toast.success(`Done! ${promoted} promoted, ${repeated} repeated, ${graduated} graduated`);
      setReport([]); setDecisions({});
    } catch (err) { toast.error(err.response?.data?.error||'Failed'); }
    finally { setApplying(false); }
  };

  const promoted = report.filter(r => decisions[r.student.id]?.action === 'promote').length;
  const repeated = report.filter(r => decisions[r.student.id]?.action === 'repeat').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Student Promotion</h1>
        <p className="text-gray-500 mt-0.5">Promote, repeat or graduate students — system auto-sorts by marks</p>
      </div>

      {/* Selection */}
      <div className="card mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
          {[['Class *',selClass,setSelClass,classes,'name'],['Term *',selTerm,setSelTerm,terms,'name'],['Academic Year *',selYear,setSelYear,years,'name'],['Next Year',nextYear,setNextYear,years,'name']].map(([l,v,sv,opts,valKey])=>(
            <div key={l}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
              <select className="select-field" value={v} onChange={e=>sv(e.target.value)}>
                <option value="">— Select —</option>
                {opts.map(o=><option key={o.id} value={o.id}>{o[valKey]}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button onClick={loadReport} disabled={loading} className="btn-primary">
          {loading?'Loading...':<><TrendingUp className="w-4 h-4"/> Load Report</>}
        </button>
      </div>

      {/* Summary */}
      {report.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="card bg-green-50 border-green-100 text-center py-4">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-1"/>
              <p className="text-2xl font-bold text-green-700">{promoted}</p>
              <p className="text-xs text-gray-500">To Promote</p>
            </div>
            <div className="card bg-amber-50 border-amber-100 text-center py-4">
              <RefreshCw className="w-6 h-6 text-amber-600 mx-auto mb-1"/>
              <p className="text-2xl font-bold text-amber-700">{repeated}</p>
              <p className="text-xs text-gray-500">To Repeat</p>
            </div>
            <div className="card bg-blue-50 border-blue-100 text-center py-4">
              <ArrowUp className="w-6 h-6 text-blue-600 mx-auto mb-1"/>
              <p className="text-2xl font-bold text-blue-700">{report.length}</p>
              <p className="text-xs text-gray-500">Total Students</p>
            </div>
          </div>

          {/* Students table */}
          <div className="card overflow-hidden p-0 mb-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-900 text-white">
                <th className="text-left py-3 px-4 text-xs">Rank</th>
                <th className="text-left py-3 px-4 text-xs">Student</th>
                <th className="text-left py-3 px-4 text-xs">Score</th>
                <th className="text-left py-3 px-4 text-xs">Grade</th>
                <th className="text-left py-3 px-4 text-xs">Decision</th>
                <th className="text-left py-3 px-4 text-xs">Assign Class</th>
              </tr></thead>
              <tbody>
                {report.map((r, i) => {
                  const dec = decisions[r.student.id] || { action: r.suggestion, to_class_id: '' };
                  const isPromote = dec.action === 'promote';
                  return (
                    <tr key={r.student.id} className={`border-b ${i%2===0?'bg-white':'bg-gray-50'}`}>
                      <td className="py-3 px-4 font-bold text-gray-500">{r.rank}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold">{r.student.first_name} {r.student.last_name}</p>
                        <p className="text-xs text-gray-400">{r.student.student_id}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${r.percentage>=50?'text-green-700':'text-red-600'}`}>
                          {(r.percentage||0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.grade==='A1'?'bg-green-100 text-green-700':r.grade==='F'?'bg-red-100 text-red-700':'bg-blue-100 text-blue-700'}`}>
                          {r.grade||'—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {[['promote','Promote','bg-green-600'],['repeat','Repeat','bg-amber-500'],['graduated','Graduate','bg-blue-600']].map(([a,l,c])=>(
                            <button key={a} onClick={()=>setDecisions(p=>({...p,[r.student.id]:{...p[r.student.id],action:a}}))}
                              className={`px-2 py-1 rounded text-xs font-semibold text-white transition-all ${dec.action===a?c:'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select className="select-field text-xs py-1.5 w-40"
                          value={dec.to_class_id||''}
                          onChange={e=>setDecisions(p=>({...p,[r.student.id]:{...p[r.student.id],to_class_id:e.target.value}}))}
                          disabled={dec.action==='graduated'}>
                          <option value="">— Assign —</option>
                          {[...classes,...nextClasses].filter((c,i,arr)=>arr.findIndex(x=>x.id===c.id)===i).map(c=>(
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button onClick={handleApply} disabled={applying}
            className="btn-primary w-full justify-center py-3 text-base">
            {applying?'Applying...':<><Check className="w-5 h-5"/> Apply Promotion Decisions ({report.length} students)</>}
          </button>
        </>
      )}
    </div>
  );
}
