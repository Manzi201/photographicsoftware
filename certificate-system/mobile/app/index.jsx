import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { user, school, api } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, byClass: {} });
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/students');
      const students = res.data.data || [];
      const byClass = students.reduce((acc, s) => {
        acc[s.class] = (acc[s.class] || 0) + 1;
        return acc;
      }, {});
      setStats({ total: students.length, byClass });
      setRecentStudents(students.slice(-6).reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const quickActions = [
    { label: 'Add Student',   icon: 'person-add',  color: '#2563eb', route: '/add-student' },
    { label: 'Batch Upload',  icon: 'images',      color: '#0891b2', route: '/batch-photos' },
    { label: 'All Students',  icon: 'people',      color: '#16a34a', route: '/students' },
    { label: 'Search',        icon: 'search',      color: '#9333ea', route: '/search' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {/* School Banner */}
      <View style={styles.banner}>
        {school?.logo_url ? (
          <Image source={{ uri: school.logo_url }} style={styles.schoolLogo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Ionicons name="school" size={32} color="#fbbf24" />
          </View>
        )}
        <View style={styles.bannerText}>
          <Text style={styles.schoolName} numberOfLines={2}>{school?.school_name || 'Certificate System'}</Text>
          <Text style={styles.bannerSub}>📅 Year: {school?.active_year || '—'} · {user?.email}</Text>
        </View>
      </View>

      {/* Info banner: year reminder */}
      {school?.active_year && (
        <View style={styles.yearBadge}>
          <Ionicons name="information-circle" size={16} color="#1d4ed8" />
          <Text style={styles.yearBadgeText}>
            Abanyeshuri muzabashingiwe muri <Text style={{ fontWeight: '700' }}>{school.active_year}</Text> certificate
          </Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? '...' : stats.total}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? '...' : Object.keys(stats.byClass).length}</Text>
          <Text style={styles.statLabel}>Classes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { fontSize: 18 }]}>{school?.active_year || '—'}</Text>
          <Text style={styles.statLabel}>Active Year</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={[styles.actionBtn, { backgroundColor: action.color }]}
            onPress={() => router.push(action.route)}
          >
            <Ionicons name={action.icon} size={28} color="#fff" />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* By Class breakdown */}
      {!loading && Object.keys(stats.byClass).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>By Class</Text>
          <View style={styles.classList}>
            {Object.entries(stats.byClass).sort((a, b) => b[1] - a[1]).map(([cls, count]) => (
              <View key={cls} style={styles.classRow}>
                <Text style={styles.className}>{cls}</Text>
                <Text style={styles.classCount}>{count} students</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Recent Students */}
      <Text style={styles.sectionTitle}>Recent Students</Text>
      {loading ? (
        <ActivityIndicator color="#2563eb" style={{ marginTop: 20 }} />
      ) : recentStudents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No students yet</Text>
          <TouchableOpacity onPress={() => router.push('/add-student')} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add First Student</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.studentsGrid}>
          {recentStudents.map((student) => (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.photoThumb}>
                {student.photo_url ? (
                  <Image source={{ uri: student.photo_url }} style={styles.studentPhoto} />
                ) : (
                  <Ionicons name="person" size={28} color="#9ca3af" />
                )}
              </View>
              <Text style={styles.studentName} numberOfLines={1}>
                {student.first_name} {student.last_name}
              </Text>
              <Text style={styles.studentNum}>#{student.photo_number}</Text>
              <Text style={styles.studentClass}>{student.class}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  banner: { backgroundColor: '#1e3a8a', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 20 },
  schoolLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#1e40af' },
  logoPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#1e40af', alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1 },
  schoolName: { color: '#fff', fontSize: 18, fontWeight: 'bold', lineHeight: 24 },
  bannerSub: { color: '#93c5fd', fontSize: 12, marginTop: 3 },
  yearBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  yearBadgeText: { flex: 1, fontSize: 12, color: '#1d4ed8', lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statNumber: { fontSize: 26, fontWeight: 'bold', color: '#1e3a8a' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginHorizontal: 16, marginTop: 8, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  actionBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  classList: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  className: { fontSize: 14, fontWeight: '600', color: '#374151' },
  classCount: { fontSize: 13, color: '#6b7280' },
  emptyCard: { margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#6b7280' },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  studentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  studentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', width: '30%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  photoThumb: { width: 56, height: 70, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  studentPhoto: { width: '100%', height: '100%' },
  studentName: { fontSize: 11, fontWeight: '600', color: '#374151', marginTop: 6, textAlign: 'center' },
  studentNum: { fontSize: 10, color: '#2563eb', fontFamily: 'monospace' },
  studentClass: { fontSize: 10, color: '#6b7280' },
});
