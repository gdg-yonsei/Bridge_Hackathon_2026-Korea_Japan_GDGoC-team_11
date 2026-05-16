import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Report } from '@/types/report';

interface ReportState {
  cachedReport: Report | null;
  savedAt: string | null;
}

const initialState: ReportState = {
  cachedReport: null,
  savedAt: null,
};

export const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    setCachedReport: (state, action: PayloadAction<Report>) => {
      state.cachedReport = action.payload;
      state.savedAt = new Date().toISOString();
    },
    clearCachedReport: (state) => {
      state.cachedReport = null;
      state.savedAt = null;
    },
  },
});

export const { setCachedReport, clearCachedReport } = reportSlice.actions;
