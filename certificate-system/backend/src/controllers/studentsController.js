const { supabase } = require('../supabase');

// GET /api/students
exports.getStudents = async (req, res) => {
  try {
    const { class: className, year, search } = req.query;
    const schoolId = req.schoolId;

    let query = supabase.from('students').select('*')
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
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/students/:id
exports.getStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('students').select('*')
      .eq('school_id', req.schoolId)
      .or(`id.eq.${id},photo_number.eq.${id}`)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch {
    res.status(404).json({ success: false, error: 'Student not found' });
  }
};

// POST /api/students  (individual with photo upload)
exports.createStudent = async (req, res) => {
  try {
    const { photo_number, first_name, last_name, class: cls, year } = req.body;
    const schoolId = req.schoolId;
    let photo_url = null;

    if (req.files?.photo) {
      const photo = req.files.photo;
      const fileName = `${schoolId}/${year}/${photo_number}_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('student-photos')
        .upload(fileName, photo.data, { contentType: photo.mimetype, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(fileName);
      photo_url = urlData.publicUrl;
    }

    const { data, error } = await supabase.from('students').insert([{
      school_id: schoolId, photo_number, first_name, last_name,
      class: cls, year, photo_url, status: 'active'
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/students/bulk
exports.bulkUpload = async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ success: false, error: 'Invalid data' });

    const rows = students.map((s) => ({ ...s, school_id: req.schoolId, status: 'active' }));
    const { data, error } = await supabase.from('students').insert(rows).select();
    if (error) throw error;
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/students/:id/photo
exports.updatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files?.photo) return res.status(400).json({ success: false, error: 'No photo' });

    const photo = req.files.photo;
    const fileName = `${req.schoolId}/${id}_${Date.now()}.jpg`;
    await supabase.storage.from('student-photos')
      .upload(fileName, photo.data, { contentType: photo.mimetype, upsert: true });
    const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(fileName);

    const { data, error } = await supabase.from('students')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', id).eq('school_id', req.schoolId)
      .select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/students/:id
exports.deleteStudent = async (req, res) => {
  try {
    const { error } = await supabase.from('students')
      .delete().eq('id', req.params.id).eq('school_id', req.schoolId);
    if (error) throw error;
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
