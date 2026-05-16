import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import { largeSecureStore } from './largeSecureStore';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

const storage = Platform.OS === 'web' ? AsyncStorage : largeSecureStore;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 앱이 포그라운드로 돌아올 때 세션 갱신
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
