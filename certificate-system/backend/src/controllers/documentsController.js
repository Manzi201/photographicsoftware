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
  if (['zip','rar','7z','tar','gz'].includes(ext))     return 'zip';
  return 'other';
}

// ── FOLDERS ───────────────────────────────────────────────────

exports.getFolders = async (req, res) => {
  try {
    const { academic_year_id, folder_type } = req.query;

    // Build select — try with class/term joins, fall back if columns missing
    let q = supabase.from('document_folders')
      .select(`
        id, name, description, color, is_locked,
        folder_type, academic_year_id, class_id, term_id, month_label,
        created_at, updated_at, created_by,
        academic_year:academic_years(id,name,is_current),
        doc_count:school_documents(count)
      `)
      .eq('school_id', req.schoolId)
      .order('name');

    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    if (folder_type)      q = q.eq('folder_type', folder_type);

    const { data, error } = await q;

    // If the new columns don't exist yet (migration not run), fall back to basic query
    if (error && (error.message?.includes('class_id') || error.message?.includes('term_id') || error.message?.includes('relationship') || error.message?.includes('schema cache'))) {
      const { data: fallback, error: fbErr } = await supabase.from('document_folders')
        .select(`
          id, name, description, color, is_locked,
          academic_year_id, created_at, updated_at,
          academic_year:academic_years(id,name,is_current),
          doc_count:school_documents(count)
        `)
        .eq('school_id', req.schoolId)
        .order('name');
      if (fbErr) throw fbErr;
      // Add missing fields with defaults
      const normalized = (fallback||[]).map(f => ({
        ...f, folder_type: f.folder_type||'school',
        class_id:null, term_id:null, month_label:null,
        class:null, term:null,
      }));
      return res.json({ success:true, data: normalized });
    }

    if (error) throw error;

    // Enrich with class/term names if we have the IDs
    // (do separate lookups since FK joins require schema cache)
    const classIds = [...new Set((data||[]).map(f=>f.class_id).filter(Boolean))];
    const termIds  = [...new Set((data||[]).map(f=>f.term_id).filter(Boolean))];
    let classMap = {}, termMap = {};
    if (classIds.length) {
      const {data:cls} = await supabase.from('classes').select('id,name,level').in('id',classIds);
      (cls||[]).forEach(c => { classMap[c.id]=c; });
    }
    if (termIds.length) {
      const {data:trm} = await supabase.from('terms').select('id,name,number').in('id',termIds);
      (trm||[]).forEach(t => { termMap[t.id]=t; });
    }

    const enriched = (data||[]).map(f => ({
      ...f,
      folder_type: f.folder_type||'school',
      class: f.class_id ? classMap[f.class_id]||null : null,
      term:  f.term_id  ? termMap[f.term_id]||null  : null,
    }));

    res.json({ success: true, data: enriched });
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
      created_by:       req.staff?.id || null,
      is_locked:        !!password,
      password_hash:    password ? hashPwd(password) : null,
    };

    // Add new columns only if they're safe to include
    // (migration may not have run yet on some deployments)
    try {
      row.folder_type  = folder_type  || 'school';
      row.class_id     = class_id     || null;
      row.term_id      = term_id      || null;
      row.month_label  = month_label  || null;
    } catch {}

    const { data, error } = await supabase.from('document_folders').insert([row])
      .select('id, name, description, color, is_locked, academic_year_id, created_at')
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, data: { ...data, folder_type: folder_type||'school', class_id: class_id||null, term_id: term_id||null, month_label: month_label||null, class:null, term:null } });
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

    // Resolve correct MIME type — browsers often send wrong type for zip files
    const MIME_MAP = {
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z':  'application/x-7z-compressed',
      'tar': 'application/x-tar',
      'gz':  'application/gzip',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg':'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp':'image/webp',
    };
    const contentType = MIME_MAP[ext] || file.mimetype || 'application/octet-stream';

    // Upload to Supabase Storage with correct MIME type and upsert=false
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(filePath, file.data, {
        contentType,
        upsert:      false,
        duplex:      'half', // required for Node.js streams
      });

    if (upErr) {
      // If file already exists, try with a new timestamp
      if (upErr.message?.includes('already exists') || upErr.statusCode === '409') {
        const retryPath = `${req.schoolId}/${folder_id}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
        const { error: retryErr } = await supabase.storage
          .from('documents')
          .upload(retryPath, file.data, { contentType, upsert: true });
        if (retryErr) throw new Error(`Storage upload failed: ${retryErr.message}`);
        const { data: retryUrl } = supabase.storage.from('documents').getPublicUrl(retryPath);
        const { data: retryDoc, error: dbErr } = await supabase.from('school_documents').insert([{
          school_id: req.schoolId, folder_id,
          name: name?.trim() || file.name,
          file_url: retryUrl.publicUrl, file_type: fileType,
          file_size: file.size, uploaded_by: req.staff?.id || null,
        }]).select('*, uploader:staff(full_name)').single();
        if (dbErr) throw dbErr;
        return res.status(201).json({ success: true, data: retryDoc });
      }
      throw new Error(`Storage upload failed: ${upErr.message}`);
    }

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
  } catch (err) {
    console.error('uploadDocument error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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
