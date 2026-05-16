import { baseApi } from './baseApi';
import type { Report } from '@/types/report';

export const reportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReport: build.query<Report, string>({
      query: (diaryId) => ({ url: `/diaries/${diaryId}/report` }),
      providesTags: (_r, _e, diaryId) => [{ type: 'Report', id: diaryId }],
    }),
    generateReport: build.mutation<Report, string>({
      query: (diaryId) => ({ url: `/diaries/${diaryId}/report`, method: 'POST' }),
      invalidatesTags: (_r, _e, diaryId) => [{ type: 'Report', id: diaryId }, 'Diary'],
    }),
  }),
});

export const { useGetReportQuery, useGenerateReportMutation } = reportApi;
