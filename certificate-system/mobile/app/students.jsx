import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const CLASS_COLORS = {
  'Top Class': '#b45309', 'P6': '#1d4ed8', 'S3': '#15803d',
  'S6': '#b91c1c', 'Nursery': '#7c3aed', 'Graduation': '#92400e',
};

export default function StudentsScreen() {
  const { api } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');

  const classes = ['All', 'Top Class', 'P6', 'S3', 'S6', 'Nursery', 'Graduation'];

  const load = useCallback(async () => {
    try {
      const res = await api.get('/students');
      setStudents(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = filter === 'All' ? students : students.filter((s) => s.class === filter);

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.photoBox}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.photo} />
        ) : (
          <Ionicons name="person" size={28} color="#9ca3af" />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.num}>📷 #{item.photo_number}</Text>
        <View style={styles.tagRow}>
          <Text style={[styles.classTag, { backgroundColor: (CLASS_COLORS[item.class] || '#374151') + '20', color: CLASS_COLORS[item.class] || '#374151' }]}>
            {item.class}
          </Text>
          <Text style={styles.year}>📅 {item.year}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Class filter */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={classes}
          keyExtractor={(c) => c}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
          renderItem={({ item: cls }) => (
            <TouchableOpacity
              onPress={() => setFilter(cls)}
              style={[styles.filterChip, filter === cls && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filter === cls && styles.filterChipTextActive]}>
                {cls}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <Text style={styles.count}>{filtered.length} students</Text>

      {loading ? (
        <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  filterWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  filterChipActive: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  filterChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  count: { fontSize: 12, color: '#9ca3af', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  row: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  photoBox: { width: 60, height: 74, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  photo: { width: '100%', height: '100%' },
  info: { flex: 1, justifyContent: 'center', gap: 3 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  num: { fontSize: 12, color: '#2563eb', fontFamily: 'monospace' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  classTag: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  year: { fontSize: 11, color: '#9ca3af' },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: '#9ca3af' },
});
