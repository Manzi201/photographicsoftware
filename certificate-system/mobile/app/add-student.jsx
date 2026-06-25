import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

export default function AddStudentScreen() {
  const { school, api } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    photo_number: '',
    first_name: '',
    last_name: '',
    class: 'Top Class',
    year: school?.active_year || String(new Date().getFullYear()),
  });
  const [photoUri, setPhotoUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [step, setSavingStep] = useState('');

  // Open camera
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4], // Portrait for ID photo
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // Pick from gallery
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!form.photo_number.trim()) { Alert.alert('Error', 'Shyiramo Photo Number'); return; }
    if (!form.first_name.trim()) { Alert.alert('Error', 'Shyiramo First Name'); return; }
    if (!form.last_name.trim()) { Alert.alert('Error', 'Shyiramo Last Name'); return; }
    if (!photoUri) {
      Alert.alert('No Photo', 'Fata ifoto y\'umunyeshuri mbere yo kubika.', [
        { text: 'Funga', style: 'cancel' },
        { text: 'Komeza utifoto', onPress: () => doSave(null) }
      ]);
      return;
    }
    doSave(photoUri);
  };

  const doSave = async (uri) => {
    setSaving(true);
    try {
      // Build multipart form data
      const fd = new FormData();
      fd.append('photo_number', form.photo_number);
      fd.append('first_name', form.first_name);
      fd.append('last_name', form.last_name);
      fd.append('class', form.class);
      fd.append('year', form.year);

      if (uri) {
        setSavingStep('Uploading photo...');
        const filename = `${form.photo_number}_${Date.now()}.jpg`;
        fd.append('photo', { uri, name: filename, type: 'image/jpeg' });
      }

      setSavingStep('Saving student...');
      await api.post('/students', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      Alert.alert(
        '✅ Saved!',
        `${form.first_name} ${form.last_name} (#${form.photo_number}) yabitswe.\nYear: ${form.year}`,
        [{ text: 'Add Another', onPress: resetForm }, { text: 'Go Home', onPress: () => router.replace('/') }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Kubika byanze');
    } finally {
      setSaving(false);
      setSavingStep('');
    }
  };

  const resetForm = () => {
    setForm({
      photo_number: '', first_name: '', last_name: '',
      class: 'Top Class',
      year: school?.active_year || String(new Date().getFullYear()),
    });
    setPhotoUri(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoBox} onPress={openCamera}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={48} color="#93c5fd" />
                <Text style={styles.photoPlaceholderText}>Tap to take photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Photo action buttons */}
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtnCamera} onPress={openCamera}>
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.photoBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtnGallery} onPress={pickFromGallery}>
              <Ionicons name="images" size={18} color="#fff" />
              <Text style={styles.photoBtnText}>Gallery</Text>
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity style={styles.photoBtnRemove} onPress={() => setPhotoUri(null)}>
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.photoBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          {/* Photo Number - most important field */}
          <View style={styles.fieldHighlight}>
            <Text style={styles.labelHighlight}>📷 Photo Number *</Text>
            <TextInput
              style={styles.inputHighlight}
              placeholder="e.g. 001"
              value={form.photo_number}
              onChangeText={(v) => setForm({ ...form, photo_number: v })}
              keyboardType="default"
              autoCapitalize="none"
              placeholderTextColor="#93c5fd"
            />
            <Text style={styles.fieldHint}>Iyi nimero ifanana n'izina ry'ifoto (001.jpg)</Text>
          </View>

          {/* Name fields */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                value={form.first_name}
                onChangeText={(v) => setForm({ ...form, first_name: v })}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Manzi"
                value={form.last_name}
                onChangeText={(v) => setForm({ ...form, last_name: v })}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Class selector */}
          <View style={styles.field}>
            <Text style={styles.label}>🎓 Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CLASSES.map((cls) => (
                  <TouchableOpacity
                    key={cls}
                    onPress={() => setForm({ ...form, class: cls })}
                    style={[styles.classChip, form.class === cls && styles.classChipActive]}
                  >
                    <Text style={[styles.classChipText, form.class === cls && styles.classChipTextActive]}>
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Year + School info (read-only from account) */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>📅 Year</Text>
              <TextInput
                style={styles.input}
                placeholder="2025"
                value={form.year}
                onChangeText={(v) => setForm({ ...form, year: v })}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>🏫 School</Text>
              <View style={[styles.input, { justifyContent: 'center', backgroundColor: '#f0f4ff' }]}>
                <Text style={{ color: '#374151', fontSize: 13 }} numberOfLines={1}>
                  {school?.school_name || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.saveBtnText}>{step}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="save" size={22} color="#fff" />
              <Text style={styles.saveBtnText}>Save Student</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  photoSection: { backgroundColor: '#1e3a8a', padding: 20, alignItems: 'center', gap: 12 },
  photoBox: {
    width: 160, height: 200, borderRadius: 12,
    overflow: 'hidden', backgroundColor: '#1e40af',
    borderWidth: 3, borderColor: '#93c5fd',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderText: { color: '#93c5fd', fontSize: 13 },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoBtnCamera: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  photoBtnGallery: { backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  photoBtnRemove: { backgroundColor: '#dc2626', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  photoBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  formCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  fieldHighlight: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, borderWidth: 2, borderColor: '#2563eb' },
  labelHighlight: { fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginBottom: 6 },
  inputHighlight: { fontSize: 22, fontWeight: 'bold', color: '#1e3a8a', borderBottomWidth: 2, borderBottomColor: '#93c5fd', paddingBottom: 6, letterSpacing: 2 },
  fieldHint: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#f9fafb' },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  classChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  classChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  classChipTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: { margin: 16, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { backgroundColor: '#93c5fd' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
