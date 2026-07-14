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
