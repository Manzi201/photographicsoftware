'use strict';
const axios       = require('axios');
const { supabase } = require('../supabase');

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;

// ── POST /api/sms/ai/timetable-chat ───────────────────────────
// Body: { message, history?: [{role,content}], academic_year_id?, term_id? }
exports.timetableChat = async (req, res) => {
  try {
    const { message, history = [], academic_year_id, term_id } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message required' });

    const schoolId = req.schoolId;

    // ── Build timetable context snapshot ─────────────────────
    const [
      { data: slots },
      { data: classes },
      { data: teachers },
      { data: subjects },
      { data: periods },
      { data: conflicts },
    ] = await Promise.all([
      supabase.from('timetable_slots')
        .select('day_of_week, period_id, class_id, subject_id, teacher_id, room_id, class:classes(name), subject:subjects(name,code), teacher:staff(full_name), period:school_periods(name,period_number), room:rooms(name)')
        .eq('school_id', schoolId),
      supabase.from('classes').select('id,name,level').eq('school_id', schoolId),
      supabase.from('staff').select('id,full_name,role').eq('school_id', schoolId).eq('is_active', true).eq('role', 'teacher'),
      supabase.from('subjects').select('id,name,code,max_periods_week,is_core').eq('school_id', schoolId),
      supabase.from('school_periods').select('id,name,period_number,start_time,end_time,is_break').eq('school_id', schoolId).order('period_number'),
      Promise.resolve({ data: [] }), // placeholder
    ]);

    // Detect teacher conflicts from slots
    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const slotList = (slots || []);
    const teacherConflicts = [];
    const teacherDayPeriod = {};
    slotList.forEach(s => {
      if (!s.teacher_id) return;
      const key = `${s.teacher_id}:${s.day_of_week}:${s.period_id}`;
      if (teacherDayPeriod[key]) {
        teacherConflicts.push({
          teacher: s.teacher?.full_name || s.teacher_id,
          day: DAYS[(s.day_of_week || 1) - 1],
          period: s.period?.name || s.period_id,
          classes: [teacherDayPeriod[key].class?.name, s.class?.name].filter(Boolean),
        });
      } else {
        teacherDayPeriod[key] = s;
      }
    });

    // Workload summary
    const workload = {};
    slotList.forEach(s => {
      if (!s.teacher_id) return;
      const name = s.teacher?.full_name || s.teacher_id;
      workload[name] = (workload[name] || 0) + 1;
    });

    // Subject period count per class
    const subjectCount = {};
    slotList.forEach(s => {
      const cls  = s.class?.name  || s.class_id;
      const subj = s.subject?.name || s.subject_id;
      if (!cls || !subj) return;
      const k = `${cls}:${subj}`;
      subjectCount[k] = (subjectCount[k] || 0) + 1;
    });

    // Build context string
    const context = `
SCHOOL TIMETABLE CONTEXT (School ID: ${schoolId})
==============================================
Classes: ${(classes || []).map(c => c.name).join(', ')}
Teachers: ${(teachers || []).map(t => t.full_name).join(', ')}
Subjects: ${(subjects || []).map(s => `${s.name}(max ${s.max_periods_week || 7}/wk${s.is_core ? ' core' : ''})`).join(', ')}
Time Periods: ${(periods || []).filter(p => !p.is_break).map(p => `${p.name} ${p.start_time?.slice(0,5)}-${p.end_time?.slice(0,5)}`).join(', ')}

CURRENT TIMETABLE SUMMARY (${slotList.length} slots filled):
${slotList.slice(0, 80).map(s => `${s.class?.name || '?'} | ${DAYS[(s.day_of_week||1)-1]} | ${s.period?.name || '?'} | ${s.subject?.name || '?'} | ${s.teacher?.full_name || 'No teacher'}`).join('\n')}
${slotList.length > 80 ? `... and ${slotList.length - 80} more slots` : ''}

TEACHER WORKLOAD (periods/week):
${Object.entries(workload).map(([t, n]) => `${t}: ${n}`).join(', ') || 'No data'}

CONFLICTS: ${teacherConflicts.length === 0 ? 'None detected' : teacherConflicts.map(c => `${c.teacher} is double-booked on ${c.day} ${c.period} (${c.classes.join(' & ')})`).join('; ')}

RULES:
- MATH: max 9 periods/week per class
- KINY/ENG: max 8 periods/week per class  
- SRS/SET: max 6 periods/week per class
- CREATIVE ARTS: max 1 period/week
- No teacher should exceed 3 periods/day
- No subject more than 2 periods/day per class
- Teachers should not have back-to-back periods on same day > 3 times
`.trim();

    // ── Call Mistral AI ───────────────────────────────────────
    const messages = [
      {
        role: 'system',
        content: `You are an intelligent school timetable assistant for SchoolMS, a Rwandan primary school management system. 
You help the Director of Studies (DoS) and admin staff understand, analyze, and improve the school timetable.
You speak in a helpful, concise, professional tone.
When asked for suggestions, be specific: mention teacher names, subject names, class names, days, and periods.
Always base your answers on the timetable context provided.
When you detect issues, explain them clearly and suggest specific fixes.
If asked in French or Kinyarwanda, respond in that language.
Keep responses concise — max 4-5 paragraphs.`,
      },
      ...history.slice(-6), // last 6 messages for context window efficiency
      {
        role: 'user',
        content: `${context}\n\n---\nUSER QUESTION: ${message}`,
      },
    ];

    const response = await axios.post(MISTRAL_URL, {
      model: 'mistral-small-latest',
      messages,
      max_tokens: 600,
      temperature: 0.4,
    }, {
      headers: {
        'Authorization': `Bearer ${MISTRAL_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });

    const reply = response.data.choices?.[0]?.message?.content || 'No response from AI.';
    res.json({ success: true, reply, conflicts: teacherConflicts });

  } catch (err) {
    console.error('AI timetable chat error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res.status(500).json({ success: false, error: 'Mistral API key invalid or not set. Go to Render dashboard → Environment → add MISTRAL_API_KEY.' });
    }
    if (err.response?.status === 422) {
      return res.status(500).json({ success: false, error: 'Mistral API request format error: ' + (err.response?.data?.message || err.message) });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/sms/ai/check-slot ───────────────────────────────
// Quick conflict check before placing a slot manually
// Body: { teacher_id, period_id, day_of_week, class_id, subject_id, academic_year_id }
exports.checkSlot = async (req, res) => {
  try {
    const { teacher_id, period_id, day_of_week, class_id, subject_id, academic_year_id } = req.body;
    const schoolId = req.schoolId;
    const warnings = [];

    if (teacher_id && period_id && day_of_week) {
      // Check teacher double-booking
      const { data: clash } = await supabase
        .from('timetable_slots')
        .select('id, class:classes(name)')
        .eq('school_id', schoolId)
        .eq('teacher_id', teacher_id)
        .eq('period_id', period_id)
        .eq('day_of_week', day_of_week)
        .neq('class_id', class_id);

      if (clash && clash.length > 0) {
        warnings.push({
          type: 'teacher_conflict',
          severity: 'error',
          message: `Teacher is already assigned to ${clash[0].class?.name || 'another class'} at this time.`,
        });
      }

      // Check teacher daily load (max 3 periods/day)
      if (day_of_week && teacher_id) {
        const { data: daySlots } = await supabase
          .from('timetable_slots')
          .select('id')
          .eq('school_id', schoolId)
          .eq('teacher_id', teacher_id)
          .eq('day_of_week', day_of_week);
        if ((daySlots?.length || 0) >= 3) {
          warnings.push({
            type: 'workload',
            severity: 'warning',
            message: `Teacher already has ${daySlots.length} period(s) this day (max recommended: 3).`,
          });
        }
      }
    }

    if (subject_id && class_id && day_of_week) {
      // Check subject max 2 per day per class
      const { data: daySubj } = await supabase
        .from('timetable_slots')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class_id', class_id)
        .eq('subject_id', subject_id)
        .eq('day_of_week', day_of_week);
      if ((daySubj?.length || 0) >= 2) {
        warnings.push({
          type: 'subject_per_day',
          severity: 'warning',
          message: 'This subject already appears twice today for this class.',
        });
      }

      // Check subject weekly max
      const { data: sub } = await supabase.from('subjects').select('name,max_periods_week').eq('id', subject_id).single();
      if (sub) {
        const { data: weekSlots } = await supabase
          .from('timetable_slots')
          .select('id')
          .eq('school_id', schoolId)
          .eq('class_id', class_id)
          .eq('subject_id', subject_id);
        const maxW = sub.max_periods_week || 7;
        if ((weekSlots?.length || 0) >= maxW) {
          warnings.push({
            type: 'weekly_max',
            severity: 'error',
            message: `${sub.name} has reached its weekly maximum (${maxW} periods).`,
          });
        }
      }
    }

    res.json({ success: true, warnings, ok: warnings.filter(w => w.severity === 'error').length === 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
