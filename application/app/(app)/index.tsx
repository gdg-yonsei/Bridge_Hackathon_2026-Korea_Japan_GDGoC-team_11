import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { MOCK_ENTRIES, EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS } from '@/data/mock';
import type { Emotion } from '@/data/mock';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_SIZE = Math.floor((Dimensions.get('window').width - 32) / 7);

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
    year: 'numeric',
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
    // background bleeds behind the status bar (edge-to-edge)
    // SafeAreaView (top + sides) keeps content below the notch
    <Screen
      background={<View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]} />}
      edges={['top', 'left', 'right']}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Pressable onPress={prevMonth} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <Pressable onPress={nextMonth} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-right" size={26} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Weekday labels ──────────────────────────── */}
        <View style={styles.weekRow}>
          {WEEK_DAYS.map(d => (
            <View key={d} style={[styles.cell, { width: CELL_SIZE }]}>
              <Text style={[styles.weekDayText, { color: theme.colors.outline }]}>{d}</Text>
            </View>
          ))}
        </View>

        {/* ── Calendar grid ───────────────────────────── */}
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={[styles.cell, { width: CELL_SIZE }]} />;

              const key = toKey(year, month, day);
              const entry = MOCK_ENTRIES[key];
              const isToday =
                year === TODAY.year && month === TODAY.month && day === TODAY.day;

              return (
                <View key={di} style={[styles.cell, { width: CELL_SIZE }]}>
                  <View
                    style={[
                      styles.dayBox,
                      { height: CELL_SIZE - 6 },
                      isToday && { backgroundColor: theme.colors.primaryContainer },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: isToday ? theme.colors.primary : theme.colors.onSurface },
                        isToday && { fontWeight: '700' },
                      ]}
                    >
                      {day}
                    </Text>
                    {entry ? (
                      <View
                        style={[
                          styles.emotionDot,
                          { backgroundColor: EMOTION_COLORS[entry.emotion] },
                        ]}
                      />
                    ) : (
                      <View style={styles.emotionDotPlaceholder} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* ── Today's mood card ───────────────────────── */}
        <Surface
          style={[styles.todayCard, { borderRadius: theme.roundness * 3 }]}
          elevation={1}
        >
          <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 6 }}>
            Today · May {TODAY.day}
          </Text>

          {todayEntry ? (
            <>
              <EmotionBadge emotion={todayEntry.emotion} />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurface, marginTop: 10, lineHeight: 20 }}
              >
                "{todayEntry.snippet}"
              </Text>
            </>
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              How are you feeling today? Tap Write to add your entry.
            </Text>
          )}
        </Surface>
      </ScrollView>
    </Screen>
  );
}

function EmotionBadge({ emotion }: { emotion: Emotion }) {
  return (
    <View style={[styles.emotionBadge, { backgroundColor: EMOTION_COLORS[emotion] }]}>
      <Text style={styles.emotionEmoji}>{EMOTION_EMOJIS[emotion]}</Text>
      <Text style={styles.emotionLabel}>{EMOTION_LABELS[emotion]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: {
    // covers the status bar area + header height
    height: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  monthTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 2,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    paddingVertical: 3,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dayBox: {
    width: '88%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  dayNumber: {
    fontSize: 13,
  },
  emotionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emotionDotPlaceholder: {
    width: 6,
    height: 6,
  },
  todayCard: {
    padding: 18,
    marginTop: 20,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  emotionEmoji: {
    fontSize: 16,
  },
  emotionLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
