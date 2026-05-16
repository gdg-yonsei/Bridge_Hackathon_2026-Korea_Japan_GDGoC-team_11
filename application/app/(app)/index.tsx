import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { HealingCard } from '@/components/common/HealingCard';
import { EmotionChip } from '@/components/common/EmotionChip';
import { tokens } from '@/theme/tokens';
import { MOCK_ENTRIES, EMOTION_COLORS } from '@/data/mock';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const { width } = Dimensions.get('window');
const CELL_SIZE = Math.floor((width - 48) / 7);

// Today hardcoded to match the demo date
const TODAY = { year: 2026, month: 4, day: 16 };

function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const [year, setYear] = useState(TODAY.year);
  const [month, setMonth] = useState(TODAY.month);

  const weeks = buildWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
  });

  const todayKey = toKey(TODAY.year, TODAY.month, TODAY.day);
  const todayEntry = MOCK_ENTRIES[todayKey];

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text variant="titleLarge" style={styles.monthTitle}>{monthLabel}</Text>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>{year}</Text>
        </View>
        <View style={styles.headerRight}>
          <IconButton icon="chevron-left" size={24} onPress={prevMonth} />
          <IconButton icon="chevron-right" size={24} onPress={nextMonth} />
          <IconButton icon="cog-outline" size={24} onPress={() => router.push('/settings')} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Calendar Grid ───────────────────────────── */}
        <HealingCard variant="flat" style={styles.calendarCard}>
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <View key={i} style={[styles.cell, { width: CELL_SIZE }]}>
                <Text variant="labelSmall" style={{ color: theme.colors.outline, fontWeight: '700' }}>{d}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={[styles.cell, { width: CELL_SIZE }]} />;

                const key = toKey(year, month, day);
                const entry = MOCK_ENTRIES[key];
                const isToday = year === TODAY.year && month === TODAY.month && day === TODAY.day;

                return (
                  <View key={di} style={[styles.cell, { width: CELL_SIZE }]}>
                    <Pressable
                      style={[
                        styles.dayBox,
                        { height: CELL_SIZE - 4 },
                        isToday && { backgroundColor: theme.colors.primary, borderRadius: tokens.roundness.md },
                      ]}
                    >
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.dayNumber,
                          { color: isToday ? '#fff' : theme.colors.onSurface },
                          isToday && { fontWeight: '700' },
                        ]}
                      >
                        {day}
                      </Text>
                      {entry && (
                        <View
                          style={[
                            styles.emotionIndicator,
                            { backgroundColor: isToday ? '#fff' : EMOTION_COLORS[entry.emotion] },
                          ]}
                        />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </HealingCard>

        {/* ── Today's Insight Card ────────────────────── */}
        <HealingCard variant="floating" style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <View>
              <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                Today's Reflection
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                May {TODAY.day}, {TODAY.year}
              </Text>
            </View>
            <IconButton 
              icon="plus" 
              mode="contained" 
              containerColor={theme.colors.primaryContainer}
              iconColor={theme.colors.primary}
              onPress={() => router.push('/(app)/write')} 
            />
          </View>

          <View style={styles.divider} />

          {todayEntry ? (
            <View style={styles.entryContent}>
              <EmotionChip emotion={todayEntry.emotion} />
              <Text
                variant="bodyLarge"
                style={styles.snippetText}
              >
                "{todayEntry.snippet}"
              </Text>
              <Pressable onPress={() => router.push('/(app)/diary')}>
                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginTop: tokens.spacing.sm }}>
                  View full entry →
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyContent}>
              <MaterialCommunityIcons name="leaf" size={32} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 12 }}>
                How is your garden growing today?{'\n'}Take a moment to record your thoughts.
              </Text>
            </View>
          )}
        </HealingCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  monthTitle: {
    fontWeight: '700',
    fontSize: 24,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  calendarCard: {
    padding: tokens.spacing.md,
    backgroundColor: '#F7F8F5',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayBox: {
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayNumber: {
    fontSize: 14,
  },
  emotionIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  todayCard: {
    marginTop: 24,
    padding: tokens.spacing.xl,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2EE',
    marginVertical: tokens.spacing.lg,
  },
  entryContent: {
    gap: tokens.spacing.md,
  },
  snippetText: {
    color: '#3A3C39',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
