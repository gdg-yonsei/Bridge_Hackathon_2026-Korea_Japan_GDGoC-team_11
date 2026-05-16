import axios from 'axios';
import { supabase } from '@/lib/supabase';

export const axiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && session?.access_token) {
        original.headers.Authorization = `Bearer ${session.access_token}`;
        return axiosInstance(original);
      }
    }
    return Promise.reject(error);
  }
);
