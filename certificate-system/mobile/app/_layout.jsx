import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Inner component: handles auth-based navigation guard
function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Not logged in → go to login
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Already logged in → go home
      router.replace('/');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a8a' }}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1e3a8a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="login"         options={{ headerShown: false }} />
      <Stack.Screen name="index"         options={{ title: 'Home', headerRight: () => <LogoutButton /> }} />
      <Stack.Screen name="add-student"   options={{ title: 'Add Student' }} />
      <Stack.Screen name="batch-photos"  options={{ title: 'Batch Upload', headerBackTitle: 'Back' }} />
      <Stack.Screen name="students"      options={{ title: 'All Students' }} />
      <Stack.Screen name="search"        options={{ title: 'Search Student' }} />
    </Stack>
  );
}

// Logout button shown in header
function LogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <View style={{ marginRight: 4 }}>
      <LogoutIcon onPress={async () => { await logout(); router.replace('/login'); }} />
    </View>
  );
}

// Simple icon button (avoids importing extra deps)
function LogoutIcon({ onPress }) {
  const { TouchableOpacity } = require('react-native');
  const { Ionicons } = require('@expo/vector-icons');
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 6 }}>
      <Ionicons name="log-out-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
