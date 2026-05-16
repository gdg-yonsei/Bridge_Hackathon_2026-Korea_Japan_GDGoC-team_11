import axios from 'axios';
import { secureStorage } from './secureStorage';

export const axiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await secureStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await secureStorage.getRefreshToken();
      if (refresh) {
        const { data } = await axiosInstance.post('/auth/refresh', { refreshToken: refresh });
        await secureStorage.setTokens(data.accessToken, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosInstance(original);
      }
    }
    return Promise.reject(error);
  }
);
