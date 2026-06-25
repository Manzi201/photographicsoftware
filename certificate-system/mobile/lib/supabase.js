import { createClient } from '@supabase/supabase-js';

// Vugurura izi na Supabase yawe
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Upload photo to Supabase Storage
export async function uploadPhoto(photoUri, photoNumber) {
  const fileName = `${photoNumber}_${Date.now()}.jpg`;

  // Fetch the image as a blob
  const response = await fetch(photoUri);
  const blob = await response.blob();

  const { data, error } = await supabase.storage
    .from('student-photos')
    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('student-photos')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// Save student to database
export async function saveStudent({ photo_number, first_name, last_name, class: cls, year, school, photo_url }) {
  const { data, error } = await supabase.from('students').insert([{
    photo_number,
    first_name,
    last_name,
    class: cls,
    year,
    school,
    photo_url,
    status: 'active'
  }]).select().single();

  if (error) throw error;
  return data;
}

// Search student
export async function searchStudent(query) {
  const { data, error } = await supabase.from('students')
    .select('*')
    .or(`photo_number.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
  if (error) throw error;
  return data;
}

// Get all students
export async function getAllStudents() {
  const { data, error } = await supabase.from('students')
    .select('*')
    .order('photo_number');
  if (error) throw error;
  return data;
}
