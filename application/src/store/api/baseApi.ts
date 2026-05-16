import { createApi } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig, AxiosError } from 'axios';
import { axiosInstance } from '@/services/axiosInstance';

const axiosBaseQuery: BaseQueryFn<AxiosRequestConfig, unknown, unknown> = async (config) => {
  try {
    const result = await axiosInstance(config);
    return { data: result.data };
  } catch (err) {
    const error = err as AxiosError;
    return {
      error: {
        status: error.response?.status,
        data: error.response?.data ?? error.message,
      },
    };
  }
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery,
  tagTypes: ['Diary', 'Report', 'Conversation'],
  endpoints: () => ({}),
});
