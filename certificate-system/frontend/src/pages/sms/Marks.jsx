import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, RefreshCw, BookOpen, Download, ChevronDown, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getAcademicYears, getSmsSubjects, getSmsStudents, getMarks, bulkUpsertMarks } from '../../api';

const SMS = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api','/api/sms') ||
    (typeof window!=='undefined'&&window.location.hostname!=='localhost'
      ?'https://photographicsoftware-1.onrender.com/api/sms':'/api/sms'),
  timeout:60000,
});
SMS.interceptors.request.use(cfg=>{
  const t=localStorage.getItem('staff_token')||localStorage.getItem('cert_token');
  if(t) cfg.headers.Authorization=`Bearer ${t}`;
  return cfg;
});

function getSession() {
  try { const s=JSON.parse(localStorage.getItem('staff_data')||'{}'); return{role:s.role||'teacher',staffId:s.id||null}; }
  catch { return{role:'teacher',staffId:null}; }
}

function grade(pct){ if(pct>=80)return'A1';if(pct>=70)return'B2';if(pct>=60)return'C3';if(pct>=50)return'D4';if(pct>=40)return'E5';return'F'; }
const GRADE_BG={A1:'bg-emerald-100 text-emerald-700',B2:'bg-blue-100 text-blue-700',C3:'bg-sky-100 text-sky-700',D4:'bg-amber-100 text-amber-700',E5:'bg-orange-100 text-orange-700',F:'bg-red-100 text-red-600'};
const TERM_ACTIVE={1:'bg-blue-600 border-blue-600 text-white shadow-blue-200 shadow-lg scale-105',2:'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200 shadow-lg scale-105',3:'bg-violet-600 border-violet-600 text-white shadow-violet-200 shadow-lg scale-105'};
const TERM_DEFAULT='bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50';

