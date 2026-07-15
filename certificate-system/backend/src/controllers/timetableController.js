'use strict';
const { supabase } = require('../supabase');

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── ROOMS ─────────────────────────────────────────────────────
exports.getRooms = async (req, res) => {
  try {
    const { data, error } = await supabase.from('rooms')
      .select('*').eq('school_id', req.schoolId).order('name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createRoom = async (req, res) => {
  try {
    const { name, capacity, room_type } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Room name required' });
    const { data, error } = await supabase.from('rooms').insert([{
      school_id: req.schoolId, name: name.trim(),
      capacity: capacity || 40, room_type: room_type || 'classroom',
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateRoom = async (req, res) => {
  try {
    const { data, error } = await supabase.from('rooms')
      .update(req.body).eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteRoom = async (req, res) => {
  try {
    await supabase.from('timetable_slots').update({ room_id: null }).eq('room_id', req.params.id);
    await supabase.from('rooms').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── PERIODS ───────────────────────────────────────────────────
exports.getPeriods = async (req, res) => {
  try {
    const { academic_year_id, term_id } = req.query;
    let q = supabase.from('school_periods').select('*').eq('school_id', req.schoolId);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (term_id)          q = q.eq('term_id', term_id);
    const { data, error } = await q.order('period_number');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createPeriod = async (req, res) => {
  try {
    const { name, period_number, start_time, end_time, is_break, academic_year_id, term_id } = req.body;
    if (!name || !start_time || !end_time) return res.status(400).json({ success: false, error: 'name, start_time, end_time required' });
    const { data, error } = await supabase.from('school_periods').insert([{
      school_id: req.schoolId, name, period_number: period_number || 1,
      start_time, end_time, is_break: !!is_break,
      academic_year_id: academic_year_id || null, term_id: term_id || null,
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updatePeriod = async (req, res) => {
  try {
    const { data, error } = await supabase.from('school_periods')
      .update(req.body).eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deletePeriod = async (req, res) => {
  try {
    await supabase.from('timetable_slots').delete().eq('period_id', req.params.id);
    await supabase.from('school_periods').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── TIMETABLE SLOTS ───────────────────────────────────────────
exports.getSlots = async (req, res) => {
  try {
    const { class_id, teacher_id, term_id, academic_year_id } = req.query;
    let q = supabase.from('timetable_slots')
      .select(`
        *,
        class:classes(id,name,level),
        subject:subjects(id,name,code),
        teacher:staff(id,full_name),
        room:rooms(id,name),
        period:school_periods(id,name,period_number,start_time,end_time,is_break)
      `)
      .eq('school_id', req.schoolId);
    if (class_id)         q = q.eq('class_id', class_id);
    if (teacher_id)       q = q.eq('teacher_id', teacher_id);
    if (term_id)          q = q.eq('term_id', term_id);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    const { data, error } = await q.order('day_of_week').order('period_id');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.upsertSlot = async (req, res) => {
  try {
    const { class_id, subject_id, teacher_id, room_id, period_id, day_of_week, term_id, academic_year_id } = req.body;
    if (!class_id || !period_id || !day_of_week) {
      return res.status(400).json({ success: false, error: 'class_id, period_id, day_of_week required' });
    }

    // Conflict checks
    if (teacher_id) {
      const { data: tc } = await supabase.from('timetable_slots')
        .select('id,class:classes(name)').eq('school_id', req.schoolId)
        .eq('teacher_id', teacher_id).eq('period_id', period_id).eq('day_of_week', day_of_week)
        .neq('class_id', class_id);
      if (tc?.length) return res.status(409).json({ success: false, error: `Teacher conflict: already assigned to ${tc[0].class?.name} at this time` });
    }
    if (room_id) {
      const { data: rc } = await supabase.from('timetable_slots')
        .select('id,class:classes(name)').eq('school_id', req.schoolId)
        .eq('room_id', room_id).eq('period_id', period_id).eq('day_of_week', day_of_week)
        .neq('class_id', class_id);
      if (rc?.length) return res.status(409).json({ success: false, error: `Room conflict: already in use by ${rc[0].class?.name}` });
    }

    const row = {
      school_id: req.schoolId, class_id, subject_id: subject_id||null,
      teacher_id: teacher_id||null, room_id: room_id||null,
      period_id, day_of_week, term_id: term_id||null, academic_year_id: academic_year_id||null,
    };
    const { data, error } = await supabase.from('timetable_slots')
      .upsert([row], { onConflict: 'school_id,class_id,period_id,day_of_week' })
      .select(`*, class:classes(id,name), subject:subjects(id,name), teacher:staff(id,full_name), room:rooms(id,name), period:school_periods(id,name,period_number,start_time,end_time)`)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteSlot = async (req, res) => {
  try {
    await supabase.from('timetable_slots').delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.clearClassTimetable = async (req, res) => {
  try {
    const { class_id, term_id } = req.body;
    let q = supabase.from('timetable_slots').delete().eq('school_id', req.schoolId).eq('class_id', class_id);
    if (term_id) q = q.eq('term_id', term_id);
    await q;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── REPORTS ───────────────────────────────────────────────────

// Teacher workload: how many periods per teacher
exports.teacherWorkload = async (req, res) => {
  try {
    const { academic_year_id, term_id } = req.query;
    let q = supabase.from('timetable_slots')
      .select('teacher_id, teacher:staff(id,full_name,role), subject:subjects(name), class:classes(name), day_of_week, period:school_periods(name,start_time,end_time)')
      .eq('school_id', req.schoolId).not('teacher_id', 'is', null);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (term_id)          q = q.eq('term_id', term_id);
    const { data, error } = await q;
    if (error) throw error;

    // Aggregate by teacher
    const byTeacher = {};
    (data||[]).forEach(slot => {
      const tid = slot.teacher_id;
      if (!byTeacher[tid]) byTeacher[tid] = { teacher: slot.teacher, slots: [], periods_per_day: {} };
      byTeacher[tid].slots.push(slot);
      const day = DAYS[slot.day_of_week - 1];
      byTeacher[tid].periods_per_day[day] = (byTeacher[tid].periods_per_day[day] || 0) + 1;
    });
    const report = Object.values(byTeacher).map(t => ({
      ...t.teacher, total_periods: t.slots.length, periods_per_day: t.periods_per_day,
      slots: t.slots,
    })).sort((a,b) => (a.full_name||'').localeCompare(b.full_name||''));
    res.json({ success: true, data: report });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// Conflict report
exports.conflictReport = async (req, res) => {
  try {
    const { academic_year_id, term_id } = req.query;
    let q = supabase.from('timetable_slots')
      .select('*, teacher:staff(full_name), room:rooms(name), class:classes(name), period:school_periods(name,start_time,end_time)')
      .eq('school_id', req.schoolId);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (term_id)          q = q.eq('term_id', term_id);
    const { data, error } = await q;
    if (error) throw error;

    const conflicts = [];
    const teacherMap = {}, roomMap = {};
    (data||[]).forEach(slot => {
      const key = `${slot.day_of_week}_${slot.period_id}`;
      if (slot.teacher_id) {
        const tk = `${slot.teacher_id}_${key}`;
        if (teacherMap[tk]) conflicts.push({ type:'teacher', message:`${slot.teacher?.full_name} double-booked`, slots:[teacherMap[tk], slot] });
        else teacherMap[tk] = slot;
      }
      if (slot.room_id) {
        const rk = `${slot.room_id}_${key}`;
        if (roomMap[rk]) conflicts.push({ type:'room', message:`Room ${slot.room?.name} double-booked`, slots:[roomMap[rk], slot] });
        else roomMap[rk] = slot;
      }
    });
    res.json({ success: true, data: conflicts, count: conflicts.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ══════════════════════════════════════════════════════════════
// EXCEL EXPORT HELPERS
// ══════════════════════════════════════════════════════════════
const ExcelJS = require('exceljs');

const NAVY  = 'FF0A2156';
const WHITE = 'FFFFFFFF';
const LGRAY = 'FFEEEFF5';
const LBLUE = 'FFD6E4F7';
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function navyFill() { return { type:'pattern', pattern:'solid', fgColor:{ argb: NAVY } }; }
function lgrayFill(){ return { type:'pattern', pattern:'solid', fgColor:{ argb: LGRAY} }; }
function lblueFill(){ return { type:'pattern', pattern:'solid', fgColor:{ argb: LBLUE} }; }
function whiteFill(){ return { type:'pattern', pattern:'solid', fgColor:{ argb: WHITE} }; }
function nBold(sz=10){ return { name:'Calibri', bold:true,  size:sz, color:{ argb:WHITE} }; }
function dFont(sz=9,  bold=false){ return { name:'Calibri', bold, size:sz, color:{ argb:'FF111111'} }; }
function thin(){ const s={style:'thin',color:{argb:'FFBBBBBB'}}; return{top:s,left:s,bottom:s,right:s}; }
function medBot(){ return { bottom:{style:'medium',color:{argb:NAVY}}, top:thin().top, left:thin().left, right:thin().right }; }
function centre(){ return { horizontal:'center', vertical:'middle', wrapText:true }; }
function left()  { return { horizontal:'left',   vertical:'middle', wrapText:true }; }

// Fetch all data needed for a timetable
async function fetchTimetableData(schoolId, academicYearId, termId) {
  const params = { school_id: schoolId };
  const [
    { data: periodsRaw },
    { data: slotsRaw  },
    { data: school    },
    { data: yearInfo  },
    { data: termInfo  },
  ] = await Promise.all([
    supabase.from('school_periods').select('*').eq('school_id', schoolId)
      .match(termId ? { term_id: termId } : { academic_year_id: academicYearId })
      .order('period_number'),
    supabase.from('timetable_slots')
      .select('*, class:classes(id,name,level), subject:subjects(id,name,code), teacher:staff(id,full_name), room:rooms(id,name), period:school_periods(id,period_number)')
      .eq('school_id', schoolId)
      .match(termId ? { term_id: termId, academic_year_id: academicYearId }
                    : { academic_year_id: academicYearId }),
    supabase.from('schools').select('school_name,city,phone,address,logo_url').eq('id', schoolId).single(),
    supabase.from('academic_years').select('name').eq('id', academicYearId).single(),
    termId
      ? supabase.from('terms').select('name,number').eq('id', termId).single()
      : Promise.resolve({ data: null }),
  ]);
  const periods = (periodsRaw || []).sort((a,b) => a.period_number - b.period_number);
  const slots   = slotsRaw || [];
  return { periods, slots, school: school || {}, yearInfo: yearInfo || {}, termInfo: termInfo || {} };
}

// Draw the standard timetable header (school name, year, term) on a worksheet
function drawTimetableHeader(ws, school, yearInfo, termInfo, title, totalCols) {
  // Row 1: school name
  ws.mergeCells(1, 1, 1, totalCols);
  const r1 = ws.getRow(1);
  r1.height = 22;
  const c1 = r1.getCell(1);
  c1.value = (school.school_name || 'SCHOOL').toUpperCase();
  c1.font  = { name:'Calibri', bold:true, size:14, color:{ argb: NAVY } };
  c1.alignment = centre();

  // Row 2: title bar
  ws.mergeCells(2, 1, 2, totalCols);
  const r2 = ws.getRow(2);
  r2.height = 18;
  const c2 = r2.getCell(1);
  c2.value = `${title}  |  ${yearInfo.name || ''}${termInfo?.name ? '  ·  ' + termInfo.name : ''}`;
  c2.font  = nBold(11);
  c2.fill  = navyFill();
  c2.alignment = centre();

  // Row 3: spacer
  ws.getRow(3).height = 5;
}

// ── GENERATE CLASS TIMETABLE ──────────────────────────────────
exports.generateClassTimetable = async (req, res) => {
  try {
    const { class_id, academic_year_id, term_id } = req.query;
    if (!class_id || !academic_year_id) return res.status(400).json({ success:false, error:'class_id and academic_year_id required' });

    const { periods, slots, school, yearInfo, termInfo } = await fetchTimetableData(req.schoolId, academic_year_id, term_id);
    const { data: cls } = await supabase.from('classes').select('name,level').eq('id', class_id).single();
    const clsSlots = slots.filter(s => s.class_id === class_id);

    // Days that have any slot
    const usedDays = [...new Set(clsSlots.map(s => s.day_of_week))].sort();
    const days = usedDays.length > 0 ? usedDays : [1,2,3,4,5];
    const lessonPeriods = periods.filter(p => !p.is_break);

    const wb = new ExcelJS.Workbook();
    wb.creator = school.school_name || 'SchoolMS';
    const ws = wb.addWorksheet(`${cls?.name || 'Class'} Timetable`, {
      pageSetup: { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 }
    });

    const totalCols = 2 + days.length; // Period# | Period Name | Day1..DayN
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 18;
    days.forEach((_, i) => { ws.getColumn(3 + i).width = 22; });

    drawTimetableHeader(ws, school, yearInfo, termInfo, `CLASS TIMETABLE — ${(cls?.name || '').toUpperCase()}`, totalCols);

    // Row 4: column headers
    const hr = ws.getRow(4); hr.height = 20;
    [['#', 1], ['Period', 2], ...days.map((d, i) => [DAY_NAMES[d-1], 3+i])].forEach(([label, col]) => {
      const c = hr.getCell(col);
      c.value = label; c.font = nBold(9); c.fill = navyFill(); c.alignment = centre(); c.border = thin();
    });

    // Data rows
    let rowNum = 5;
    periods.forEach((p, pi) => {
      const row = ws.getRow(rowNum++);
      row.height = p.is_break ? 12 : 28;
      const isBrk = p.is_break;

      // # and Period name
      const nc = row.getCell(1);
      nc.value = p.period_number; nc.font = dFont(8, true); nc.fill = isBrk ? lgrayFill() : lblueFill();
      nc.alignment = centre(); nc.border = thin();

      const pn = row.getCell(2);
      const timeStr = `${(p.start_time||'').slice(0,5)}–${(p.end_time||'').slice(0,5)}`;
      pn.value = `${p.name}\n${timeStr}`; pn.font = dFont(8, true); pn.fill = isBrk ? lgrayFill() : lblueFill();
      pn.alignment = left(); pn.border = thin();

      days.forEach((day, di) => {
        const cell = row.getCell(3 + di);
        if (isBrk) {
          cell.value = p.name; cell.font = dFont(8); cell.fill = lgrayFill();
          cell.alignment = centre(); cell.border = thin();
          return;
        }
        const slot = clsSlots.find(s => s.period_id === p.id && s.day_of_week === day);
        if (slot) {
          const lines = [
            slot.subject?.name || '—',
            slot.teacher?.full_name || '',
            slot.room?.name || '',
          ].filter(Boolean).join('\n');
          cell.value = lines;
          cell.font  = dFont(9, true);
          cell.fill  = whiteFill();
        } else {
          cell.fill = whiteFill();
        }
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        cell.border = thin();
      });
    });

    ws.views = [{ state:'frozen', xSplit:2, ySplit:4, activeCell:'C5' }];

    const fname = `timetable_${(cls?.name||'class').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) { console.error('generateClassTimetable:', err); res.status(500).json({ success:false, error:err.message }); }
};

// ── GENERATE TEACHER TIMETABLE ────────────────────────────────
exports.generateTeacherTimetable = async (req, res) => {
  try {
    const { teacher_id, academic_year_id, term_id } = req.query;
    if (!teacher_id || !academic_year_id) return res.status(400).json({ success:false, error:'teacher_id and academic_year_id required' });

    const { periods, slots, school, yearInfo, termInfo } = await fetchTimetableData(req.schoolId, academic_year_id, term_id);
    const { data: teacher } = await supabase.from('staff').select('full_name,role').eq('id', teacher_id).single();
    const tSlots = slots.filter(s => s.teacher_id === teacher_id);

    const usedDays = [...new Set(tSlots.map(s => s.day_of_week))].sort();
    const days = usedDays.length > 0 ? usedDays : [1,2,3,4,5];

    const wb = new ExcelJS.Workbook();
    wb.creator = school.school_name || 'SchoolMS';
    const ws = wb.addWorksheet('Teacher Timetable', {
      pageSetup: { paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 }
    });

    const totalCols = 2 + days.length;
    ws.getColumn(1).width = 6; ws.getColumn(2).width = 18;
    days.forEach((_, i) => { ws.getColumn(3+i).width = 22; });

    drawTimetableHeader(ws, school, yearInfo, termInfo, `TEACHER TIMETABLE — ${(teacher?.full_name||'').toUpperCase()}`, totalCols);

    const hr = ws.getRow(4); hr.height = 20;
    [['#',1],['Period',2],...days.map((d,i)=>[DAY_NAMES[d-1],3+i])].forEach(([label,col])=>{
      const c=hr.getCell(col); c.value=label; c.font=nBold(9); c.fill=navyFill(); c.alignment=centre(); c.border=thin();
    });

    let rowNum = 5;
    periods.forEach(p => {
      const row = ws.getRow(rowNum++);
      row.height = p.is_break ? 12 : 28;
      const nc = row.getCell(1); nc.value = p.period_number; nc.font=dFont(8,true); nc.fill=p.is_break?lgrayFill():lblueFill(); nc.alignment=centre(); nc.border=thin();
      const pn = row.getCell(2); pn.value=`${p.name}\n${(p.start_time||'').slice(0,5)}–${(p.end_time||'').slice(0,5)}`; pn.font=dFont(8,true); pn.fill=p.is_break?lgrayFill():lblueFill(); pn.alignment=left(); pn.border=thin();
      days.forEach((day,di)=>{
        const cell = row.getCell(3+di);
        if (p.is_break) { cell.value=p.name; cell.font=dFont(8); cell.fill=lgrayFill(); cell.alignment=centre(); cell.border=thin(); return; }
        const slot = tSlots.find(s=>s.period_id===p.id&&s.day_of_week===day);
        if (slot) { cell.value=`${slot.subject?.name||'—'}\n${slot.class?.name||''}\n${slot.room?.name||''}`; cell.font=dFont(9,true); cell.fill=whiteFill(); }
        else { cell.fill=whiteFill(); }
        cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}; cell.border=thin();
      });
    });

    // Workload summary below
    rowNum++;
    const smRow = ws.getRow(rowNum);
    ws.mergeCells(rowNum, 1, rowNum, totalCols);
    smRow.getCell(1).value = `Total periods per week: ${tSlots.length}`;
    smRow.getCell(1).font = dFont(9, true);
    smRow.getCell(1).fill = lblueFill();
    smRow.getCell(1).alignment = left();

    ws.views=[{state:'frozen',xSplit:2,ySplit:4,activeCell:'C5'}];
    const fname=`teacher_timetable_${(teacher?.full_name||'teacher').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) { console.error('generateTeacherTimetable:',err); res.status(500).json({success:false,error:err.message}); }
};

// ── GENERATE SCHOOL TIMETABLE (all classes, one sheet per class) ──
exports.generateSchoolTimetable = async (req, res) => {
  try {
    const { academic_year_id, term_id } = req.query;
    if (!academic_year_id) return res.status(400).json({ success:false, error:'academic_year_id required' });

    const { periods, slots, school, yearInfo, termInfo } = await fetchTimetableData(req.schoolId, academic_year_id, term_id);
    const { data: classes } = await supabase.from('classes').select('id,name,level').eq('school_id', req.schoolId).order('level_order').order('name');

    const wb = new ExcelJS.Workbook();
    wb.creator = school.school_name || 'SchoolMS';

    // One sheet per class
    for (const cls of (classes || [])) {
      const clsSlots = slots.filter(s => s.class_id === cls.id);
      const usedDays = [...new Set(clsSlots.map(s=>s.day_of_week))].sort();
      const days = usedDays.length > 0 ? usedDays : [1,2,3,4,5];
      const sheetName = (cls.name || 'Class').substring(0, 31);
      const ws = wb.addWorksheet(sheetName, { pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0} });
      const totalCols = 2 + days.length;
      ws.getColumn(1).width=6; ws.getColumn(2).width=18;
      days.forEach((_,i)=>{ ws.getColumn(3+i).width=20; });

      drawTimetableHeader(ws, school, yearInfo, termInfo, `${cls.name.toUpperCase()}${cls.level?` (${cls.level})`:''}`, totalCols);

      const hr=ws.getRow(4); hr.height=20;
      [['#',1],['Period',2],...days.map((d,i)=>[DAY_NAMES[d-1],3+i])].forEach(([label,col])=>{
        const c=hr.getCell(col); c.value=label; c.font=nBold(9); c.fill=navyFill(); c.alignment=centre(); c.border=thin();
      });

      let rowNum=5;
      periods.forEach(p=>{
        const row=ws.getRow(rowNum++); row.height=p.is_break?12:26;
        const nc=row.getCell(1); nc.value=p.period_number; nc.font=dFont(8,true); nc.fill=p.is_break?lgrayFill():lblueFill(); nc.alignment=centre(); nc.border=thin();
        const pn=row.getCell(2); pn.value=`${p.name}\n${(p.start_time||'').slice(0,5)}–${(p.end_time||'').slice(0,5)}`; pn.font=dFont(8,true); pn.fill=p.is_break?lgrayFill():lblueFill(); pn.alignment=left(); pn.border=thin();
        days.forEach((day,di)=>{
          const cell=row.getCell(3+di);
          if(p.is_break){cell.value=p.name;cell.font=dFont(8);cell.fill=lgrayFill();cell.alignment=centre();cell.border=thin();return;}
          const slot=clsSlots.find(s=>s.period_id===p.id&&s.day_of_week===day);
          if(slot){cell.value=`${slot.subject?.name||'—'}\n${slot.teacher?.full_name||''}`; cell.font=dFont(9,true); cell.fill=whiteFill();}
          else{cell.fill=whiteFill();}
          cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}; cell.border=thin();
        });
      });
      ws.views=[{state:'frozen',xSplit:2,ySplit:4,activeCell:'C5'}];
    }

    // Summary sheet
    const sumWs = wb.addWorksheet('Summary');
    sumWs.getColumn(1).width=20; sumWs.getColumn(2).width=12; sumWs.getColumn(3).width=12;
    ['Class','Total Slots','Days Used'].forEach((h,i)=>{
      const c=sumWs.getRow(1).getCell(i+1); c.value=h; c.font=nBold(10); c.fill=navyFill(); c.alignment=centre(); c.border=thin();
    });
    (classes||[]).forEach((cls,ri)=>{
      const clsSlots=slots.filter(s=>s.class_id===cls.id);
      const usedDays=[...new Set(clsSlots.map(s=>s.day_of_week))].length;
      [cls.name, clsSlots.length, usedDays].forEach((v,ci)=>{
        const c=sumWs.getRow(ri+2).getCell(ci+1); c.value=v; c.font=dFont(9); c.alignment=ci===0?left():centre(); c.border=thin();
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ri%2===0?WHITE:LGRAY}};
      });
    });

    const fname=`school_timetable_${(yearInfo.name||'').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    await wb.xlsx.write(res); res.end();
  } catch(err){console.error('generateSchoolTimetable:',err);res.status(500).json({success:false,error:err.message});}
};

// ══════════════════════════════════════════════════════════════
// AUTO-GENERATE TIMETABLE — Full constraint-based scheduler
//
// Constraints:
//  1. Max 2 periods per subject per day per class
//  2. Max 7 periods per subject per week per class
//  3. No subject on consecutive days (spread evenly)
//  4. No teacher double-booking (same teacher, same period, same day)
//  5. Core subjects weighted (more periods per week)
//  6. Every assigned subject must appear at least once in the timetable
//  7. All available slots filled
// ══════════════════════════════════════════════════════════════
exports.autoGenerate = async (req, res) => {
  try {
    const { academic_year_id, term_id, days_per_week = 5, overwrite = false } = req.body;
    if (!academic_year_id) return res.status(400).json({ success: false, error: 'academic_year_id required' });

    const schoolId = req.schoolId;
    const numDays  = Math.min(parseInt(days_per_week) || 5, 6);
    const days     = Array.from({ length: numDays }, (_, i) => i + 1);

    // ── Load lesson periods ──────────────────────────────────
    let pq = supabase.from('school_periods')
      .select('id,period_number').eq('school_id', schoolId).eq('is_break', false);
    if (term_id) pq = pq.eq('term_id', term_id);
    else         pq = pq.eq('academic_year_id', academic_year_id);
    const { data: periods } = await pq.order('period_number');

    if (!periods || periods.length === 0)
      return res.status(400).json({ success: false, error: 'No lesson periods configured. Create periods first.' });

    // ── Load classes ─────────────────────────────────────────
    const { data: classes } = await supabase.from('classes')
      .select('id,name').eq('school_id', schoolId).order('level_order').order('name');
    if (!classes || classes.length === 0)
      return res.status(400).json({ success: false, error: 'No classes found.' });

    // ── Load class_subjects with subject details ─────────────
    const { data: allCS } = await supabase.from('class_subjects')
      .select('class_id,subject_id,teacher_id,sort_order,is_core,subject:subjects(id,name,coefficient,sort_order,is_core)')
      .in('class_id', classes.map(c => c.id))
      .not('subject_id', 'is', null);

    // ── Overwrite ────────────────────────────────────────────
    if (overwrite) {
      let dq = supabase.from('timetable_slots').delete()
        .eq('school_id', schoolId).eq('academic_year_id', academic_year_id);
      if (term_id) dq = dq.eq('term_id', term_id);
      await dq;
    }

    // ── Global teacher busy: Set of "teacherId|day|periodId" ──
    const teacherBusy = new Set();
    const tKey = (tid, day, pid) => `${tid}|${day}|${pid}`;

    const slotsToInsert = [];
    let totalConflicts  = 0;
    const totalSlots    = days.length * periods.length;
    const MAX_PER_WEEK  = 7;
    const MAX_PER_DAY   = 2;

    // ── Process each class ───────────────────────────────────
    for (const cls of classes) {
      const rawSubs = (allCS || []).filter(cs => cs.class_id === cls.id);
      if (rawSubs.length === 0) continue;

      // Build subject list with weights
      const subList = rawSubs.map(cs => {
        const sub    = cs.subject || {};
        const isCore = cs.is_core ?? sub.is_core ?? false;
        const coef   = sub.coefficient || 1;
        const weight = isCore ? Math.min(MAX_PER_WEEK, Math.max(3, coef * 3)) : Math.min(MAX_PER_WEEK, Math.max(1, coef));
        return { ...cs, isCore, weight, sortOrder: cs.sort_order ?? sub.sort_order ?? 999 };
      }).sort((a, b) => {
        if (b.isCore !== a.isCore) return b.isCore ? 1 : -1;
        return a.sortOrder - b.sortOrder;
      });

      // Calculate target periods per subject
      // Ensure: sum of targets ≤ totalSlots AND max per subject ≤ MAX_PER_WEEK
      // Guarantee: every subject gets at least 1
      const totalWeight = subList.reduce((s, x) => s + x.weight, 0);
      const targetMap   = {};
      let   sumTargets  = 0;
      subList.forEach(cs => {
        const raw = Math.round((cs.weight / totalWeight) * totalSlots);
        const tgt = Math.min(MAX_PER_WEEK, Math.max(1, raw));
        targetMap[cs.subject_id] = tgt;
        sumTargets += tgt;
      });

      // If sum > totalSlots, reduce from lowest-weight subjects first
      while (sumTargets > totalSlots) {
        const reducible = [...subList]
          .sort((a,b) => a.weight - b.weight)
          .find(cs => targetMap[cs.subject_id] > 1);
        if (!reducible) break;
        targetMap[reducible.subject_id]--;
        sumTargets--;
      }
      // If sum < totalSlots, add more to highest-weight subjects (up to MAX_PER_WEEK)
      let expandIdx = 0;
      const sorted  = [...subList].sort((a,b) => b.weight - a.weight);
      while (sumTargets < totalSlots) {
        const cs = sorted[expandIdx % sorted.length];
        if (targetMap[cs.subject_id] < MAX_PER_WEEK) {
          targetMap[cs.subject_id]++;
          sumTargets++;
        }
        expandIdx++;
        if (expandIdx > sorted.length * MAX_PER_WEEK) break; // safety
      }

      // Build a weekly queue: each subject repeated targetMap[sid] times
      // Spread across days: for each subject, pre-assign which days it can appear
      // to avoid consecutive-day constraint
      // Strategy: assign days in a round-robin manner skipping adjacent days
      const subjectDayMap = {}; // { subject_id: Set<day> } — allowed days this week
      subList.forEach(cs => {
        const tgt  = targetMap[cs.subject_id] || 1;
        const allowed = new Set();
        // Pick `tgt` days spread across the week, no consecutive
        const allDays = [...days];
        let   lastPicked = -2;
        let   picked     = 0;
        // Try evenly spaced
        const step = Math.max(1, Math.floor(numDays / tgt));
        for (let d = 0; d < numDays && picked < tgt; d += step) {
          const day = allDays[d % allDays.length];
          if (day !== lastPicked + 1 && day !== lastPicked - 1) {
            allowed.add(day); lastPicked = day; picked++;
          }
        }
        // Fill remaining if needed
        for (const day of allDays) {
          if (allowed.size >= tgt) break;
          if (!allowed.has(day)) { allowed.add(day); }
        }
        subjectDayMap[cs.subject_id] = allowed;
      });

      // Build per-day slot pools
      // dayPool[day] = list of subjects allowed on that day, ordered by weight desc
      const dayPool = {};
      days.forEach(day => {
        dayPool[day] = subList.filter(cs => subjectDayMap[cs.subject_id]?.has(day))
          .sort((a,b) => b.weight - a.weight);
      });

      // Tracking per class
      const weekCount = {}; // subject_id → total placed this week
      const dayCount  = {}; // day → subject_id → count
      days.forEach(d => { dayCount[d] = {}; });

      // Fill each slot
      for (const day of days) {
        // Sort periods (already ordered)
        for (const period of periods) {
          // Find best subject for this slot
          // Priority: most remaining quota, allowed today, not exceeding day limit, teacher free, not yesterday
          let placed = false;

          // Build candidates: subjects not yet at day limit, with remaining weekly quota
          const candidates = subList.filter(cs => {
            const dc = dayCount[day][cs.subject_id] || 0;
            const wc = weekCount[cs.subject_id] || 0;
            if (dc >= MAX_PER_DAY) return false;
            if (wc >= (targetMap[cs.subject_id] || 1)) return false;
            // No consecutive day: check if subject was placed yesterday
            if (day > 1) {
              const yday = dayCount[day-1]?.[cs.subject_id] || 0;
              // Allow on consecutive day only if no other option
              // We'll try non-consecutive first
            }
            return true;
          });

          // Prefer non-consecutive-day candidates
          const nonConsec = candidates.filter(cs => {
            if (day <= 1) return true;
            return (dayCount[day-1]?.[cs.subject_id] || 0) === 0;
          });

          const pool = nonConsec.length > 0 ? nonConsec : candidates;
          // Sort: most remaining quota first, then by weight desc
          pool.sort((a,b) => {
            const remA = (targetMap[a.subject_id]||1) - (weekCount[a.subject_id]||0);
            const remB = (targetMap[b.subject_id]||1) - (weekCount[b.subject_id]||0);
            if (remB !== remA) return remB - remA;
            return b.weight - a.weight;
          });

          for (const cs of pool) {
            const tid = cs.teacher_id;
            if (tid && teacherBusy.has(tKey(tid, day, period.id))) continue;

            // Place this subject
            if (tid) teacherBusy.add(tKey(tid, day, period.id));
            dayCount[day][cs.subject_id] = (dayCount[day][cs.subject_id] || 0) + 1;
            weekCount[cs.subject_id]     = (weekCount[cs.subject_id] || 0) + 1;

            slotsToInsert.push({
              school_id: schoolId, academic_year_id,
              term_id: term_id || null, class_id: cls.id,
              subject_id: cs.subject_id, teacher_id: tid || null,
              period_id: period.id, day_of_week: day, room_id: null,
            });
            placed = true;
            break;
          }

          if (!placed) {
            // Absolute fallback: any subject with teacher free, ignore quota/consecutive rules
            const fallback = subList.find(cs => {
              const tid = cs.teacher_id;
              return !tid || !teacherBusy.has(tKey(tid, day, period.id));
            });
            if (fallback) {
              const tid = fallback.teacher_id;
              if (tid) teacherBusy.add(tKey(tid, day, period.id));
              dayCount[day][fallback.subject_id] = (dayCount[day][fallback.subject_id] || 0) + 1;
              weekCount[fallback.subject_id]     = (weekCount[fallback.subject_id] || 0) + 1;
              slotsToInsert.push({
                school_id: schoolId, academic_year_id,
                term_id: term_id || null, class_id: cls.id,
                subject_id: fallback.subject_id, teacher_id: tid || null,
                period_id: period.id, day_of_week: day, room_id: null,
              });
            } else {
              totalConflicts++;
            }
          }
        }
      }

      // ── Guarantee: every subject appears at least once ────────
      // Check which subjects are missing from the timetable for this class
      const placed = new Set(
        slotsToInsert.filter(s => s.class_id === cls.id).map(s => s.subject_id)
      );
      for (const cs of subList) {
        if (!placed.has(cs.subject_id)) {
          // Find any empty-ish slot (pick day=1, first period that teacher is free)
          let inserted = false;
          for (const day of days) {
            for (const period of periods) {
              const exists = slotsToInsert.find(
                s => s.class_id === cls.id && s.day_of_week === day && s.period_id === period.id
              );
              if (!exists) {
                const tid = cs.teacher_id;
                if (tid && teacherBusy.has(tKey(tid, day, period.id))) continue;
                if (tid) teacherBusy.add(tKey(tid, day, period.id));
                slotsToInsert.push({
                  school_id: schoolId, academic_year_id,
                  term_id: term_id || null, class_id: cls.id,
                  subject_id: cs.subject_id, teacher_id: tid || null,
                  period_id: period.id, day_of_week: day, room_id: null,
                });
                inserted = true;
                break;
              }
            }
            if (inserted) break;
          }
        }
      }
    }

    // ── Insert in chunks ────────────────────────────────────
    const CHUNK = 50;
    let   insertedCount = 0;
    for (let i = 0; i < slotsToInsert.length; i += CHUNK) {
      const { data, error } = await supabase.from('timetable_slots')
        .upsert(slotsToInsert.slice(i, i + CHUNK),
          { onConflict: 'school_id,class_id,period_id,day_of_week', ignoreDuplicates: !overwrite })
        .select('id');
      if (!error) insertedCount += (data || []).length;
    }

    res.json({
      success:     true,
      inserted:    insertedCount,
      conflicts:   totalConflicts,
      total_classes: classes.length,
      slots_per_class: totalSlots,
      message: `Generated ${insertedCount} slots across ${classes.length} classes (${totalSlots} slots/class).${totalConflicts > 0 ? ` ${totalConflicts} unfilled (teacher conflicts).` : ' All slots filled.'}`,
    });
  } catch (err) {
    console.error('autoGenerate:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
exports.autoGenerate = async (req, res) => {
  try {
    const { academic_year_id, term_id, days_per_week = 5, overwrite = false } = req.body;
    if (!academic_year_id) return res.status(400).json({ success: false, error: 'academic_year_id required' });

    const schoolId = req.schoolId;
    const numDays  = Math.min(parseInt(days_per_week) || 5, 6);
    const days     = Array.from({ length: numDays }, (_, i) => i + 1); // [1,2,3,4,5]

    // 1. Load lesson periods only
    let pq = supabase.from('school_periods')
      .select('id,period_number,start_time,end_time')
      .eq('school_id', schoolId).eq('is_break', false);
    if (term_id)          pq = pq.eq('term_id', term_id);
    else if (academic_year_id) pq = pq.eq('academic_year_id', academic_year_id);
    const { data: periods } = await pq.order('period_number');

    if (!periods || periods.length === 0) {
      return res.status(400).json({ success: false, error: 'No lesson periods configured. Create periods first.' });
    }

    // 2. Load all classes
    const { data: classes } = await supabase.from('classes')
      .select('id,name').eq('school_id', schoolId).order('level_order').order('name');
    if (!classes || classes.length === 0) {
      return res.status(400).json({ success: false, error: 'No classes found.' });
    }

    // 3. Load all class_subjects with subject details
    const { data: allCS } = await supabase.from('class_subjects')
      .select('class_id, subject_id, teacher_id, sort_order, is_core, subject:subjects(id,name,code,sort_order,is_core,coefficient)')
      .in('class_id', classes.map(c => c.id))
      .not('subject_id', 'is', null);

    // 4. Overwrite: clear existing
    if (overwrite) {
      let dq = supabase.from('timetable_slots').delete()
        .eq('school_id', schoolId).eq('academic_year_id', academic_year_id);
      if (term_id) dq = dq.eq('term_id', term_id);
      await dq;
    }

    // 5. Global teacher busy map: teacherBusy[teacherId_day_periodId] = true
    const teacherBusy = new Set();
    const tKey = (tid, day, pid) => `${tid}|${day}|${pid}`;

    const slotsToInsert = [];
    let totalConflicts  = 0;
    const totalPeriods  = days.length * periods.length; // slots available per class

    // 6. Process each class
    for (const cls of classes) {
      const rawSubs = (allCS || []).filter(cs => cs.class_id === cls.id);
      if (rawSubs.length === 0) continue;

      // Build subject list with weights
      // Core subjects get higher weight; sort_order also matters
      // Weight scheme: is_core=true → weight proportional to coefficient + priority
      // non-core → weight 1
      const subjectList = rawSubs.map(cs => {
        const sub    = cs.subject || {};
        const isCore = cs.is_core ?? sub.is_core ?? false;
        const coef   = sub.coefficient || 1;
        // Base weight: core gets 3×coefficient, non-core gets 1
        const weight = isCore ? Math.max(3, coef * 3) : 1;
        return { ...cs, isCore, weight, sortOrder: cs.sort_order ?? sub.sort_order ?? 999 };
      }).sort((a, b) => {
        // Sort: core first, then by sort_order
        if (b.isCore !== a.isCore) return b.isCore ? 1 : -1;
        return a.sortOrder - b.sortOrder;
      });

      // Calculate total weight to distribute periods proportionally
      const totalWeight    = subjectList.reduce((s, x) => s + x.weight, 0);
      // Assign target periods per subject (proportional to weight, min 1)
      const targetMap = {};
      let assigned = 0;
      subjectList.forEach(cs => {
        const tgt = Math.max(1, Math.round((cs.weight / totalWeight) * totalPeriods));
        targetMap[cs.subject_id] = tgt;
        assigned += tgt;
      });
      // Adjust rounding: make sum = totalPeriods
      let diff = totalPeriods - assigned;
      // Give extra to highest-weight subjects
      const sorted = [...subjectList].sort((a,b) => b.weight - a.weight);
      for (let i = 0; diff > 0; i++, diff--) {
        targetMap[sorted[i % sorted.length].subject_id]++;
      }
      for (let i = 0; diff < 0; i++, diff++) {
        const sid = sorted[i % sorted.length].subject_id;
        if (targetMap[sid] > 1) targetMap[sid]--;
        else diff++; // skip if already at minimum
      }

      // Track how many periods each subject has been placed this week
      const weekCount = {};
      // Track how many periods each subject has been placed today per class
      // dayCount[day][subject_id]
      const dayCount  = {};
      days.forEach(d => { dayCount[d] = {}; });

      // Build a queue: repeat each subject according to its target count
      // shuffle to avoid always putting same subject first in the day
      const queue = [];
      subjectList.forEach(cs => {
        const t = targetMap[cs.subject_id] || 1;
        for (let k = 0; k < t; k++) queue.push(cs);
      });
      // Sort queue: core first, then by sort_order, then shuffle within same priority level
      queue.sort((a, b) => {
        if (b.isCore !== a.isCore) return b.isCore ? 1 : -1;
        return a.sortOrder - b.sortOrder;
      });

      // Place subjects into slots
      // Strategy: for each day × period, pick the next subject from queue
      // that: (a) hasn't exceeded 2 per day in this class, (b) teacher is free
      let queueIdx = 0;

      for (const day of days) {
        for (const period of periods) {
          // Try to find a valid subject from queue starting at queueIdx
          let placed = false;
          const startIdx = queueIdx;

          for (let attempt = 0; attempt < queue.length; attempt++) {
            const idx = (startIdx + attempt) % queue.length;
            const cs  = queue[idx];

            if (!cs) continue;

            // Rule: max 2 periods per subject per day per class
            const dCount = dayCount[day][cs.subject_id] || 0;
            if (dCount >= 2) continue;

            // Rule: teacher must be free at this day+period
            const tid = cs.teacher_id;
            if (tid && teacherBusy.has(tKey(tid, day, period.id))) continue;

            // Valid slot found — place it
            if (tid) teacherBusy.add(tKey(tid, day, period.id));
            dayCount[day][cs.subject_id] = dCount + 1;
            weekCount[cs.subject_id]     = (weekCount[cs.subject_id] || 0) + 1;

            slotsToInsert.push({
              school_id:       schoolId,
              academic_year_id,
              term_id:         term_id || null,
              class_id:        cls.id,
              subject_id:      cs.subject_id,
              teacher_id:      tid || null,
              period_id:       period.id,
              day_of_week:     day,
              room_id:         null,
            });

            // Remove this entry from queue so it won't be re-used
            queue.splice(idx, 1);
            queueIdx = idx % Math.max(1, queue.length);
            placed = true;
            break;
          }

          if (!placed) {
            // All subjects maxed for this day — reuse least-used subject that fits
            // (fallback to avoid empty slots)
            const fallback = [...subjectList].sort((a, b) =>
              (dayCount[day][a.subject_id] || 0) - (dayCount[day][b.subject_id] || 0)
            ).find(cs => {
              const tid = cs.teacher_id;
              return !tid || !teacherBusy.has(tKey(tid, day, period.id));
            });

            if (fallback) {
              const tid = fallback.teacher_id;
              if (tid) teacherBusy.add(tKey(tid, day, period.id));
              dayCount[day][fallback.subject_id] = (dayCount[day][fallback.subject_id] || 0) + 1;
              slotsToInsert.push({
                school_id: schoolId, academic_year_id,
                term_id: term_id || null, class_id: cls.id,
                subject_id: fallback.subject_id, teacher_id: tid || null,
                period_id: period.id, day_of_week: day, room_id: null,
              });
            } else {
              totalConflicts++;
            }
          }
        }
      }
    }

    // 7. Insert in chunks
    const CHUNK = 50;
    let inserted = 0;
    for (let i = 0; i < slotsToInsert.length; i += CHUNK) {
      const { data, error } = await supabase.from('timetable_slots')
        .upsert(slotsToInsert.slice(i, i + CHUNK),
          { onConflict: 'school_id,class_id,period_id,day_of_week', ignoreDuplicates: !overwrite })
        .select('id');
      if (!error) inserted += (data || []).length;
    }

    res.json({
      success: true,
      inserted,
      conflicts: totalConflicts,
      total_classes: classes.length,
      total_periods_per_class: totalPeriods,
      message: `Generated ${inserted} slots across ${classes.length} classes (${totalPeriods} slots/class). ${totalConflicts > 0 ? `${totalConflicts} unfilled due to teacher conflicts.` : 'No conflicts.'}`,
    });
  } catch (err) {
    console.error('autoGenerate:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
