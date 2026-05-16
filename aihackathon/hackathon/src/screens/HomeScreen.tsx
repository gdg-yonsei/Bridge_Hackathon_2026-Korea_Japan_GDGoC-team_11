import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { MoodKey, JournalEntry, RootStackParamList } from '../types';
import { MOODS, COLORS } from '../constants/moods';
import { loadEntries, calcStreak } from '../lib/storage';
import MoodGrid from '../components/MoodGrid';
import JournalSheet, { JournalSheetHandle } from '../components/JournalSheet';

type Nav = StackNavigationProp<RootStackParamList, 'Home'>;

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const sheetRef = useRef<JournalSheetHandle>(null);

  const [selectedMood, setSelectedMood] = useState<MoodKey>('neutral');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadEntries().then((data) => {
        setEntries(data.slice(0, 3));
        setStreak(calcStreak(data));
      });
    }, [])
  );

  const handleSaved = (entry: JournalEntry) => {
    navigation.navigate('Report', { entry });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topbar}>
          <Text style={styles.logo}>maeum</Text>
          <View style={styles.datePill}>
            <Text style={styles.datePillTxt}>{formatDate()}</Text>
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greetingSub}>{greeting()}</Text>
          <Text style={styles.greetingMain}>How are you{'\n'}feeling today?</Text>
        </View>

        {/* Mood grid */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT YOUR MOOD</Text>
          <MoodGrid selected={selectedMood} onSelect={setSelectedMood} />
        </View>

        {/* Streak */}
        <View style={styles.streakCard}>
          <View style={styles.streakIcon}>
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </View>
          <View>
            <Text style={styles.streakNum}>{streak} day{streak !== 1 ? 's' : ''}</Text>
            <Text style={styles.streakSub}>Current journaling streak</Text>
          </View>
        </View>

        {/* Past entries */}
        {entries.length > 0 && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionLabel}>RECENT ENTRIES</Text>
            {entries.map((e) => (
              <View key={e.id} style={styles.entryCard}>
                <Text style={styles.entryFace}>{MOODS[e.mood].face}</Text>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryDate}>
                    {formatRelative(e.date)} · {MOODS[e.mood].label}
                  </Text>
                  <Text style={styles.entryPreview} numberOfLines={1}>
                    {e.content.trim() || '(no content)'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky write button */}
      <View style={styles.writeBtnWrap}>
        <TouchableOpacity
          style={styles.writeBtn}
          onPress={() => sheetRef.current?.open()}
          activeOpacity={0.85}
        >
          <Text style={styles.writeBtnTxt}>✏️  Write today's entry</Text>
        </TouchableOpacity>
      </View>

      {/* Journal slide-up sheet */}
      <JournalSheet
        ref={sheetRef}
        selectedMood={selectedMood}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },

  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  logo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a4a38',
    fontStyle: 'italic',
  },
  datePill: {
    backgroundColor: COLORS.greenLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  datePillTxt: { fontSize: 11, color: '#5a8a7a', fontWeight: '600' },

  greetingWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  greetingSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  greetingMain: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 34,
  },

  section: { paddingHorizontal: 20, paddingTop: 22 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  streakCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakIcon: {
    width: 42,
    height: 42,
    backgroundColor: COLORS.greenLight,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNum: { fontSize: 22, fontWeight: '700', color: '#1a4a38' },
  streakSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  entryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#e8e0d0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryFace: { fontSize: 24 },
  entryInfo: { flex: 1 },
  entryDate: { fontSize: 11, color: '#9a9080', marginBottom: 2 },
  entryPreview: {
    fontSize: 14,
    color: '#4a3a28',
    fontStyle: 'italic',
  },

  writeBtnWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 12,
    backgroundColor: COLORS.bg,
    borderTopWidth: 0.5,
    borderTopColor: '#d0cabb',
  },
  writeBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  writeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
