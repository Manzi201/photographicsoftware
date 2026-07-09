import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, RefreshCw, BookOpen, Info, Download, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSmsClasses, getTerms, getSmsSubjects, getSmsStudents, getMarks, bulkUpsertMarks } from '../../api';

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

function grade(pct){
  if(pct>=80)return'A1';if(pct>=70)return'B2';if(pct>=60)return'C3';if(pct>=50)return'D4';if(pct>=40)return'E5';return'F';
}
const GRADE_BG={A1:'bg-emerald-100 text-emerald-700',B2:'bg-blue-100 text-blue-700',C3:'bg-sky-100 text-sky-700',D4:'bg-amber-100 text-amber-700',E5:'bg-orange-100 text-orange-700',F:'bg-red-100 text-red-600'};

const TERM_STYLE={
  1:{active:'bg-blue-600 border-blue-600 text-white shadow-blue-200',dot:'bg-blue-400'},
  2:{active:'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200',dot:'bg-emerald-400'},
  3:{active:'bg-violet-600 border-violet-600 text-white shadow-violet-200',dot:'bg-violet-400'},
};
const TERM_DEFAULT='bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50';

export default function SmsMarks() {
  const session   = useMemo(()=>getSession(),[]);
  const isTeacher = session.role==='teacher';

  const [classes,   setClasses]   = useState([]);
  const [terms,     setTerms]     = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  // marksData: { studentId: { subjectId: { cat1, exam } } }
  const [marksData, setMarksData] = useState({});
  const [selClass,  setSelClass]  = useState('');
  const [selTerm,   setSelTerm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [dlExcel,   setDlExcel]   = useState(false);
  const [noAssign,  setNoAssign]  = useState(false);

  // Load classes + terms
  useEffect(()=>{
    Promise.all([getSmsClasses(),getTerms()])
      .then(([c,t])=>{
        setClasses(c.data.data||[]);
        const tms=(t.data.data||[]).filter(t=>t.number!==4);
        setTerms(tms);
        const cur=tms.find(t=>t.is_current);
        if(cur)setSelTerm(cur.id);
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
        setNoAssign(mine.length===0&&subs.length>0);
      } else { setSubjects(subs);setNoAssign(false); }
    });
  },[selClass,isTeacher,session.staffId]);

  // Load students + marks when class+term both selected
  const loadData = useCallback(async()=>{
    if(!selClass||!selTerm){setStudents([]);setMarksData({});return;}
    setLoading(true);
    try{
      // Load students + all marks for this class+term in parallel
      const [sRes,...markRes]=await Promise.all([
        getSmsStudents({class_id:selClass}),
        ...subjects.map(sub=>getMarks({class_id:selClass,term_id:selTerm,subject_id:sub.id}))
      ]);
      const stList=sRes.data.data||[];
      setStudents(stList);
      // Build marksData[studentId][subjectId] = {cat1, exam}
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
    if(!selClass||!selTerm){toast.error('Select class and term');return;}
    setSaving(true);
    try{
      const cls=classes.find(c=>c.id===selClass);
      // Save marks per subject
      for(const sub of subjects){
        const marks=students.map(st=>({
          student_id:st.id,
          cat1:parseFloat(marksData[st.id]?.[sub.id]?.cat1||0),
          exam:(sub.max_exam||0)>0?parseFloat(marksData[st.id]?.[sub.id]?.exam||0):0,
        }));
        await bulkUpsertMarks({marks,subject_id:sub.id,term_id:selTerm,class_id:selClass,academic_year_id:cls?.academic_year_id});
      }
      toast.success(`✅ Marks saved for ${subjects.length} subjects!`);
      loadData();
    }catch(err){toast.error(err.response?.data?.error||'Save failed');}
    finally{setSaving(false);}
  };

  const handleExcel=async()=>{
    if(!selClass||!selTerm){toast.error('Select class and term');return;}
    setDlExcel(true);
    try{
      const cls=classes.find(c=>c.id===selClass),trm=terms.find(t=>t.id===selTerm);
      const res=await SMS.get('/excel/class-report',{params:{class_id:selClass,term_id:selTerm,academic_year_id:cls?.academic_year_id||''},responseType:'blob'});
      const url=URL.createObjectURL(new Blob([res.data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a=document.createElement('a');a.href=url;a.download=`${cls?.name||'class'}_${trm?.name||'term'}_marks.xlsx`;
      document.body.appendChild(a);a.click();URL.revokeObjectURL(url);document.body.removeChild(a);
      toast.success('Excel downloaded!');
    }catch{toast.error('Download failed');}
    finally{setDlExcel(false);}
  };

  const selCls=classes.find(c=>c.id===selClass);
  const selTrmObj=terms.find(t=>t.id===selTerm);

  // Compute totals per student
  const studentTotals=useMemo(()=>{
    const result={};
    students.forEach(st=>{
      let tw=0,mx=0;
      subjects.forEach(sub=>{
        const m=marksData[st.id]?.[sub.id];
        const c1=parseFloat(m?.cat1||0);
        const ex=(sub.max_exam||0)>0?parseFloat(m?.exam||0):0;
        const tot=c1+ex;
        tw+=tot*(sub.coefficient||1);
        mx+=(sub.max_marks||100)*(sub.coefficient||1);
      });
      result[st.id]={weighted:tw,max:mx,pct:mx>0?(tw/mx)*100:0};
    });
    return result;
  },[students,subjects,marksData]);

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5 text-white"/>
              </div>
              Marks Entry
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-11">
              {isTeacher?'Your assigned subjects only':'Enter marks for all subjects at once'}
            </p>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2 text-xs text-blue-700 max-w-xs">
              <Info className="w-3.5 h-3.5 shrink-0"/>
              {noAssign?'No subjects assigned yet — showing all. Ask DoS.':'Showing only your assigned subjects'}
            </div>
          )}
        </div>

        {/* ── Config card ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">

          {/* Term buttons */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Term</label>
            <div className="flex flex-wrap gap-2.5">
              {terms.length===0&&<p className="text-sm text-gray-400 italic">No terms — create in Classes &amp; Years</p>}
              {terms.sort((a,b)=>a.number-b.number).map(t=>{
                const ts=TERM_STYLE[t.number]||TERM_STYLE[1];
                const isActive=selTerm===t.id;
                return(
                  <button key={t.id} onClick={()=>setSelTerm(t.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-200 shadow-sm
                      ${isActive?`${ts.active} shadow-lg scale-105`:`${TERM_DEFAULT}`}`}>
                    <span>{t.name}</span>
                    {t.is_current&&<span className={`w-2 h-2 rounded-full ${isActive?'bg-white/70':ts.dot}`}/>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class + actions row */}
          <div className="flex items-end gap-4 flex-wrap border-t border-gray-50 pt-4">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Class</label>
              <div className="relative">
                <select value={selClass} onChange={e=>setSelClass(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                  <option value="">— Select Class —</option>
                  {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.level?` (${c.level})`:''}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {selClass&&selTerm&&(
                <button onClick={handleExcel} disabled={dlExcel}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  {dlExcel?<span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>:<Download className="w-4 h-4 text-emerald-600"/>}
                  Excel
                </button>
              )}
              <button onClick={()=>loadData()} disabled={loading||!selClass||!selTerm}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
                Refresh
              </button>
              <button onClick={handleSave} disabled={saving||loading||!selClass||!selTerm||subjects.length===0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm">
                {saving?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Save className="w-4 h-4"/>}
                Save All Marks
              </button>
            </div>
          </div>
        </div>

        {/* ── Marks grid ───────────────────────────────── */}
        {selClass&&selTerm&&subjects.length>0&&students.length>0&&(
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Info bar */}
            <div className="px-6 py-3.5 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-bold text-gray-900">{selCls?.name}</span>
                  <span className="text-gray-400 text-sm ml-2">·</span>
                  <span className="font-semibold text-gray-600 text-sm ml-2">{selTrmObj?.name}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">{students.length} students · {subjects.length} subjects</span>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  {/* Row 1: # | Name | Subject groups */}
                  <tr className="bg-[#0a2156]">
                    <th className="py-3 px-3 text-left text-white font-semibold w-8 border-r border-blue-800/40">#</th>
                    <th className="py-3 px-3 text-left text-white font-semibold min-w-[160px] border-r border-blue-800/40">Student Name</th>
                    {subjects.map(sub=>{
                      const cols=(sub.max_exam||0)>0?3:2; // TEST+EXAM+TOT or TEST+TOT
                      return(
                        <th key={sub.id} colSpan={cols} className="py-2 px-2 text-center border-r border-blue-800/40">
                          <div className="text-white font-bold text-xs">{(sub.name||'').toUpperCase()}</div>
                          <div className="text-blue-200 text-[10px] mt-0.5">max {sub.max_marks||100}{sub.coefficient>1?` ×${sub.coefficient}`:''}</div>
                        </th>
                      );
                    })}
                    <th className="py-3 px-2 text-center text-white font-semibold min-w-[80px]">TOTAL<br/><span className="text-[10px] text-blue-300 font-normal">avg%</span></th>
                  </tr>
                  {/* Row 2: sub-headers per subject */}
                  <tr className="bg-[#1e3a8a]">
                    <th className="py-1.5 border-r border-blue-800/40"/>
                    <th className="py-1.5 border-r border-blue-800/40"/>
                    {subjects.map(sub=>{
                      const hasExam=(sub.max_exam||0)>0;
                      return(
                        <React.Fragment key={sub.id}>
                          <th className="py-1.5 px-2 text-center text-blue-200 font-semibold border-r border-blue-800/20">
                            <div>TEST</div><div className="text-[10px] text-blue-300/70">/{sub.max_test||0}</div>
                          </th>
                          {hasExam&&(
                            <th className="py-1.5 px-2 text-center text-blue-200 font-semibold border-r border-blue-800/20">
                              <div>EXAM</div><div className="text-[10px] text-blue-300/70">/{sub.max_exam||0}</div>
                            </th>
                          )}
                          <th className="py-1.5 px-2 text-center text-emerald-300 font-bold border-r border-blue-800/40">
                            <div>TOT</div><div className="text-[10px] text-emerald-400/70">/{sub.max_marks||100}</div>
                          </th>
                        </React.Fragment>
                      );
                    })}
                    <th className="py-1.5"/>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st,i)=>{
                    const totInfo=studentTotals[st.id]||{pct:0};
                    const grd=grade(totInfo.pct);
                    return(
                      <tr key={st.id} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'} hover:bg-blue-50/20 transition-colors`}>
                        <td className="py-2 px-3 text-gray-300 font-medium border-r border-gray-100">{i+1}</td>
                        <td className="py-2 px-3 font-semibold text-gray-900 border-r border-gray-100 whitespace-nowrap">
                          {(st.last_name||'').toUpperCase()} {st.first_name}
                          <span className="block text-[10px] text-gray-400 font-normal">{st.student_id}</span>
                        </td>
                        {subjects.map(sub=>{
                          const m=marksData[st.id]?.[sub.id]||{};
                          const hasExam=(sub.max_exam||0)>0;
                          const c1=parseFloat(m.cat1||0);
                          const ex=hasExam?parseFloat(m.exam||0):0;
                          const tot=c1+ex;
                          return(
                            <React.Fragment key={sub.id}>
                              {/* TEST input */}
                              <td className="py-1.5 px-1.5 border-r border-gray-50">
                                <input type="number" min="0" max={sub.max_test||100} step="0.5"
                                  value={m.cat1??''} onChange={e=>setMark(st.id,sub.id,'cat1',e.target.value)}
                                  className="w-12 border border-gray-200 rounded-lg px-1 py-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none hover:border-gray-300 transition-colors bg-white"/>
                              </td>
                              {/* EXAM input */}
                              {hasExam&&(
                                <td className="py-1.5 px-1.5 border-r border-gray-50">
                                  <input type="number" min="0" max={sub.max_exam||100} step="0.5"
                                    value={m.exam??''} onChange={e=>setMark(st.id,sub.id,'exam',e.target.value)}
                                    className="w-12 border border-gray-200 rounded-lg px-1 py-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none hover:border-gray-300 transition-colors bg-white"/>
                                </td>
                              )}
                              {/* TOT — computed */}
                              <td className="py-1.5 px-2 text-center border-r border-gray-100">
                                <span className={`text-xs font-bold ${tot>0?'text-gray-900':'text-gray-200'}`}>
                                  {tot>0?tot.toFixed(1):'—'}
                                </span>
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {/* Overall total */}
                        <td className="py-1.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {totInfo.pct>0&&<span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${GRADE_BG[grd]}`}>{grd}</span>}
                            {totInfo.pct>0&&<span className="text-[10px] text-gray-400">{totInfo.pct.toFixed(1)}%</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty states */}
        {selClass&&selTerm&&subjects.length===0&&!loading&&(
          <div className="bg-white rounded-2xl border border-amber-100 p-8 text-center">
            <p className="text-amber-600 font-semibold">No subjects assigned to this class</p>
            <p className="text-gray-400 text-sm mt-1">Go to Classes &amp; Years → Assign subjects</p>
          </div>
        )}
        {(!selClass||!selTerm)&&(
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-blue-400"/>
            </div>
            <p className="font-semibold text-gray-700">Select a term and class</p>
            <p className="text-gray-400 text-sm mt-1">All subjects will appear at once for quick entry</p>
          </div>
        )}
      </div>
    </div>
  );
}
