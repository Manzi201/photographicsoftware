/**
 * Batch Photo Upload Screen
 * ─────────────────────────
 * Flow:
 *  1. Select/take multiple photos (with crop 3:4 per photo)
 *  2. See grid of selected photos
 *  3. Tap each photo → fill in name + photo number
 *  4. Save all → upload to backend
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, Alert, ActivityIndicator, Modal, TextInput,
  ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const CLASSES = ['Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

// ── Each photo item in state ──────────────────────────────────
function makePhotoItem(uri, index) {
  return {
    id:           `photo_${index}_${Date.now()}`,
    uri,
    photo_number: String(index + 1).padStart(3, '0'),
    first_name:   '',
    last_name:    '',
    class:        'Top Class',
    saved:        false,
    saving:       false,
    error:        null,
  };
}

// ── Edit modal for a single photo ─────────────────────────────
function EditModal({ item, onSave, onClose, school }) {
  const [form, setForm] = useState({
    photo_number: item.photo_number,
    first_name:   item.first_name,
    last_name:    item.last_name,
    class:        item.class,
  });

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Student Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Photo preview */}
          <Image source={{ uri: item.uri }} style={styles.modalPhoto} />

          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {/* Photo number */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>📷 Photo Number *</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputHighlight]}
                value={form.photo_number}
                onChangeText={v => setForm(f => ({ ...f, photo_number: v }))}
                placeholder="e.g. 001"
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>

            {/* Names */}
            <View style={styles.modalRow}>
              <View style={[styles.modalField, { flex: 1 }]}>
                <Text style={styles.modalLabel}>First Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.first_name}
                  onChangeText={v => setForm(f => ({ ...f, first_name: v }))}
                  placeholder="John"
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.modalField, { flex: 1 }]}>
                <Text style={styles.modalLabel}>Last Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.last_name}
                  onChangeText={v => setForm(f => ({ ...f, last_name: v }))}
                  placeholder="Manzi"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Class chips */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>🎓 Class</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 6 }}>
                  {CLASSES.map(cls => (
                    <TouchableOpacity
                      key={cls}
                      onPress={() => setForm(f => ({ ...f, class: cls }))}
                      style={[styles.classChip, form.class === cls && styles.classChipActive]}>
                      <Text style={[styles.classChipText, form.class === cls && styles.classChipTextActive]}>
                        {cls}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* School info */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>🏫 School (from account)</Text>
              <View style={[styles.modalInput, { backgroundColor: '#f0f4ff' }]}>
                <Text style={{ color: '#374151', fontSize: 13 }}>{school?.school_name || '—'}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={() => {
              if (!form.photo_number.trim()) { Alert.alert('Error', 'Shyiramo Photo Number'); return; }
              if (!form.first_name.trim())   { Alert.alert('Error', 'Shyiramo First Name');  return; }
              if (!form.last_name.trim())    { Alert.alert('Error', 'Shyiramo Last Name');   return; }
              onSave({ ...item, ...form });
            }}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.modalSaveBtnText}>Save Details</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function BatchPhotosScreen() {
  const { school, api } = useAuth();
  const router = useRouter();
  const [photos, setPhotos]     = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [progress, setProgress] = useState('');

  const year = school?.active_year || String(new Date().getFullYear());

  // ── Pick multiple photos from gallery ──────────────────────
  const pickMultiple = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:     ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality:        0.85,
      orderedSelection: true,
    });
    if (!result.canceled && result.assets?.length) {
      const startIdx = photos.length;
      const newItems = result.assets.map((a, i) => makePhotoItem(a.uri, startIdx + i));
      setPhotos(p => [...p, ...newItems]);
    }
  };

  // ── Take single photo with camera (crop 3:4) ───────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes:   ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect:       [3, 4],   // portrait crop
      quality:      0.85,
    });
    if (!result.canceled) {
      const newItem = makePhotoItem(result.assets[0].uri, photos.length);
      setPhotos(p => [...p, newItem]);
      // Auto-open edit modal for single camera shot
      setEditingItem(newItem);
    }
  };

  // ── Update a photo item ────────────────────────────────────
  const updateItem = useCallback((updated) => {
    setPhotos(p => p.map(item => item.id === updated.id ? updated : item));
    setEditingItem(null);
  }, []);

  // ── Remove a photo ─────────────────────────────────────────
  const removePhoto = (id) => {
    setPhotos(p => p.filter(item => item.id !== id));
  };

  // ── Upload all filled photos ───────────────────────────────
  const uploadAll = async () => {
    const ready = photos.filter(p => p.first_name && p.last_name && p.photo_number);
    const notReady = photos.filter(p => !p.first_name || !p.last_name || !p.photo_number);

    if (ready.length === 0) {
      Alert.alert('No complete data', 'Kanda buri ifoto uruzuze amazina na photo number mbere yo kubika.');
      return;
    }
    if (notReady.length > 0) {
      Alert.alert(
        `${notReady.length} photo(s) incomplete`,
        'Amafoto make yuzuwe nta mazina. Uzabika gusa ayuzuwe?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: `Save ${ready.length} complete`, onPress: () => doUpload(ready) },
        ]
      );
      return;
    }
    doUpload(ready);
  };

  const doUpload = async (items) => {
    setUploadingAll(true);
    let success = 0, failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setProgress(`Uploading ${i + 1}/${items.length}: ${item.first_name} ${item.last_name}...`);

      try {
        const fd = new FormData();
        fd.append('photo_number', item.photo_number);
        fd.append('first_name',   item.first_name);
        fd.append('last_name',    item.last_name);
        fd.append('class',        item.class);
        fd.append('year',         year);
        fd.append('photo', {
          uri:  item.uri,
          name: `${item.photo_number}_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });

        await api.post('/students', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

        setPhotos(p => p.map(x => x.id === item.id ? { ...x, saved: true, error: null } : x));
        success++;
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Upload failed';
        setPhotos(p => p.map(x => x.id === item.id ? { ...x, error: msg } : x));
        failed++;
      }
    }

    setUploadingAll(false);
    setProgress('');

    Alert.alert(
      '✅ Done!',
      `${success} student${success !== 1 ? 's' : ''} saved.${failed > 0 ? `\n${failed} failed.` : ''}`,
      [
        { text: 'Add More', onPress: () => setPhotos(p => p.filter(x => !x.saved)) },
        { text: 'Go Home',  onPress: () => router.replace('/') },
      ]
    );
  };

  const readyCount = photos.filter(p => p.first_name && p.last_name && p.photo_number).length;
  const savedCount = photos.filter(p => p.saved).length;

  // ── Render photo card ──────────────────────────────────────
  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.photoCard,
        item.saved  && styles.photoCardSaved,
        item.error  && styles.photoCardError,
      ]}
      onPress={() => !item.saved && setEditingItem(item)}
      activeOpacity={item.saved ? 1 : 0.7}>

      {/* Photo thumbnail */}
      <Image source={{ uri: item.uri }} style={styles.thumb} />

      {/* Status overlay */}
      {item.saved && (
        <View style={styles.savedBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
        </View>
      )}
      {item.error && (
        <View style={styles.errorBadge}>
          <Ionicons name="alert-circle" size={18} color="#fff" />
        </View>
      )}

      {/* Info */}
      <View style={styles.photoInfo}>
        {item.first_name ? (
          <>
            <Text style={styles.photoName} numberOfLines={1}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={styles.photoNum}>#{item.photo_number}</Text>
            <Text style={styles.photoClass}>{item.class}</Text>
          </>
        ) : (
          <View style={styles.tapToFill}>
            <Ionicons name="pencil" size={14} color="#2563eb" />
            <Text style={styles.tapToFillText}>Tap to fill</Text>
          </View>
        )}
      </View>

      {/* Remove button */}
      {!item.saved && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removePhoto(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Batch Photo Upload</Text>
          <Text style={styles.headerSub}>
            {photos.length === 0
              ? 'Select photos to get started'
              : `${photos.length} photos · ${readyCount} ready · ${savedCount} saved`}
          </Text>
        </View>
        {photos.length > 0 && readyCount > 0 && !uploadingAll && (
          <TouchableOpacity style={styles.uploadAllBtn} onPress={uploadAll}>
            <Ionicons name="cloud-upload" size={16} color="#fff" />
            <Text style={styles.uploadAllText}>Save {readyCount}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Upload progress */}
      {uploadingAll && (
        <View style={styles.progressBar}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.progressText}>{progress}</Text>
        </View>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>
            Pick multiple photos from gallery or take with camera
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => item.id}
          renderItem={renderPhoto}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 8 }}
        />
      )}

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickMultiple} disabled={uploadingAll}>
          <Ionicons name="images" size={22} color="#fff" />
          <Text style={styles.bottomBtnText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto} disabled={uploadingAll}>
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.bottomBtnText}>Camera</Text>
        </TouchableOpacity>
        {photos.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => Alert.alert('Clear all?', 'Remove all photos?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => setPhotos([]) }
            ])}
            disabled={uploadingAll}>
            <Ionicons name="trash" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Edit modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          school={school}
          onSave={updateItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8fafc' },
  header:       { backgroundColor: '#1e3a8a', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub:    { color: '#93c5fd', fontSize: 12, marginTop: 2 },
  uploadAllBtn: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  uploadAllText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  progressBar:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#bfdbfe' },
  progressText: { fontSize: 13, color: '#1d4ed8', flex: 1 },
  emptyState:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  emptySubtitle:{ fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  grid:         { padding: 10, gap: 8 },
  photoCard:    { flex: 1/3, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 2 },
  photoCardSaved: { borderColor: '#22c55e' },
  photoCardError: { borderColor: '#ef4444' },
  thumb:        { width: '100%', aspectRatio: 3/4 },
  savedBadge:   { position: 'absolute', top: 4, left: 4, backgroundColor: '#22c55e', borderRadius: 12, padding: 2 },
  errorBadge:   { position: 'absolute', top: 4, left: 4, backgroundColor: '#ef4444', borderRadius: 12, padding: 2 },
  removeBtn:    { position: 'absolute', top: 3, right: 3 },
  photoInfo:    { padding: 6, paddingBottom: 8 },
  photoName:    { fontSize: 11, fontWeight: '700', color: '#111827' },
  photoNum:     { fontSize: 10, color: '#2563eb', fontFamily: 'monospace' },
  photoClass:   { fontSize: 10, color: '#6b7280' },
  tapToFill:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 2 },
  tapToFillText:{ fontSize: 11, color: '#2563eb', fontWeight: '600' },
  bottomBar:    { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  galleryBtn:   { flex: 1, backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 14 },
  cameraBtn:    { flex: 1, backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 14 },
  clearBtn:     { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bottomBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalClose:   { padding: 4 },
  modalPhoto:   { width: 90, height: 120, borderRadius: 10, alignSelf: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#e5e7eb' },
  modalRow:     { flexDirection: 'row', gap: 10 },
  modalField:   { marginBottom: 14 },
  modalLabel:   { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 5 },
  modalInput:   { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  modalInputHighlight: { borderColor: '#2563eb', backgroundColor: '#eff6ff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  classChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  classChipActive:     { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  classChipText:       { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  classChipTextActive: { color: '#fff', fontWeight: '700' },
  modalSaveBtn: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  modalSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
