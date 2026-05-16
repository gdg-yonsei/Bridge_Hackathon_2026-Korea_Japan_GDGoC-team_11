import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry } from '../types';

const ENTRIES_KEY = 'maeum_entries_v1';

export async function loadEntries(): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const entries: JournalEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  try {
    const existing = await loadEntries();
    const updated = [entry, ...existing.filter((e) => e.id !== entry.id)];
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('saveEntry error:', e);
  }
}

export async function updateEntry(
  id: string,
  patch: Partial<JournalEntry>
): Promise<void> {
  try {
    const existing = await loadEntries();
    const updated = existing.map((e) => (e.id === id ? { ...e, ...patch } : e));
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('updateEntry error:', e);
  }
}

export function calcStreak(entries: JournalEntry[]): number {
  if (!entries.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateSet = new Set(
    entries.map((e) => {
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  let streak = 0;
  const cursor = new Date(today);
  while (dateSet.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
