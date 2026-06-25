import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Shyiramo email na password');
      return;
    }
    setLoading(true);
    try {
      const school = await login(email.trim().toLowerCase(), password);
      // Navigate to home — school info now available globally
      router.replace('/');
    } catch (err) {
      Alert.alert(
        'Login Failed',
        err.response?.data?.error || 'Check your email and password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Logo section */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Ionicons name="school" size={44} color="#1e3a8a" />
          </View>
          <Text style={styles.appTitle}>Certificate System</Text>
          <Text style={styles.appSubtitle}>Sign in to your school account</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="school@example.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="log-in" size={20} color="#fff" /><Text style={styles.loginBtnText}>Sign In</Text></>}
          </TouchableOpacity>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
            <Text style={styles.infoText}>
              Each school has its own private account. Students, photos and certificates are separated per school.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a8a' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoBox: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  appTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: '#93c5fd' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1e3a8a', marginBottom: 20 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 7 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 13 },
  eyeBtn: { padding: 4 },
  loginBtn: { backgroundColor: '#1e3a8a', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  loginBtnDisabled: { backgroundColor: '#93c5fd' },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginTop: 16, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: '#1d4ed8', lineHeight: 18 },
});
