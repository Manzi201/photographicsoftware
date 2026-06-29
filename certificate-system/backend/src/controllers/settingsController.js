const { supabase } = require('../supabase');

// ── Upload asset to Supabase (handles image + PDF) ────────────
async function uploadAsset(file, name) {
  // For PDF files, store as-is and flag as pdf type
  const { error } = await supabase.storage
    .from('assets')
    .upload(name, file.data, { contentType: file.mimetype, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('assets').getPublicUrl(name);
  return data.publicUrl;
}

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    res.json({ success: true, data: req.school });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const { school_name, signatory_name, bg_preset, active_year } = req.body;
    const sid = req.schoolId;
    const files = req.files || {};

    const update = {
      school_name:      school_name      || req.school.school_name,
      signatory_name:   signatory_name   || req.school.signatory_name,
      bg_preset:        bg_preset        || req.school.bg_preset || 'none',
      active_year:      active_year      || req.school.active_year,
      logo_url:         req.school.logo_url,
      stamp_url:        req.school.stamp_url,
      signature_url:    req.school.signature_url,
      background_url:   req.school.background_url,
      updated_at:       new Date().toISOString(),
    };

    // Upload assets if provided
    if (files.logo)       update.logo_url       = await uploadAsset(files.logo,       `${sid}/logo.png`);
    if (files.stamp)      update.stamp_url      = await uploadAsset(files.stamp,      `${sid}/stamp.png`);
    if (files.signature)  update.signature_url  = await uploadAsset(files.signature,  `${sid}/signature.png`);
    if (files.background) {
      update.background_url = await uploadAsset(files.background, `${sid}/background.jpg`);
      update.bg_preset = 'custom';
    }
    if (files.cert_template) {
      // Accept PNG, JPG, or PDF — store with appropriate extension
      const isImg = files.cert_template.mimetype.startsWith('image/');
      const ext = isImg ? 'png' : 'pdf';
      update.cert_template_url = await uploadAsset(files.cert_template, `${sid}/cert_template.${ext}`);
      // Store file type so certificate generator knows how to handle it
      update.cert_template_mode = req.body.cert_template_mode || 'landscape';
    }
    if (bg_preset === 'none') update.background_url = null;

    const { data, error } = await supabase.from('schools')
      .update(update).eq('id', sid).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
