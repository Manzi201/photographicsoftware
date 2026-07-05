const { supabase } = require('../supabase');

// ── FOLDERS ───────────────────────────────────────────────────
exports.getFolders = async (req, res) => {
  try {
    const { data, error } = await supabase.from('document_folders')
      .select('*, doc_count:school_documents(count)')
      .eq('school_id', req.schoolId)
      .order('name');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.createFolder = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Folder name required' });
    const { data, error } = await supabase.from('document_folders').insert([{
      school_id:  req.schoolId,
      name:       name.trim(),
      description,
      color:      color || '#2563eb',
      created_by: req.staff?.id || null,
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateFolder = async (req, res) => {
  try {
    const { data, error } = await supabase.from('document_folders')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('school_id', req.schoolId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deleteFolder = async (req, res) => {
  try {
    // Get all docs in folder to delete from storage
    const { data: docs } = await supabase.from('school_documents')
      .select('file_url').eq('folder_id', req.params.id);

    // Delete files from storage
    for (const doc of (docs || [])) {
      try {
        const path = doc.file_url.split('/documents/')[1];
        if (path) await supabase.storage.from('documents').remove([path]);
      } catch {}
    }

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
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.uploadDocument = async (req, res) => {
  try {
    const { folder_id, name } = req.body;
    if (!req.files?.file) return res.status(400).json({ success: false, error: 'No file provided' });
    if (!folder_id)       return res.status(400).json({ success: false, error: 'folder_id required' });

    const file     = req.files.file;
    const ext      = file.name.split('.').pop().toLowerCase();
    const fileType = getFileType(ext);
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const filePath = `${req.schoolId}/${folder_id}/${Date.now()}_${safeName}`;

    // Upload to Supabase Storage (documents bucket)
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(filePath, file.data, { contentType: file.mimetype, upsert: false });
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
    }]).select().single();
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

function getFileType(ext) {
  if (['pdf'].includes(ext))                      return 'pdf';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (['doc','docx'].includes(ext))               return 'doc';
  if (['xls','xlsx','csv'].includes(ext))         return 'excel';
  if (['ppt','pptx'].includes(ext))               return 'ppt';
  return 'other';
}
