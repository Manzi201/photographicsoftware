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
    if (!MISTRAL_KEY) return res.status(500).json({ success: false, error: 'MISTRAL_API_KEY not set on server. Add it in Render → Environment.' });

    const schoolId = req.schoolId;

    // ── 1. Fetch all data — filter by academic year/term when provided ──
    // timetable_slots filtered by school + optional year/term
    let slotQuery = supabase.from('timetable_slots')
      .select(`
        day_of_week, period_id, class_id, subject_id, teacher_id,
        class:classes(name),
        subject:subjects(name,code,max_periods_week,is_core),
        teacher:staff(full_name),
        period:school_periods(name,period_number,is_break)
      `)
      .eq('school_id', schoolId);
    if (academic_year_id) slotQuery = slotQuery.eq('academic_year_id', academic_year_id);
    if (term_id)          slotQuery = slotQuery.eq('term_id', term_id);

    // class_subjects — no school_id column, filter via school's class ids
    // We'll get school's classes first then filter
    const [
      { data: classes },
      { data: allTeachers },
      { data: allSubjects },
      { data: periods },
      { data: slots, error: slotErr },
    ] = await Promise.all([
      supabase.from('classes').select('id,name,level,academic_year_id').eq('school_id', schoolId).order('name'),
      supabase.from('staff').select('id,full_name,role').eq('school_id', schoolId).eq('is_active', true).in('role', ['teacher','dos']),
      supabase.from('subjects').select('id,name,code,max_periods_week,is_core').eq('school_id', schoolId),
      supabase.from('school_periods').select('id,name,period_number,is_break,start_time,end_time').eq('school_id', schoolId).order('period_number'),
      slotQuery,
    ]);

    if (slotErr) console.warn('Slot query error:', slotErr.message);

    const clsList   = classes    || [];
    const subList   = allSubjects || [];
    const prdList   = (periods   || []).filter(p => !p.is_break);
    const slotList  = slots      || [];

    // Filter classes by academic year if provided
    const activeClasses = academic_year_id
      ? clsList.filter(c => c.academic_year_id === academic_year_id)
      : clsList;
    const activeClassIds = new Set(activeClasses.map(c => c.id));

    // Get class_subjects for the active classes only
    let cssList = [];
    if (activeClassIds.size > 0) {
      const { data: cs } = await supabase.from('class_subjects')
        .select('class_id, subject_id, teacher_id, class:classes(name), subject:subjects(name,code,max_periods_week), teacher:staff(full_name)')
        .in('class_id', [...activeClassIds]);
      cssList = cs || [];
    }

    // Build teacher list scoped to this academic year
    // = teachers who are assigned to at least one class in this year
    const activeTeacherIds = new Set(
      cssList.filter(cs => cs.teacher_id).map(cs => cs.teacher_id)
    );
    // Also include teachers who have slots in this year
    slotList.forEach(s => { if (s.teacher_id) activeTeacherIds.add(s.teacher_id); });
    const teachList = (allTeachers || []).filter(t => activeTeacherIds.has(t.id));

    // ── 2. Pre-compute analytics ──────────────────────────────

    // Teacher workload: periods per week + per day (only slots in scope)
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

    // Subject distribution per class (only for active classes)
    const classSubjectCount = {};
    slotList.forEach(s => {
      if (!s.class_id || !s.subject_id) return;
      if (!activeClassIds.has(s.class_id)) return; // only active year's classes
      if (!classSubjectCount[s.class_id]) classSubjectCount[s.class_id] = {};
      classSubjectCount[s.class_id][s.subject_id] = (classSubjectCount[s.class_id][s.subject_id] || 0) + 1;
    });

    // Teacher conflicts (within the filtered slots)
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
      const cls = activeClasses.find(c => c.id === classId);
      Object.entries(subMap).forEach(([subjectId, count]) => {
        const sub = subList.find(s => s.id === subjectId);
        const maxW = sub?.max_periods_week || 7;
        if (count > maxW) {
          overloadedSubjects.push({ class: cls?.name || classId, subject: sub?.name || subjectId, count, max: maxW });
        }
      });
    });

    // Subjects assigned to a class but MISSING from timetable
    const missingSubjects = [];
    cssList.forEach(cs => {
      const cls = activeClasses.find(c => c.id === cs.class_id);
      const sub = subList.find(s => s.id === cs.subject_id);
      if (!cls || !sub) return;
      const count = classSubjectCount[cs.class_id]?.[cs.subject_id] || 0;
      if (count === 0) missingSubjects.push({ class: cls.name, subject: sub.name });
    });

    // Teachers with zero slots in scope
    const unassignedTeachers = teachList
      .filter(t => !slotList.some(s => s.teacher_id === t.id))
      .map(t => t.full_name);

    // Classes with no slots at all
    const emptyClasses = activeClasses
      .filter(c => !slotList.some(s => s.class_id === c.id))
      .map(c => c.name);

    const context = `
=== SCHOOL TIMETABLE DATA — Academic Year: ${yearName} ===
Scope: ${academic_year_id ? `Year ID ${academic_year_id}` : 'ALL years'} | Term: ${term_id ? `Term ID ${term_id}` : 'ALL terms'}
Total slots analysed: ${slotList.length}
Classes in this year: ${activeClasses.map(c => c.name).join(', ') || 'none'}
Teachers assigned this year: ${teachList.map(t => t.name || t.full_name).join(', ') || 'none'}
Teaching periods per day: ${prdList.length}

--- TEACHER WORKLOAD (this year only) ---
${Object.values(teacherWorkload).filter(t => t.total > 0).sort((a,b) => b.total - a.total).map(t => {
  const dayBd = Object.entries(t.byDay).map(([d,n]) => `${d.slice(0,3)}:${n}`).join(' | ');
  const clsBd = Object.entries(t.byClass).map(([c,n]) => `${c}(${n})`).join(', ');
  const flag  = t.total > 35 ? ' OVERLOADED' : t.total > 28 ? ' HIGH' : '';
  return `${t.name}: ${t.total} periods/wk${flag} | days: ${dayBd || 'none'} | classes: ${clsBd || 'none'}`;
}).join('\n') || '  No teacher assignments found.'}

--- SUBJECT COUNT PER CLASS (this year only) ---
${activeClasses.map(cls => {
  const counts = classSubjectCount[cls.id] || {};
  if (Object.keys(counts).length === 0) return `${cls.name}: NO SLOTS ASSIGNED`;
  const parts = Object.entries(counts).map(([sid, n]) => {
    const sub  = subList.find(s => s.id === sid);
    const maxW = sub?.max_periods_week || 7;
    const flag = n > maxW ? `(OVER max=${maxW})` : n < maxW ? `(UNDER max=${maxW})` : '(OK)';
    return `${sub?.code || sub?.name || '?'}=${n}${flag}`;
  });
  return `${cls.name}: ${parts.join(', ')}`;
}).join('\n') || '  No data.'}

--- TEACHER CLASS ASSIGNMENTS (this year) ---
${cssList.filter(cs => cs.teacher_id).map(cs =>
  `${cs.teacher?.full_name || '?'} teaches ${cs.subject?.code || cs.subject?.name || '?'} in ${cs.class?.name || '?'}`
).join('\n') || '  No assignments found.'}

--- CONFLICTS (double-bookings) ---
${teacherConflicts.length === 0 ? 'NONE' : teacherConflicts.map(c =>
  `${c.teacher} is double-booked on ${c.day} ${c.period} in: ${c.classes.join(' AND ')}`
).join('\n')}

--- OVERLOADED SUBJECTS ---
${overloadedSubjects.length === 0 ? 'NONE' : overloadedSubjects.map(o =>
  `${o.class}: ${o.subject} has ${o.count} periods but max is ${o.max}`
).join('\n')}

--- MISSING SUBJECTS (assigned but 0 periods in timetable) ---
${missingSubjects.length === 0 ? 'NONE' : missingSubjects.map(m =>
  `${m.class}: ${m.subject} is assigned but has no slot in the timetable`
).join('\n')}

--- TEACHERS WITH ZERO SLOTS THIS YEAR ---
${unassignedTeachers.length === 0 ? 'NONE' : unassignedTeachers.join(', ')}

--- EMPTY CLASSES (no timetable at all) ---
${emptyClasses.length === 0 ? 'NONE' : emptyClasses.join(', ')}

--- RWANDA PRIMARY RULES ---
MATH max 9/wk, KINY/ENG max 8/wk, SRS/SET max 6/wk, CA/PES max 1/wk
Teacher max 3 periods/day, Subject max 2 periods/day per class
`.trim();

    // ── 4. Call Mistral (with optional image) ────────────────
    const { imageBase64, imageMime } = req.body;

    const yearName = academic_year_id
      ? (await supabase.from('academic_years').select('name').eq('id', academic_year_id).single()).data?.name || academic_year_id
      : 'All years';

    const systemPrompt = `You are a professional school timetable analyst for SchoolMS, a Rwandan primary school management system.

STRICT RULES FOR YOUR RESPONSES:
1. NEVER output JSON, code blocks, or programming syntax. Write in plain human language only.
2. Use **bold** for teacher names, class names, subject codes, and numbers.
3. Use bullet lists (- item) for multiple points.
4. Use tables when comparing data across classes or teachers. Format tables like:
   | Teacher | Class | Periods/week |
   |---------|-------|-------------|
   | Jean Bosco | P1 | 8 |
5. Keep answers focused and structured with clear headings using **Heading:** format.
6. Respond in the same language the user writes in (English, French, or Kinyarwanda).
7. Base ALL answers strictly on the data provided — never invent or assume data.
8. The current scope is Academic Year: ${yearName}. Only reference data from this year.
9. When you see problems, always suggest a specific, named fix.
10. Be concise — max 200 words per answer unless a table or full analysis is requested.`;

    // Build user content — supports text + optional image
    let userContent;
    if (imageBase64 && imageMime) {
      userContent = [
        { type: 'text',       text: `${context}\n\n---\nQUESTION: ${message}` },
        { type: 'image_url',  image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
      ];
    } else {
      userContent = `${context}\n\n---\nQUESTION: ${message}`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    // Use vision model if image attached, otherwise small model
    const model = (imageBase64 && imageMime) ? 'pixtral-12b-2409' : 'mistral-small-latest';

    const response = await axios.post(MISTRAL_URL, {
      model,
      messages,
      max_tokens:  800,
      temperature: 0.3,
    }, {
      headers: { 'Authorization': `Bearer ${MISTRAL_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000,
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
exports.checkSlot = async (req, res) => {
  try {
    const { teacher_id, period_id, day_of_week, class_id, subject_id, academic_year_id } = req.body;
    const schoolId = req.schoolId;
    const warnings = [];

    // Base filter — always scope to school + academic year to avoid cross-year pollution
    const scopeFilter = (q) => {
      q = q.eq('school_id', schoolId);
      if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
      return q;
    };

    if (teacher_id && period_id && day_of_week) {
      // Teacher double-booking at same period+day (across all classes)
      const { data: clash } = await scopeFilter(
        supabase.from('timetable_slots')
          .select('id, class:classes(name)')
          .eq('teacher_id', teacher_id)
          .eq('period_id', period_id)
          .eq('day_of_week', day_of_week)
      );
      // Exclude current class if editing existing slot
      const realClash = (clash || []).filter(s => !class_id || s.class_id !== class_id);
      if (realClash.length > 0) {
        const clashName = realClash[0].class?.name || 'another class';
        warnings.push({
          type: 'teacher_conflict',
          severity: 'error',
          message: `Teacher is already assigned to **${clashName}** at this period.`,
        });
      }

      // Teacher daily load — count periods this teacher teaches this day in this year
      const { data: daySlots } = await scopeFilter(
        supabase.from('timetable_slots')
          .select('id')
          .eq('teacher_id', teacher_id)
          .eq('day_of_week', day_of_week)
      );
      const dayCount = (daySlots || []).length;
      if (dayCount >= 3) {
        warnings.push({
          type: 'workload',
          severity: 'warning',
          message: `Teacher already has **${dayCount} period(s)** this day (recommended max: 3).`,
        });
      }
    }

    if (subject_id && class_id && day_of_week) {
      // Subject max 2 per day per class
      const { data: daySubj } = await scopeFilter(
        supabase.from('timetable_slots')
          .select('id')
          .eq('class_id', class_id)
          .eq('subject_id', subject_id)
          .eq('day_of_week', day_of_week)
      );
      if ((daySubj || []).length >= 2) {
        warnings.push({
          type: 'subject_per_day',
          severity: 'warning',
          message: 'This subject already appears **twice today** for this class.',
        });
      }

      // Weekly max — count how many times this subject is already in the timetable for this class
      const { data: sub } = await supabase
        .from('subjects').select('name, max_periods_week').eq('id', subject_id).single();
      if (sub) {
        const { data: weekSlots } = await scopeFilter(
          supabase.from('timetable_slots')
            .select('id')
            .eq('class_id', class_id)
            .eq('subject_id', subject_id)
        );
        const maxW    = sub.max_periods_week || 7;
        const current = (weekSlots || []).length;
        if (current >= maxW) {
          warnings.push({
            type: 'weekly_max',
            severity: 'error',
            message: `**${sub.name}** has reached its weekly maximum of **${maxW} periods** (currently: ${current}).`,
          });
        } else if (current >= maxW - 1) {
          warnings.push({
            type: 'weekly_near_max',
            severity: 'warning',
            message: `**${sub.name}** is at **${current}/${maxW}** periods this week — adding one more will hit the limit.`,
          });
        }
      }
    }

    res.json({
      success: true,
      warnings,
      ok: warnings.filter(w => w.severity === 'error').length === 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/sms/ai/fix-timetable ───────────────────────────
// AI analyses the timetable and auto-applies suggested fixes
// Body: { academic_year_id, term_id, instruction? }
exports.fixTimetable = async (req, res) => {
  try {
    const { academic_year_id, term_id, instruction } = req.body;
    if (!academic_year_id) return res.status(400).json({ success: false, error: 'academic_year_id required' });
    const schoolId = req.schoolId;

    // ── 1. Load full data ─────────────────────────────────────
    let slotQuery = supabase.from('timetable_slots')
      .select('id, day_of_week, period_id, class_id, subject_id, teacher_id')
      .eq('school_id', schoolId);
    if (academic_year_id) slotQuery = slotQuery.eq('academic_year_id', academic_year_id);
    if (term_id)          slotQuery = slotQuery.eq('term_id', term_id);

    const [
      { data: classes },
      { data: teachers },
      { data: subjects },
      { data: periods },
      { data: slots },
    ] = await Promise.all([
      supabase.from('classes').select('id,name').eq('school_id', schoolId)
        .eq('academic_year_id', academic_year_id).order('name'),
      supabase.from('staff').select('id,full_name,role').eq('school_id', schoolId)
        .eq('is_active', true).in('role', ['teacher','dos']),
      supabase.from('subjects').select('id,name,code,max_periods_week,is_core').eq('school_id', schoolId),
      supabase.from('school_periods').select('id,name,period_number,is_break')
        .eq('school_id', schoolId).eq('is_break', false).order('period_number'),
      slotQuery,
    ]);

    const clsList   = classes  || [];
    const teachList = teachers || [];
    const subList   = subjects || [];
    const prdList   = periods  || [];
    const slotList  = slots    || [];

    // Get class_subjects
    let cssList = [];
    if (clsList.length > 0) {
      const { data: cs } = await supabase.from('class_subjects')
        .select('class_id, subject_id, teacher_id, subject:subjects(name,code,max_periods_week), teacher:staff(full_name)')
        .in('class_id', clsList.map(c => c.id));
      cssList = cs || [];
    }

    // ── 2. Find missing subjects & empty slots ────────────────
    const occupied = new Set(slotList.map(s => `${s.class_id}:${s.day_of_week}:${s.period_id}`));
    const DAYS_N = [1,2,3,4,5];

    // Subject count per class
    const subCount = {};
    slotList.forEach(s => {
      const k = `${s.class_id}:${s.subject_id}`;
      subCount[k] = (subCount[k] || 0) + 1;
    });

    // Teacher busy map: "tid:day:periodId" → true
    const teacherBusy = new Set(
      slotList.filter(s => s.teacher_id).map(s => `${s.teacher_id}:${s.day_of_week}:${s.period_id}`)
    );
    const teacherDayLoad = {};
    slotList.forEach(s => {
      if (!s.teacher_id) return;
      const k = `${s.teacher_id}:${s.day_of_week}`;
      teacherDayLoad[k] = (teacherDayLoad[k] || 0) + 1;
    });

    const newSlots = [];
    let skipped = 0;

    // For each class, find subjects that still need more periods
    for (const cls of clsList) {
      const clsAssignments = cssList.filter(cs => cs.class_id === cls.id);

      for (const cs of clsAssignments) {
        const sub     = subList.find(s => s.id === cs.subject_id);
        if (!sub) continue;
        const maxW    = sub.max_periods_week || 7;
        const current = subCount[`${cls.id}:${cs.subject_id}`] || 0;
        let needed    = Math.max(0, maxW - current);
        if (needed === 0) continue;

        const tid = cs.teacher_id;

        // Try to place `needed` more slots for this subject
        for (const day of DAYS_N) {
          if (needed <= 0) break;

          // Max 2 per day per subject per class
          const dayAlready = slotList.filter(s =>
            s.class_id === cls.id && s.subject_id === cs.subject_id && s.day_of_week === day
          ).length;
          if (dayAlready >= 2) continue;

          for (const prd of prdList) {
            if (needed <= 0) break;
            const cellKey = `${cls.id}:${day}:${prd.id}`;
            if (occupied.has(cellKey)) continue; // slot already taken

            // Teacher conflict check
            if (tid) {
              if (teacherBusy.has(`${tid}:${day}:${prd.id}`)) { skipped++; continue; }
              const dayLoad = teacherDayLoad[`${tid}:${day}`] || 0;
              if (dayLoad >= 3) { skipped++; continue; }
            }

            // Place it
            newSlots.push({
              school_id:        schoolId,
              class_id:         cls.id,
              subject_id:       cs.subject_id,
              teacher_id:       tid || null,
              period_id:        prd.id,
              day_of_week:      day,
              term_id:          term_id          || null,
              academic_year_id: academic_year_id || null,
            });
            occupied.add(cellKey);
            if (tid) {
              teacherBusy.add(`${tid}:${day}:${prd.id}`);
              teacherDayLoad[`${tid}:${day}`] = (teacherDayLoad[`${tid}:${day}`] || 0) + 1;
            }
            subCount[`${cls.id}:${cs.subject_id}`] = (subCount[`${cls.id}:${cs.subject_id}`] || 0) + 1;
            needed--;
          }
        }
      }
    }

    // ── 3. Insert in batches of 50 ────────────────────────────
    let inserted = 0;
    const CHUNK = 50;
    for (let i = 0; i < newSlots.length; i += CHUNK) {
      const chunk = newSlots.slice(i, i + CHUNK);
      const { data, error } = await supabase.from('timetable_slots')
        .upsert(chunk, { onConflict: 'school_id,class_id,period_id,day_of_week' })
        .select('id');
      if (!error) inserted += (data || []).length;
    }

    // ── 4. Summary reply via AI ───────────────────────────────
    const summary = `Fixed timetable: inserted ${inserted} new slots, skipped ${skipped} due to teacher conflicts. ${newSlots.length - inserted} slots could not be placed.`;

    res.json({
      success:  true,
      inserted,
      skipped,
      total_attempted: newSlots.length,
      message: summary,
    });

  } catch (err) {
    console.error('fixTimetable error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
