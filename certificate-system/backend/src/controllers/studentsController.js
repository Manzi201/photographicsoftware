const { supabase } = require('../supabase');

// ── GET /api/students ─────────────────────────────────────────
exports.getStudents = async (req, res) => {
  try {
    const { class: className, year, search } = req.query;
    const schoolId = req.schoolId;

    let query = supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .order('photo_number');

    if (className) query = query.eq('class', className);
    if (year)      query = query.eq('year', year);
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,photo_number.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('getStudents error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/students/:id ─────────────────────────────────────
exports.getStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);

    let query = supabase.from('students').select('*').eq('school_id', req.schoolId);
    if (isUUID) {
      query = query.or(`id.eq.${id},photo_number.eq.${id}`);
    } else {
      query = query.eq('photo_number', id);
    }

    const { data, error } = await query.single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch {
    res.status(404).json({ success: false, error: 'Student not found' });
  }
};

// ── POST /api/students (individual + optional photo) ──────────
exports.createStudent = async (req, res) => {
  try {
    const { photo_number, first_name, last_name, class: cls, year } = req.body;
    const schoolId = req.schoolId;

    if (!photo_number || !first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'photo_number, first_name, and last_name are required' });
    }

    let photo_url = null;

    // Upload photo if provided
    if (req.files?.photo) {
      const photo    = req.files.photo;
      const ext      = photo.name ? photo.name.split('.').pop() : 'jpg';
      const fileName = `${schoolId}/${year || 'unknown'}/${photo_number}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('student-photos')
        .upload(fileName, photo.data, { contentType: photo.mimetype, upsert: true });

      if (upErr) {
        console.warn('Photo upload warning:', upErr.message);
        // Don't fail the whole request if photo upload fails
      } else {
        const { data: urlData } = supabase.storage
          .from('student-photos')
          .getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }

    const { data, error } = await supabase.from('students').insert([{
      school_id:    schoolId,
      photo_number: String(photo_number).trim(),
      first_name:   String(first_name).trim(),
      last_name:    String(last_name).trim(),
      class:        cls || 'Top Class',
      year:         String(year || new Date().getFullYear()),
      photo_url,
      status:       'active',
    }]).select().single();

    if (error) {
      // Friendly duplicate error
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: `Photo number "${photo_number}" already exists for year ${year}. Use a different number.`
        });
      }
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('createStudent error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/students/bulk ───────────────────────────────────
exports.bulkUpload = async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide a non-empty students array' });
    }

    const rows = students.map((s) => ({
      school_id:    req.schoolId,
      photo_number: String(s.photo_number || '').trim(),
      first_name:   String(s.first_name || '').trim(),
      last_name:    String(s.last_name || '').trim(),
      class:        String(s.class || 'Top Class').trim(),
      year:         String(s.year || new Date().getFullYear()),
      photo_url:    s.photo_url || null,
      status:       'active',
    })).filter((r) => r.photo_number && r.first_name && r.last_name);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid rows found. Check CSV columns.' });
    }

    // Insert with upsert to skip duplicates gracefully
    const { data, error } = await supabase
      .from('students')
      .upsert(rows, { onConflict: 'school_id,photo_number,year', ignoreDuplicates: true })
      .select();

    if (error) throw error;
    res.json({ success: true, data: data || [], count: data?.length || 0 });
  } catch (err) {
    console.error('bulkUpload error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PATCH /api/students/:id/photo ─────────────────────────────
exports.updatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files?.photo) {
      return res.status(400).json({ success: false, error: 'No photo file provided' });
    }

    const photo    = req.files.photo;
    const ext      = photo.name ? photo.name.split('.').pop() : 'jpg';
    const fileName = `${req.schoolId}/${id}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('student-photos')
      .upload(fileName, photo.data, { contentType: photo.mimetype, upsert: true });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('students')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', id)
      .eq('school_id', req.schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('updatePhoto error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE /api/students/:id ──────────────────────────────────
exports.deleteStudent = async (req, res) => {
  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId);

    if (error) throw error;
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    console.error('deleteStudent error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
