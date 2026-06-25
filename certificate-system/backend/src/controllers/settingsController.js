const { supabase } = require('../supabase');

async function uploadAsset(file, path) {
  await supabase.storage.from('assets')
    .upload(path, file.data, { contentType: file.mimetype, upsert: true });
  const { data } = supabase.storage.from('assets').getPublicUrl(path);
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
    if (bg_preset === 'none') update.background_url = null;

    const { data, error } = await supabase.from('schools')
      .update(update).eq('id', sid).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
