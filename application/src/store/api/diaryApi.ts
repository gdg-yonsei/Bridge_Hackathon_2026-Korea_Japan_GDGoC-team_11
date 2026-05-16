import { baseApi } from './baseApi';
import type { Diary, CreateDiaryRequest } from '@/types/diary';

export const diaryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDiaries: build.query<Diary[], void>({
      query: () => ({ url: '/diaries' }),
      providesTags: ['Diary'],
    }),
    getDiary: build.query<Diary, string>({
      query: (id) => ({ url: `/diaries/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Diary', id }],
    }),
    createDiary: build.mutation<Diary, CreateDiaryRequest>({
      query: (body) => ({ url: '/diaries', method: 'POST', data: body }),
      invalidatesTags: ['Diary'],
    }),
    deleteDiary: build.mutation<void, string>({
      query: (id) => ({ url: `/diaries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Diary'],
    }),
  }),
});

export const {
  useGetDiariesQuery,
  useGetDiaryQuery,
  useCreateDiaryMutation,
  useDeleteDiaryMutation,
} = diaryApi;
