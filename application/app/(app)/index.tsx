import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import {
  MOCK_ENTRIES,
  EMOTION_COLORS,
  EMOTION_LABELS,
  EMOTION_EMOJIS,
  EMOTION_BG,
} from '@/data/mock';
import type { Emotion } from '@/data/mock';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_SIZE = Math.floor((Dimensions.get('window').width - 32) / 7);
const EMOTIONS: Emotion[] = ['joy', 'calm', 'neutral', 'sadness', 'anxiety', 'anger'];
// Estimated chip width (emoji + label + padding + gap) used for auto-scroll
const CHIP_W = 105;

const TODAY = { year: 2026, month: 4, day: 16 };

const { width: SW, height: SH } = Dimensions.get('window');
const COVER_SIZE = Math.ceil(Math.sqrt(SW * SW + SH * SH)) + 80;

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

  const todayKey = toKey(TODAY.year, TODAY.month, TODAY.day);
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const weeks = buildWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedEntry = MOCK_ENTRIES[selectedKey] ?? null;
  const isSelectedToday = selectedKey === todayKey;

  const [selYear, selMonth1, selDay] = selectedKey.split('-').map(Number);
  const selectedDateLabel = new Date(selYear, selMonth1 - 1, selDay).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  // ── Background circle ──────────────────────────────────────────
  const [bgEmotion, setBgEmotion] = useState<Emotion>('neutral');
  const bgScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const emotion = selectedEntry?.emotion;
    Animated.timing(bgScaleAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      if (emotion) {
        setBgEmotion(emotion);
        Animated.timing(bgScaleAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
  }, [selectedKey]);

  // ── Feeling block slide + chip auto-scroll ─────────────────────
  const moodSlideAnim = useRef(new Animated.Value(0)).current;
  const chipScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!selectedEntry) return;

    // Slide the whole mood block: briefly up then spring into place
    moodSlideAnim.setValue(-18);
    Animated.spring(moodSlideAnim, {
      toValue: 0,
      tension: 90,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Scroll chip row so the detected emotion chip is centred in view
    const idx = EMOTIONS.indexOf(selectedEntry.emotion);
    if (idx >= 0) {
      const targetX = Math.max(0, idx * CHIP_W - (SW - 32) / 2 + CHIP_W / 2);
      chipScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  }, [selectedKey]);

  // ──────────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const navigateToWrite = (emotion?: Emotion) => {
    router.push(emotion ? { pathname: '/write', params: { emotion } } : '/write');
  };

  return (
    <Screen
      background={
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F8F4EF' }]} />
          <Animated.View
            style={[
              styles.colorCircle,
              {
                width: COVER_SIZE,
                height: COVER_SIZE,
                borderRadius: COVER_SIZE / 2,
                backgroundColor: EMOTION_BG[bgEmotion],
                top: SH / 2 - COVER_SIZE / 2,
                left: SW / 2 - COVER_SIZE / 2,
                transform: [{ scale: bgScaleAnim }],
              },
            ]}
          />
        </>
      }
      edges={['top', 'left', 'right']}
    >
      {/* ── Header (always sage-green) ──────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Pressable onPress={prevMonth} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={nextMonth} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-right" size={26} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
            <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Quick mood check-in (slides on date change) ─ */}
        <Animated.View
          style={[
            styles.moodBlock,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.roundness * 4,
              transform: [{ translateY: moodSlideAnim }],
            },
          ]}
        >
          <Text variant="labelSmall" style={[styles.moodPrompt, { color: theme.colors.outline }]}>
            How are you feeling today?
          </Text>
          <ScrollView
            ref={chipScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moodRow}
          >
            {EMOTIONS.map(emotion => (
              <Pressable
                key={emotion}
                onPress={() => navigateToWrite(emotion)}
                style={({ pressed }) => [
                  styles.moodChip,
                  {
                    borderColor: EMOTION_COLORS[emotion],
                    backgroundColor:
                      selectedEntry?.emotion === emotion
                        ? EMOTION_COLORS[emotion]
                        : theme.colors.background,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={styles.moodEmoji}>{EMOTION_EMOJIS[emotion]}</Text>
                <Text
                  style={[
                    styles.moodChipLabel,
                    {
                      color:
                        selectedEntry?.emotion === emotion ? '#fff' : theme.colors.onSurface,
                    },
                  ]}
                >
                  {EMOTION_LABELS[emotion]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

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
              const isToday = year === TODAY.year && month === TODAY.month && day === TODAY.day;
              const isSelected = key === selectedKey;

              return (
                <Pressable
                  key={di}
                  style={[styles.cell, { width: CELL_SIZE }]}
                  onPress={() => setSelectedKey(key)}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.dayBox,
                        { height: CELL_SIZE - 6, opacity: pressed ? 0.72 : 1 },
                        isToday && {
                          backgroundColor: theme.colors.primaryContainer,
                          borderColor: theme.colors.primary,
                        },
                        isSelected && !isToday && {
                          backgroundColor: theme.colors.secondaryContainer,
                          borderColor: theme.colors.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          {
                            color: isToday
                              ? theme.colors.primary
                              : isSelected
                              ? theme.colors.secondary
                              : theme.colors.onSurface,
                          },
                          (isToday || isSelected) && { fontWeight: '700' },
                        ]}
                      >
                        {day}
                      </Text>
                      {entry ? (
                        <Text style={styles.calEmoji}>{EMOTION_EMOJIS[entry.emotion]}</Text>
                      ) : (
                        <View style={styles.emotionDotPlaceholder} />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* ── Selected date / writing block ───────────── */}
        <Pressable
          onPress={() => navigateToWrite(selectedEntry?.emotion)}
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1, marginTop: 18 })}
        >
          <Surface style={[styles.todayCard, { borderRadius: theme.roundness * 3 }]} elevation={2}>
            <View style={styles.todayCardHeader}>
              <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                {isSelectedToday ? `Today · ${selectedDateLabel}` : selectedDateLabel}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.outline} />
            </View>

            {selectedEntry ? (
              <>
                <EmotionBadge emotion={selectedEntry.emotion} />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, marginTop: 10, lineHeight: 20 }}
                >
                  "{selectedEntry.snippet}"
                </Text>
              </>
            ) : (
              <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                {isSelectedToday
                  ? 'How are you feeling today? Tap to write your entry.'
                  : 'No entry for this day. Tap to write one.'}
              </Text>
            )}
          </Surface>
        </Pressable>
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
  colorCircle: {
    position: 'absolute',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  monthTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 2,
  },
  moodBlock: {
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  moodPrompt: {
    marginBottom: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  moodEmoji: {
    fontSize: 15,
  },
  moodChipLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    gap: 2,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5DDD6',
  },
  dayNumber: {
    fontSize: 13,
  },
  calEmoji: {
    fontSize: 11,
  },
  emotionDotPlaceholder: {
    width: 6,
    height: 6,
  },
  todayCard: {
    padding: 18,
  },
  todayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
