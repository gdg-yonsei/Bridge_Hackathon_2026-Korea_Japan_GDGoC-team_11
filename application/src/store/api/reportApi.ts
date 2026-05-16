import { baseApi } from './baseApi';
import type { Report, CreateReportRequest } from '@/types/report';

export const reportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createReport: build.mutation<Report, CreateReportRequest>({
      query: (body) => ({ 
        url: '/reports', 
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Report'],
    }),
  }),
});

export const { useCreateReportMutation } = reportApi;
