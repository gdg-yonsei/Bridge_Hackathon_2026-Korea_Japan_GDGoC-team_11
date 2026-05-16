import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Diary, CreateDiaryRequest } from '@/types/diary';

interface DiaryState {
  entries: Diary[];
}

const initialState: DiaryState = {
  entries: [],
};

export const diarySlice = createSlice({
  name: 'diary',
  initialState,
  reducers: {
    addDiary: (state, { payload }: PayloadAction<CreateDiaryRequest>) => {
      state.entries.unshift({
        ...payload,
        id: Date.now().toString(),
        userId: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    removeDiary: (state, { payload }: PayloadAction<string>) => {
      state.entries = state.entries.filter((d) => d.id !== payload);
    },
    setReportId: (state, { payload }: PayloadAction<{ diaryId: string; reportId: string }>) => {
      const diary = state.entries.find((d) => d.id === payload.diaryId);
      if (diary) diary.reportId = payload.reportId;
    },
  },
});

export const { addDiary, removeDiary, setReportId } = diarySlice.actions;
