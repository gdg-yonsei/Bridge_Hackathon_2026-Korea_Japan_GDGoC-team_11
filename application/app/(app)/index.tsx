import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, Dimensions,
  Modal, ActivityIndicator, Image,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Text, Surface, useTheme, Menu, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/Screen';
import { EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS } from '@/data/mock';
import type { Emotion } from '@/data/mock';
import { diaryService, decodeContent, type CalendarEntry, type DiaryDetail } from '@/services/diaryService';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_SIZE = Math.floor((Dimensions.get('window').width - 32) / 7);

const EMOTION_IMAGES: Record<Emotion, any> = {
  joy:     require('../../assets/emotions/happniess.png'),
  calm:    require('../../assets/emotions/calm.png'),
  comfort: require('../../assets/emotions/comfort.png'),
  sad:     require('../../assets/emotions/sad.png'),
  anxious: require('../../assets/emotions/anxiety.png'),
  angry:   require('../../assets/emotions/anger.png'),
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

const ITEM_H = 48;
const VISIBLE = 5;
const DRUM_H = ITEM_H * VISIBLE;
const PAD = ITEM_H * 2;

const _now = new Date();
const TODAY = { year: _now.getFullYear(), month: _now.getMonth(), day: _now.getDate() };

const FAB_SIZE = 60;
const FAB_BOTTOM = 32;

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

// ── Drum column (month/year picker) ─────────────────────────────────────────

function DrumColumn<T extends string | number>({
  items, selectedIndex, onIndexChange, textColor, dimColor,
}: {
  items: T[]; selectedIndex: number; onIndexChange: (i: number) => void;
  textColor: string; dimColor: string;
}) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, []);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      onIndexChange(Math.max(0, Math.min(i, items.length - 1)));
    },
    [items.length, onIndexChange],
  );

  return (
    <ScrollView
      ref={ref}
      style={{ height: DRUM_H, flex: 1 }}
      contentContainerStyle={{ paddingVertical: PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={onMomentumEnd}
    >
      {items.map((item, i) => {
        const diff = Math.abs(i - selectedIndex);
        return (
          <View key={String(item)} style={styles.drumItem}>
            <Text style={[
              styles.drumText,
              { color: diff === 0 ? textColor : dimColor,
                opacity: diff === 0 ? 1 : diff === 1 ? 0.45 : 0.2,
                transform: [{ scale: diff === 0 ? 1 : 0.88 }],
                fontWeight: diff === 0 ? '700' : '400' },
            ]}>
              {String(item)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Month/Year picker modal ──────────────────────────────────────────────────

function MonthYearPicker({ visible, year, month, onConfirm, onDismiss }: {
  visible: boolean; year: number; month: number;
  onConfirm: (year: number, month: number) => void; onDismiss: () => void;
}) {
  const theme = useTheme();
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftYear, setDraftYear] = useState(year);

  useEffect(() => {
    if (visible) { setDraftMonth(month); setDraftYear(year); }
  }, [visible, month, year]);

  const yearIndex = YEARS.indexOf(draftYear);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
      <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.modalHandle, { backgroundColor: theme.colors.surfaceVariant }]} />
        <Text variant="titleMedium" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
          Select Month & Year
        </Text>
        <View style={styles.drumWrapper}>
          <View style={[styles.selectionBar, { backgroundColor: theme.colors.primaryContainer, borderRadius: 10 }]} />
          <DrumColumn items={MONTHS} selectedIndex={draftMonth} onIndexChange={setDraftMonth}
            textColor={theme.colors.onSurface} dimColor={theme.colors.onSurface} />
          <View style={[styles.drumDivider, { backgroundColor: theme.colors.surfaceVariant }]} />
          <DrumColumn items={YEARS} selectedIndex={yearIndex >= 0 ? yearIndex : 0}
            onIndexChange={(i) => setDraftYear(YEARS[i])}
            textColor={theme.colors.onSurface} dimColor={theme.colors.onSurface} />
        </View>
        <Pressable style={[styles.confirmBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => onConfirm(draftYear, draftMonth)}>
          <Text style={[styles.confirmText, { color: theme.colors.onPrimary }]}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ── Home screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(TODAY.year);
  const [month, setMonth] = useState(TODAY.month);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [entries, setEntries] = useState<Record<string, CalendarEntry>>({});
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(toKey(TODAY.year, TODAY.month, TODAY.day));
  const [detail, setDetail] = useState<DiaryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoadingEntries(true);
    setDetail(null);
    diaryService.getMonth(year, month + 1)
      .then(data => {
        setEntries(data);
        // auto-load detail for the currently selected key if it exists in new data
        const entry = data[selectedKey];
        if (entry) fetchDetail(entry.entry_id);
      })
      .catch(() => setEntries({}))
      .finally(() => setLoadingEntries(false));
  }, [year, month]);

  const fetchDetail = (entryId: number) => {
    setLoadingDetail(true);
    setDetail(null);
    diaryService.getDetail(entryId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  };

  const handleDayPress = (key: string) => {
    setSelectedKey(key);
    const entry = entries[key];
    if (entry) {
      fetchDetail(entry.entry_id);
    } else {
      setDetail(null);
    }
  };

  const weeks = buildWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const fabBottom = FAB_BOTTOM + insets.bottom;
  const todayKey = toKey(TODAY.year, TODAY.month, TODAY.day);
  const todayEntry = entries[todayKey];
  const hasTodayEntry = todayEntry !== undefined;

  return (
    <Screen
      background={<View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]} />}
      edges={['top', 'left', 'right']}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary, justifyContent: 'space-between' }]}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="titleLarge" style={{ fontWeight: '700', color: '#fff' }}>Calendar</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          }
        >
          <Menu.Item onPress={() => setMenuVisible(false)} title="Calendar" leadingIcon="calendar" />
          <Divider />
          <Menu.Item onPress={() => { setMenuVisible(false); router.push('/report'); }} title="Report" leadingIcon="chart-bar" />
        </Menu>

        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: fabBottom + FAB_SIZE + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Month nav ───────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable style={styles.monthNav} onPress={() => setPickerOpen(true)}>
            <Text style={[styles.monthTitle, { color: theme.colors.onSurface }]}>{monthLabel}</Text>
            {loadingEntries
              ? <ActivityIndicator size={16} color={theme.colors.outline} style={{ marginLeft: 4 }} />
              : <MaterialCommunityIcons name="chevron-down" size={22} color={theme.colors.outline} />}
          </Pressable>

          {(year !== TODAY.year || month !== TODAY.month) && (
            <Pressable 
              onPress={() => {
                setYear(TODAY.year);
                setMonth(TODAY.month);
                setSelectedKey(toKey(TODAY.year, TODAY.month, TODAY.day));
              }}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: theme.colors.primary,
                borderRadius: 20,
                opacity: pressed ? 0.8 : 1,
                shadowColor: theme.colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }]}
            >
              <MaterialCommunityIcons name="calendar-today" size={16} color={theme.colors.onPrimary} />
              <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 13 }}>Today</Text>
            </Pressable>
          )}
        </View>

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
              const entry = entries[key];
              const isToday = year === TODAY.year && month === TODAY.month && day === TODAY.day;
              const isSelected = key === selectedKey;
              const dotColor = entry?.emotion ? EMOTION_COLORS[entry.emotion] : null;
              const isPending = entry && (entry.status === 'pending' || entry.status === 'analyzing');
              return (
                <Pressable key={di} style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]} onPress={() => handleDayPress(key)}>
                  <View style={[
                    styles.dayBox, 
                    { width: CELL_SIZE - 6, height: CELL_SIZE - 6, borderRadius: 12, overflow: 'hidden' },
                    isToday && { backgroundColor: theme.colors.primaryContainer },
                    isSelected && !isToday && { backgroundColor: theme.colors.surfaceVariant },
                    { borderWidth: 2, borderColor: isSelected ? theme.colors.primary : 'transparent' },
                  ]}>
                    <Text style={[
                      styles.dayNumber,
                      { color: isToday ? theme.colors.primary : theme.colors.onSurface },
                      isSelected && { fontWeight: '700' },
                    ]}>
                      {day}
                    </Text>
                    {entry?.emotion && EMOTION_IMAGES[entry.emotion]
                      ? <Image source={EMOTION_IMAGES[entry.emotion]} style={{ width: 18, height: 18 }} resizeMode="contain" />
                      : isPending
                        ? <View style={[styles.emotionDot, { backgroundColor: theme.colors.outline, opacity: 0.35 }]} />
                        : <View style={styles.emotionDotPlaceholder} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* ── Selected day card ───────────────────────── */}
        <SelectedDayCard
          dateKey={selectedKey}
          calEntry={entries[selectedKey] ?? null}
          detail={detail}
          loading={loadingDetail}
          theme={theme}
        />
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────── */}
      <Pressable
        style={[styles.fab, { bottom: fabBottom, backgroundColor: theme.colors.primary }]}
        onPress={() => {
          if (hasTodayEntry) {
            router.push({ pathname: '/write', params: { id: todayEntry.entry_id } });
          } else {
            router.push('/write');
          }
        }}
      >
        <MaterialCommunityIcons name={hasTodayEntry ? "pencil" : "plus"} size={30} color="#fff" />
      </Pressable>

      {/* ── Month/Year picker modal ──────────────────────── */}
      <MonthYearPicker
        visible={pickerOpen}
        year={year}
        month={month}
        onConfirm={(y, m) => { setYear(y); setMonth(m); setPickerOpen(false); }}
        onDismiss={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

function SelectedDayCard({
  dateKey, calEntry, detail, loading, theme,
}: {
  dateKey: string;
  calEntry: CalendarEntry | null;
  detail: DiaryDetail | null;
  loading: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const date = new Date(dateKey + 'T00:00:00');
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
  const accentColor = detail?.emotion
    ? EMOTION_COLORS[detail.emotion]
    : calEntry?.emotion
      ? EMOTION_COLORS[calEntry.emotion]
      : theme.colors.primary;

  const emotion = detail?.emotion || calEntry?.emotion;

  return (
    <Surface
      style={[styles.detailCard, { borderRadius: theme.roundness * 3 }]}
      elevation={0}
    >
      {/* date & emotion row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: accentColor, flex: 1 }}>
          {dateLabel}
        </Text>
        {emotion && EMOTION_IMAGES[emotion] && (
          <Image
            source={EMOTION_IMAGES[emotion]}
            style={{ width: 40, height: 40 }}
            resizeMode="contain"
          />
        )}
      </View>

      {/* loading */}
      {loading && (
        <View style={styles.detailCentered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {/* no entry */}
      {!loading && !calEntry && (
        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
          No entry for this day.
        </Text>
      )}

      {/* entry exists, waiting for analysis */}
      {!loading && calEntry && (calEntry.status === 'pending' || calEntry.status === 'analyzing') && !detail && (
        <View style={styles.detailCentered}>
          <ActivityIndicator size={16} color={theme.colors.primary} />
          <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6 }}>
            Analysing…
          </Text>
        </View>
      )}

      {/* detail loaded */}
      {!loading && detail && (
        <Text
          style={{ fontSize: 16, color: theme.colors.onSurface, lineHeight: 24, marginTop: 8 }}
        >
          {detail.content}
        </Text>
      )}
    </Surface>
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
  headerBg: { height: 80 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  monthTitle: { fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, gap: 2 },
  weekRow: { flexDirection: 'row' },
  cell: { alignItems: 'center', paddingVertical: 3 },
  weekDayText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  dayBox: {
    width: '88%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  dayNumber: { fontSize: 13 },
  emotionDot: { width: 6, height: 6, borderRadius: 3 },
  emotionDotPlaceholder: { width: 6, height: 6 },
  calEmoji: { fontSize: 14, lineHeight: 16 },
  detailCard: {
    padding: 18,
    marginTop: 20,
  },
  detailCentered: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  emotionImageBlock: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 4,
  },
  emotionImageLarge: {
    width: 96,
    height: 96,
  },
  emotionImageLabel: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    borderRadius: 8,
    padding: 10,
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
  emotionEmoji: { fontSize: 16 },
  emotionLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // FAB
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    left: (Dimensions.get('window').width - FAB_SIZE) / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  // modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 20 },
  drumWrapper: {
    flexDirection: 'row', alignItems: 'center',
    position: 'relative', marginBottom: 24,
  },
  selectionBar: {
    position: 'absolute', left: 0, right: 0,
    top: DRUM_H / 2 - ITEM_H / 2, height: ITEM_H, zIndex: 0,
  },
  drumDivider: { width: 1, height: DRUM_H * 0.6, marginHorizontal: 4 },
  drumItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  drumText: { fontSize: 18 },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmText: { fontSize: 16, fontWeight: '700' },
});
