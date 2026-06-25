import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function SearchScreen() {
  const { api } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get('/students', { params: { search: query.trim() } });
      setResults(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color="#9ca3af" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="Photo number (001) cyangwa izina..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }} style={{ marginRight: 10 }}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} size="large" />}

      {!loading && searched && results.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
          <Text style={styles.emptyText}>Gerageza izina cyangwa photo number</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.photoBox}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.photo} />
              ) : (
                <Ionicons name="person" size={32} color="#9ca3af" />
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.photoNum}>📷 Photo #{item.photo_number}</Text>
              <Text style={styles.detail}>🎓 {item.class} · 📅 {item.year}</Text>
              {item.school && <Text style={styles.detail}>🏫 {item.school}</Text>}
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.class}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  searchBar: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, gap: 4 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 12, paddingRight: 8 },
  searchBtn: { backgroundColor: '#1e3a8a', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, color: '#6b7280', fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  photoBox: { width: 64, height: 80, borderRadius: 10, backgroundColor: '#f3f4f6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  photo: { width: '100%', height: '100%' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  photoNum: { fontSize: 13, color: '#2563eb', fontWeight: '600', fontFamily: 'monospace' },
  detail: { fontSize: 12, color: '#6b7280' },
  badge: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
});
