import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseApi } from './api/baseApi';
import { diarySlice } from './slices/diarySlice';
import { reportSlice } from './slices/reportSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['diary', 'report'],
};

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  diary: diarySlice.reducer,
  report: reportSlice.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
