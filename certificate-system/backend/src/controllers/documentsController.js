'use strict';
const { supabase } = require('../supabase');
const crypto       = require('crypto');

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + 'schoolms_salt').digest('hex');
}
function getFileType(ext) {
  if (['pdf'].includes(ext))                           return 'pdf';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (['doc','docx'].includes(ext))                    return 'doc';
  if (['xls','xlsx','csv'].includes(ext))              return 'excel';
  if (['ppt','pptx'].includes(ext))                    return 'ppt';
  return 'other';
}

// ── FOLDERS ───────────────────────────────────────────────────

exports.getFolders = async (req, res) => {
  try {
    const { academic_year_id, folder_type } = req.query;
    let q = supabase.from('document_folders')
      .select(`
        id, name, description, color, is_locked, folder_type,
        academic_year_id, class_id, term_id, month_label,
        created_at, updated_at, created_by,
        academic_year:academic_years(id,name,is_current),
        class:classes(id,name,level),
        term:terms(id,name,number),
        doc_count:school_documents(count)
      `)
      .eq('school_id', req.schoolId)
      .order('name');

    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (folder_type)      q = q.eq('folder_type', folder_type);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createFolder = async (req, res) => {
  try {
    const {
      name, description, color, academic_year_id, password,
      folder_type, class_id, term_id, month_label
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Folder name required' });

    const row = {
      school_id:        req.schoolId,
      name:             name.trim(),
      description:      description || null,
      color:            color || '#2563eb',
      academic_year_id: academic_year_id || null,
      folder_type:      folder_type || 'school',
      class_id:         class_id    || null,
      term_id:          term_id     || null,
      month_label:      month_label || null,
      created_by:       req.staff?.id || null,
      is_locked:        !!password,
      password_hash:    password ? hashPwd(password) : null,
    };

    const { data, error } = await supabase.from('document_folders').insert([row]).select(`
      id, name, description, color, is_locked, folder_type,
      academic_year_id, class_id, term_id, month_label, created_at,
      academic_year:academic_years(id,name,is_current),
      class:classes(id,name,level),
      term:terms(id,name,number)
    `).single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateFolder = async (req, res) => {
  try {
    const {
      name, description, color, academic_year_id, password, remove_password,
      folder_type, class_id, term_id, month_label
    } = req.body;
    const update = { updated_at: new Date().toISOString() };
    if (name             !== undefined) update.name             = name.trim();
    if (description      !== undefined) update.description      = description;
    if (color            !== undefined) update.color            = color;
    if (academic_year_id !== undefined) update.academic_year_id = academic_year_id || null;
    if (folder_type      !== undefined) update.folder_type      = folder_type;
    if (class_id         !== undefined) update.class_id         = class_id    || null;
    if (term_id          !== undefined) update.term_id          = term_id     || null;
    if (month_label      !== undefined) update.month_label      = month_label || null;
    if (remove_password) { update.is_locked = false; update.password_hash = null; }
    if (password)        { update.is_locked = true;  update.password_hash = hashPwd(password); }

    const { data, error } = await supabase.from('document_folders')
      .update(update)
      .eq('id', req.params.id).eq('school_id', req.schoolId)
      .select(`
        id, name, description, color, is_locked, folder_type,
        academic_year_id, class_id, term_id, month_label, created_at,
        academic_year:academic_years(id,name,is_current),
        class:classes(id,name,level),
        term:terms(id,name,number)
      `)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /sms/documents/folders/:id/unlock  — verify password
exports.unlockFolder = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, error: 'Password required' });

    const { data: folder, error } = await supabase.from('document_folders')
      .select('id, is_locked, password_hash')
      .eq('id', req.params.id).eq('school_id', req.schoolId).single();
    if (error || !folder) return res.status(404).json({ success: false, error: 'Folder not found' });
    if (!folder.is_locked) return res.json({ success: true }); // not locked

    const hash = hashPwd(password);
    if (hash !== folder.password_hash) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteFolder = async (req, res) => {
  try {
    const { data: docs } = await supabase.from('school_documents')
      .select('file_url').eq('folder_id', req.params.id);
    for (const doc of (docs || [])) {
      try {
        const path = doc.file_url.split('/documents/')[1];
        if (path) await supabase.storage.from('documents').remove([path]);
      } catch {}
    }
    await supabase.from('school_documents').delete().eq('folder_id', req.params.id);
    await supabase.from('document_folders').delete()
      .eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── DOCUMENTS ─────────────────────────────────────────────────

exports.getDocuments = async (req, res) => {
  try {
    const { folder_id } = req.query;
    let q = supabase.from('school_documents')
      .select('*, folder:document_folders(id,name,color), uploader:staff(full_name)')
      .eq('school_id', req.schoolId);
    if (folder_id) q = q.eq('folder_id', folder_id);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.uploadDocument = async (req, res) => {
  try {
    const { folder_id, name } = req.body;
    if (!req.files?.file) return res.status(400).json({ success: false, error: 'No file provided' });
    if (!folder_id)        return res.status(400).json({ success: false, error: 'folder_id required' });

    const file     = req.files.file;
    const ext      = file.name.split('.').pop().toLowerCase();
    const fileType = getFileType(ext);
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const filePath = `${req.schoolId}/${folder_id}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from('documents').upload(filePath, file.data, { contentType: file.mimetype, upsert: false });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

    const { data, error } = await supabase.from('school_documents').insert([{
      school_id:   req.schoolId,
      folder_id,
      name:        name?.trim() || file.name,
      file_url:    urlData.publicUrl,
      file_type:   fileType,
      file_size:   file.size,
      uploaded_by: req.staff?.id || null,
    }]).select('*, uploader:staff(full_name)').single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { data: doc } = await supabase.from('school_documents')
      .select('file_url').eq('id', req.params.id).single();
    if (doc?.file_url) {
      try {
        const path = doc.file_url.split('/documents/')[1]?.split('?')[0];
        if (path) await supabase.storage.from('documents').remove([path]);
      } catch {}
    }
    await supabase.from('school_documents').delete()
      .eq('id', req.params.id).eq('school_id', req.schoolId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
