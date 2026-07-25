'use strict';
const axios        = require('axios');
const { supabase } = require('../supabase');

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── POST /api/sms/ai/timetable-chat ──────────────────────────
exports.timetableChat = async (req, res) => {
  try {
    const { message, history = [], academic_year_id, term_id } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message required' });
    if (!MISTRAL_KEY) return res.status(500).json({ success: false, error: 'MISTRAL_API_KEY not set on server. Add it in Render dashboard → Environment.' });

    const schoolId = req.schoolId;

    // ── 1. Fetch all raw data ─────────────────────────────────
    const [
      { data: slots },
      { data: classes },
      { data: allTeachers },
      { data: allSubjects },
      { data: periods },
      { data: classSubjects },
    ] = await Promise.all([
      supabase.from('timetable_slots')
        .select('day_of_week, period_id, class_id, subject_id, teacher_id, class:classes(name), subject:subjects(name,code,max_periods_week,is_core), teacher:staff(full_name), period:school_periods(name,period_number,is_break)')
        .eq('school_id', schoolId),
      supabase.from('classes').select('id,name,level').eq('school_id', schoolId).order('name'),
      supabase.from('staff').select('id,full_name,role').eq('school_id', schoolId).eq('is_active', true).in('role',['teacher','dos']),
      supabase.from('subjects').select('id,name,code,max_periods_week,is_core').eq('school_id', schoolId),
      supabase.from('school_periods').select('id,name,period_number,is_break,start_time,end_time').eq('school_id', schoolId).order('period_number'),
      supabase.from('class_subjects').select('class_id,subject_id,teacher_id, class:classes(name), subject:subjects(name,code,max_periods_week), teacher:staff(full_name)').eq('school_id', schoolId),
    ]);

    const slotList  = slots || [];
    const teachList = allTeachers || [];
    const subList   = allSubjects || [];
    const clsList   = classes || [];
    const prdList   = (periods || []).filter(p => !p.is_break);
    const cssList   = classSubjects || [];

    // ── 2. Pre-compute analytics ──────────────────────────────

    // Teacher workload: periods per week + per day
    const teacherWorkload = {};
    teachList.forEach(t => {
      teacherWorkload[t.id] = { name: t.full_name, total: 0, byDay: {}, byClass: {}, bySubject: {} };
    });
    slotList.forEach(s => {
      if (!s.teacher_id || !teacherWorkload[s.teacher_id]) return;
      const tw = teacherWorkload[s.teacher_id];
      tw.total++;
      const day = DAYS[(s.day_of_week || 1) - 1];
      tw.byDay[day] = (tw.byDay[day] || 0) + 1;
      const cn = s.class?.name || s.class_id;
      tw.byClass[cn] = (tw.byClass[cn] || 0) + 1;
      const sn = s.subject?.code || s.subject?.name || s.subject_id;
      tw.bySubject[sn] = (tw.bySubject[sn] || 0) + 1;
    });

    // Subject distribution per class
    const classSubjectCount = {}; // classId -> subjectId -> count
    slotList.forEach(s => {
      if (!s.class_id || !s.subject_id) return;
      if (!classSubjectCount[s.class_id]) classSubjectCount[s.class_id] = {};
      classSubjectCount[s.class_id][s.subject_id] = (classSubjectCount[s.class_id][s.subject_id] || 0) + 1;
    });

    // Day load per class
    const classDayLoad = {};
    slotList.forEach(s => {
      if (!s.class_id) return;
      const day = DAYS[(s.day_of_week || 1) - 1];
      if (!classDayLoad[s.class_id]) classDayLoad[s.class_id] = {};
      classDayLoad[s.class_id][day] = (classDayLoad[s.class_id][day] || 0) + 1;
    });

    // Teacher conflicts
    const teacherConflicts = [];
    const teacherDayPeriod = {};
    slotList.forEach(s => {
      if (!s.teacher_id) return;
      const key = `${s.teacher_id}:${s.day_of_week}:${s.period_id}`;
      if (teacherDayPeriod[key]) {
        teacherConflicts.push({
          teacher: s.teacher?.full_name || '?',
          day:     DAYS[(s.day_of_week || 1) - 1],
          period:  s.period?.name || '?',
          classes: [teacherDayPeriod[key].class?.name, s.class?.name].filter(Boolean),
        });
      } else { teacherDayPeriod[key] = s; }
    });

    // Subjects exceeding weekly max per class
    const overloadedSubjects = [];
    Object.entries(classSubjectCount).forEach(([classId, subMap]) => {
      const cls = clsList.find(c => c.id === classId);
      Object.entries(subMap).forEach(([subjectId, count]) => {
        const sub = subList.find(s => s.id === subjectId);
        const maxW = sub?.max_periods_week || 7;
        if (count > maxW) {
          overloadedSubjects.push({ class: cls?.name || classId, subject: sub?.name || subjectId, count, max: maxW });
        }
      });
    });

    // Subjects assigned but MISSING from timetable per class
    const missingSubjects = [];
    cssList.forEach(cs => {
      const cls = clsList.find(c => c.id === cs.class_id);
      const sub = subList.find(s => s.id === cs.subject_id);
      if (!cls || !sub) return;
      const count = classSubjectCount[cs.class_id]?.[cs.subject_id] || 0;
      if (count === 0) {
        missingSubjects.push({ class: cls.name, subject: sub.name });
      }
    });

    // Teachers with no slots assigned
    const unassignedTeachers = teachList.filter(t =>
      !slotList.some(s => s.teacher_id === t.id)
    ).map(t => t.full_name);

    // Classes with no slots at all
    const emptyClasses = clsList.filter(c =>
      !slotList.some(s => s.class_id === c.id)
    ).map(c => c.name);

    // ── 3. Build structured context ───────────────────────────
    const teacherWorkloadLines = Object.values(teacherWorkload)
      .filter(t => t.total > 0)
      .sort((a, b) => b.total - a.total)
      .map(t => {
        const dayBreakdown = Object.entries(t.byDay).map(([d, n]) => `${d.slice(0,3)}: ${n}`).join(', ');
        const classBreakdown = Object.entries(t.byClass).map(([c, n]) => `${c}×${n}`).join(', ');
        return `  - ${t.name}: ${t.total} periods/wk | by day: ${dayBreakdown || 'none'} | classes: ${classBreakdown || 'none'}`;
      }).join('\n');

    const classSubjectLines = clsList.map(cls => {
      const counts = classSubjectCount[cls.id] || {};
      if (Object.keys(counts).length === 0) return `  - ${cls.name}: NO SLOTS ASSIGNED`;
      const parts = Object.entries(counts).map(([sid, n]) => {
        const sub = subList.find(s => s.id === sid);
        const maxW = sub?.max_periods_week || 7;
        const flag = n > maxW ? ` ⚠OVER(max ${maxW})` : '';
        return `${sub?.code || sub?.name || '?'}:${n}${flag}`;
      });
      return `  - ${cls.name}: ${parts.join(', ')}`;
    }).join('\n');

    const context = `
=== SCHOOL TIMETABLE ANALYSIS REPORT ===
School ID: ${schoolId}
Total slots filled: ${slotList.length}
Classes: ${clsList.map(c => c.name).join(', ')}
Active teaching periods per day: ${prdList.length}

=== TEACHER WORKLOAD ===
${teacherWorkloadLines || '  (no teacher assignments found)'}

=== SUBJECT DISTRIBUTION PER CLASS ===
(format: SUBJECT_CODE:periods_per_week)
${classSubjectLines || '  (no class data)'}

=== CONFLICTS DETECTED ===
Teacher double-bookings: ${teacherConflicts.length === 0 ? 'NONE' : teacherConflicts.map(c =>
  `${c.teacher} is double-booked on ${c.day} during ${c.period} (${c.classes.join(' AND ')})`
).join('; ')}

=== OVERLOADED SUBJECTS (exceeds weekly max) ===
${overloadedSubjects.length === 0 ? 'NONE' : overloadedSubjects.map(o =>
  `${o.class} - ${o.subject}: ${o.count} periods (max allowed: ${o.max})`
).join('\n')}

=== MISSING SUBJECTS (assigned but not in timetable) ===
${missingSubjects.length === 0 ? 'NONE' : missingSubjects.map(m => `${m.class} - ${m.subject}`).join('\n')}

=== TEACHERS WITH ZERO SLOTS ===
${unassignedTeachers.length === 0 ? 'NONE — all teachers have at least one slot' : unassignedTeachers.join(', ')}

=== CLASSES WITH NO SLOTS ===
${emptyClasses.length === 0 ? 'NONE' : emptyClasses.join(', ')}

=== RWANDA PRIMARY SCHOOL RULES ===
- MATH: max 9 periods/week (ideally 8)
- KINY/ENG: max 8 periods/week
- SRS/SET: max 6 periods/week
- Creative Arts (CA): max 1 period/week
- Physical Education (PES): max 1 period/week
- No teacher > 3 periods/day
- No subject > 2 periods/day per class
- No subject on consecutive days > 2 times in a row
- Every assigned subject must appear in the timetable
`.trim();

    // ── 4. Call Mistral ───────────────────────────────────────
    const systemPrompt = `You are a highly intelligent school timetable analyst for SchoolMS, a Rwandan primary school management system.

Your role:
- Analyze the EXACT timetable data provided in every message — never invent data
- Give precise, fact-based answers referring to actual teacher names, class names, subject codes, and period counts from the data
- Detect and explain real problems: conflicts, overloaded teachers, missing subjects, unbalanced days
- Suggest specific, actionable fixes (e.g., "Move Math from Redempta on P1-Monday to Dieudonne on P2-Tuesday")
- Follow Rwanda Primary School curriculum rules strictly
- Format responses clearly with **bold** for names/numbers, bullet points for lists
- Be concise but thorough — 3-6 sentences or a short list per answer
- Respond in the same language the user writes in (English, French, or Kinyarwanda)
- NEVER say you cannot access the timetable — the full data is provided to you`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: `${context}\n\n---\nQUESTION: ${message}` },
    ];

    const response = await axios.post(MISTRAL_URL, {
      model:       'mistral-small-latest',
      messages,
      max_tokens:  700,
      temperature: 0.3,
    }, {
      headers: { 'Authorization': `Bearer ${MISTRAL_KEY}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    });

    const reply = response.data.choices?.[0]?.message?.content || 'No response.';
    res.json({ success: true, reply, conflicts: teacherConflicts, stats: { totalSlots: slotList.length, conflicts: teacherConflicts.length, overloaded: overloadedSubjects.length, missing: missingSubjects.length } });

  } catch (err) {
    console.error('AI timetable chat error:', err.response?.data || err.message);
    if (err.response?.status === 401) return res.status(500).json({ success: false, error: 'MISTRAL_API_KEY is invalid or expired. Generate a new one at console.mistral.ai and set it in Render → Environment.' });
    if (err.response?.status === 422) return res.status(500).json({ success: false, error: 'Mistral request error: ' + (err.response?.data?.message || err.message) });
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/sms/ai/check-slot ───────────────────────────────
exports.checkSlot = async (req, res) => {
  try {
    const { teacher_id, period_id, day_of_week, class_id, subject_id, academic_year_id } = req.body;
    const schoolId = req.schoolId;
    const warnings = [];

    if (teacher_id && period_id && day_of_week) {
      // Teacher double-booking
      const { data: clash } = await supabase.from('timetable_slots')
        .select('id, class:classes(name)')
        .eq('school_id', schoolId).eq('teacher_id', teacher_id)
        .eq('period_id', period_id).eq('day_of_week', day_of_week)
        .neq('class_id', class_id || '00000000-0000-0000-0000-000000000000');
      if (clash?.length > 0) {
        warnings.push({ type:'teacher_conflict', severity:'error', message:`Teacher already assigned to ${clash[0].class?.name || 'another class'} at this time.` });
      }
      // Teacher daily load
      const { data: daySlots } = await supabase.from('timetable_slots')
        .select('id').eq('school_id', schoolId).eq('teacher_id', teacher_id).eq('day_of_week', day_of_week);
      if ((daySlots?.length || 0) >= 3) {
        warnings.push({ type:'workload', severity:'warning', message:`Teacher already has ${daySlots.length} period(s) this day (recommended max: 3).` });
      }
    }

    if (subject_id && class_id && day_of_week) {
      // Subject max 2/day per class
      const { data: daySubj } = await supabase.from('timetable_slots')
        .select('id').eq('school_id', schoolId).eq('class_id', class_id)
        .eq('subject_id', subject_id).eq('day_of_week', day_of_week);
      if ((daySubj?.length || 0) >= 2) {
        warnings.push({ type:'subject_per_day', severity:'warning', message:'This subject already appears twice today for this class.' });
      }
      // Weekly max
      const { data: sub } = await supabase.from('subjects').select('name,max_periods_week').eq('id', subject_id).single();
      if (sub) {
        const { data: weekSlots } = await supabase.from('timetable_slots')
          .select('id').eq('school_id', schoolId).eq('class_id', class_id).eq('subject_id', subject_id);
        const maxW = sub.max_periods_week || 7;
        if ((weekSlots?.length || 0) >= maxW) {
          warnings.push({ type:'weekly_max', severity:'error', message:`${sub.name} has reached its weekly maximum of ${maxW} periods.` });
        }
      }
    }

    res.json({ success: true, warnings, ok: warnings.filter(w => w.severity === 'error').length === 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