export default function SmsMarks() {
  const session   = useMemo(()=>getSession(),[]);
  const isTeacher = session.role==='teacher';
  const isDos     = session.role==='dos';
  // DoS can only VIEW reports — no mark entry
  const canEdit   = !isDos;

  const [years,     setYears]     = useState([]);
  const [terms,     setTerms]     = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [marksData, setMarksData] = useState({});
  const [selYear,   setSelYear]   = useState('');
  const [selTerm,   setSelTerm]   = useState('');
  const [selClass,  setSelClass]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [dlExcel,   setDlExcel]   = useState(false);

  // Load years + all classes + all terms on mount
  useEffect(()=>{
    Promise.all([getAcademicYears(), getSmsClasses(), getTerms()])
      .then(([y,c,t])=>{
        const yrs=y.data.data||[];
        setYears(yrs);
        setClasses(c.data.data||[]);
        const tms=(t.data.data||[]).filter(t=>t.number!==4);
        setTerms(tms);
        // Auto-select current year
        const cur=yrs.find(yr=>yr.is_current);
        if(cur)setSelYear(cur.id);
      }).catch(()=>toast.error('Failed to load'));
  },[]);

  // Load subjects when class changes
  useEffect(()=>{
    if(!selClass){setSubjects([]);return;}
    getSmsSubjects({class_id:selClass}).then(r=>{
      let subs=r.data.data||[];
      if(isTeacher&&session.staffId){
        const mine=subs.filter(s=>s.teacher?.id===session.staffId||s.teacher_id===session.staffId);
        setSubjects(mine.length>0?mine:subs);
      } else { setSubjects(subs); }
    });
  },[selClass,isTeacher,session.staffId]);

  // Load marks when class+term both selected
  const loadData = useCallback(async()=>{
    if(!selClass||!selTerm||subjects.length===0){setStudents([]);setMarksData({});return;}
    setLoading(true);
    try{
      const [sRes,...markRes]=await Promise.all([
        getSmsStudents({class_id:selClass}),
        ...subjects.map(sub=>getMarks({class_id:selClass,term_id:selTerm,subject_id:sub.id}))
      ]);
      const stList=sRes.data.data||[];
      setStudents(stList);
      const md={};
      stList.forEach(st=>{md[st.id]={};});
      subjects.forEach((sub,idx)=>{
        const mList=markRes[idx]?.data?.data||[];
        stList.forEach(st=>{
          const m=mList.find(x=>x.student_id===st.id);
          if(!md[st.id])md[st.id]={};
          md[st.id][sub.id]={cat1:m?.cat1??'',exam:m?.exam??''};
        });
      });
      setMarksData(md);
    }catch{toast.error('Failed to load marks');}
    finally{setLoading(false);}
  },[selClass,selTerm,subjects]);

  useEffect(()=>{ loadData(); },[selClass,selTerm]);

  const setMark=(stId,subId,field,val)=>
    setMarksData(p=>({...p,[stId]:{...p[stId],[subId]:{...(p[stId]?.[subId]||{}), [field]:val}}}));

  const handleSave=async()=>{
    if(!selClass||!selTerm||!canEdit){return;}
    setSaving(true);
    try{
      const cls=classes.find(c=>c.id===selClass);
      for(const sub of subjects){
        const marks=students.map(st=>({
          student_id:st.id,
          cat1:parseFloat(marksData[st.id]?.[sub.id]?.cat1||0),
          exam:(sub.max_exam||0)>0?parseFloat(marksData[st.id]?.[sub.id]?.exam||0):0,
        }));
        await bulkUpsertMarks({marks,subject_id:sub.id,term_id:selTerm,class_id:selClass,academic_year_id:cls?.academic_year_id||selYear});
      }
      toast.success(`✅ Marks saved for ${subjects.length} subjects!`);
      loadData();
    }catch(err){toast.error(err.response?.data?.error||'Save failed');}
    finally{setSaving(false);}
  };

  const handleExcel=async()=>{
    if(!selClass||!selTerm){return;}
    setDlExcel(true);
    try{
      const cls=classes.find(c=>c.id===selClass),trm=terms.find(t=>t.id===selTerm);
      const res=await SMS.get('/excel/class-report',{params:{class_id:selClass,term_id:selTerm,academic_year_id:selYear||''},responseType:'blob'});
      const url=URL.createObjectURL(new Blob([res.data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a=document.createElement('a');a.href=url;a.download=`${cls?.name||'class'}_${trm?.name||'term'}_marks.xlsx`;
      document.body.appendChild(a);a.click();URL.revokeObjectURL(url);document.body.removeChild(a);
      toast.success('Excel downloaded!');
    }catch{toast.error('Download failed');}
    finally{setDlExcel(false);}
  };

  // Filter terms by selected year
  const filteredTerms = terms.filter(t=>!selYear||t.academic_year_id===selYear).sort((a,b)=>a.number-b.number);
  // Filter classes by selected year (classes may or may not have academic_year_id — show all if no year filter)
  const filteredClasses = classes; // show all classes regardless (reuse across years)

  const selCls=classes.find(c=>c.id===selClass);
  const selTrmObj=terms.find(t=>t.id===selTerm);

  const studentTotals=useMemo(()=>{
    const r={};
    students.forEach(st=>{
      let tw=0,mx=0;
      subjects.forEach(sub=>{
        const m=marksData[st.id]?.[sub.id];
        const c1=parseFloat(m?.cat1||0);
        const ex=(sub.max_exam||0)>0?parseFloat(m?.exam||0):0;
        tw+=(c1+ex)*(sub.coefficient||1);
        mx+=(sub.max_marks||100)*(sub.coefficient||1);
      });
      r[st.id]={pct:mx>0?(tw/mx)*100:0};
    });
    return r;
  },[students,subjects,marksData]);

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5 text-white"/>
              </div>
              {isDos ? 'Student Reports' : 'Marks Entry'}
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-11">
              {isDos ? 'View all student marks and reports' : 'Enter marks for all subjects at once'}
            </p>
          </div>
          {isDos && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3.5 py-2 text-xs text-purple-700">
              <Eye className="w-3.5 h-3.5 shrink-0"/>
              View only — mark entry is for teachers
            </div>
          )}
        </div>

        {/* Config card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">

          {/* Step 1: Academic Year */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Step 1 — Academic Year</label>
            <div className="relative max-w-xs">
              <select value={selYear} onChange={e=>{setSelYear(e.target.value);setSelTerm('');setSelClass('');}}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                <option value="">— Select Year —</option>
                {years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' (current)':''}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
            </div>
          </div>

          {/* Step 2: Term (only show after year selected) */}
          {selYear && (
            <div className="border-t border-gray-50 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Step 2 — Term</label>
              {filteredTerms.length===0 ? (
                <p className="text-sm text-gray-400 italic">No terms for this year — create in Classes &amp; Years</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {filteredTerms.map(t=>{
                    const ts=TERM_ACTIVE[t.number];
                    const isActive=selTerm===t.id;
                    return(
                      <button key={t.id} onClick={()=>{setSelTerm(t.id);setSelClass('');}}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200
                          ${isActive?(ts||TERM_ACTIVE[1]):TERM_DEFAULT}`}>
                        {t.name}
                        {t.is_current&&<span className={`w-2 h-2 rounded-full ${isActive?'bg-white/70':'bg-green-400'}`}/>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Class + actions */}
          {selYear && selTerm && (
            <div className="border-t border-gray-50 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Step 3 — Class</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <select value={selClass} onChange={e=>setSelClass(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">— Select Class —</option>
                    {filteredClasses.map(c=><option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                </div>
                {selClass&&(
                  <div className="flex gap-2">
                    <button onClick={handleExcel} disabled={dlExcel}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      {dlExcel?<span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>:<Download className="w-4 h-4 text-emerald-600"/>}
                      Excel
                    </button>
                    <button onClick={()=>loadData()} disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
                      Refresh
                    </button>
                    {canEdit&&(
                      <button onClick={handleSave} disabled={saving||loading||subjects.length===0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm">
                        {saving?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Save className="w-4 h-4"/>}
                        Save All Marks
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Marks table */}
        {selClass&&selTerm&&subjects.length>0&&students.length>0&&(
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-3.5 border-b border-gray-50 flex items-center gap-3">
              <span className="font-bold text-gray-900">{selCls?.name}</span>
              <span className="text-gray-300">·</span>
              <span className="font-semibold text-gray-600 text-sm">{selTrmObj?.name}</span>
              <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full ml-auto">{students.length} students · {subjects.length} subjects</span>
              {isDos&&<span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full"><Eye className="w-3 h-3"/>View only</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0a2156]">
                    <th className="py-3 px-3 text-left text-white font-semibold w-8 border-r border-blue-800/40">#</th>
                    <th className="py-3 px-3 text-left text-white font-semibold min-w-[160px] border-r border-blue-800/40">Student</th>
                    {subjects.map(sub=>{
                      const cols=(sub.max_exam||0)>0?3:2;
                      return(
                        <th key={sub.id} colSpan={cols} className="py-2 px-2 text-center border-r border-blue-800/40">
                          <div className="text-white font-bold text-xs">{(sub.name||'').toUpperCase()}</div>
                          <div className="text-blue-200 text-[10px] mt-0.5">/{sub.max_marks||100}{sub.coefficient>1?` ×${sub.coefficient}`:''}</div>
                        </th>
                      );
                    })}
                    <th className="py-3 px-2 text-center text-white font-semibold min-w-[70px]">AVG</th>
                  </tr>
                  <tr className="bg-[#1e3a8a]">
                    <th className="py-1.5 border-r border-blue-800/40"/>
                    <th className="py-1.5 border-r border-blue-800/40"/>
                    {subjects.map(sub=>{
                      const hasExam=(sub.max_exam||0)>0;
                      return(
                        <React.Fragment key={sub.id}>
                          <th className="py-1.5 px-2 text-center text-blue-200 font-semibold border-r border-blue-800/20 text-[11px]">TEST<span className="block text-blue-300/60 text-[9px]">/{sub.max_test||0}</span></th>
                          {hasExam&&<th className="py-1.5 px-2 text-center text-blue-200 font-semibold border-r border-blue-800/20 text-[11px]">EXAM<span className="block text-blue-300/60 text-[9px]">/{sub.max_exam||0}</span></th>}
                          <th className="py-1.5 px-2 text-center text-emerald-300 font-bold border-r border-blue-800/40 text-[11px]">TOT<span className="block text-emerald-400/60 text-[9px]">/{sub.max_marks||100}</span></th>
                        </React.Fragment>
                      );
                    })}
                    <th className="py-1.5"/>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st,i)=>{
                    const tot=studentTotals[st.id]||{pct:0};
                    const grd=grade(tot.pct);
                    return(
                      <tr key={st.id} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'} hover:bg-blue-50/20 transition-colors`}>
                        <td className="py-2 px-3 text-gray-300 font-medium border-r border-gray-100">{i+1}</td>
                        <td className="py-2 px-3 font-semibold text-gray-900 border-r border-gray-100">
                          {(st.last_name||'').toUpperCase()} {st.first_name}
                          <span className="block text-[10px] text-gray-400 font-normal">{st.student_id}</span>
                        </td>
                        {subjects.map(sub=>{
                          const m=marksData[st.id]?.[sub.id]||{};
                          const hasExam=(sub.max_exam||0)>0;
                          const c1=parseFloat(m.cat1||0), ex=hasExam?parseFloat(m.exam||0):0, tot2=c1+ex;
                          const inputClass="w-12 border border-gray-200 rounded-lg px-1 py-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none hover:border-gray-300 transition-colors bg-white";
                          const readClass="w-12 text-center text-xs font-medium text-gray-600 py-1.5";
                          return(
                            <React.Fragment key={sub.id}>
                              <td className="py-1.5 px-1.5 border-r border-gray-50">
                                {canEdit
                                  ?<input type="number" min="0" max={sub.max_test||100} step="0.5" value={m.cat1??''} onChange={e=>setMark(st.id,sub.id,'cat1',e.target.value)} className={inputClass}/>
                                  :<span className={readClass}>{m.cat1||'—'}</span>}
                              </td>
                              {hasExam&&(
                                <td className="py-1.5 px-1.5 border-r border-gray-50">
                                  {canEdit
                                    ?<input type="number" min="0" max={sub.max_exam||100} step="0.5" value={m.exam??''} onChange={e=>setMark(st.id,sub.id,'exam',e.target.value)} className={inputClass}/>
                                    :<span className={readClass}>{m.exam||'—'}</span>}
                                </td>
                              )}
                              <td className="py-1.5 px-2 text-center border-r border-gray-100">
                                <span className={`text-xs font-bold ${tot2>0?'text-gray-900':'text-gray-200'}`}>{tot2>0?tot2.toFixed(1):'—'}</span>
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="py-1.5 px-3 text-center">
                          {tot.pct>0&&<><span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${GRADE_BG[grd]}`}>{grd}</span><span className="block text-[10px] text-gray-400 mt-0.5">{tot.pct.toFixed(1)}%</span></>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(!selYear||!selTerm||!selClass)&&(
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8 text-blue-400"/></div>
            <p className="font-semibold text-gray-700">{!selYear?'Select academic year first':!selTerm?'Now select a term':'Select a class'}</p>
            <p className="text-gray-400 text-sm mt-1">All subjects will appear at once</p>
          </div>
        )}
      </div>
    </div>
  );
}
