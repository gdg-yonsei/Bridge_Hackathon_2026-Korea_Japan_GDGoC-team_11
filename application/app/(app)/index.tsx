import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, Image,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';

import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader, AppHeaderBg } from '@/components/AppHeader';
import { diaryService, type CalendarEntry, type DiaryDetail } from '@/services/diaryService';
import { chatService, type Conversation } from '@/services/chatService';
import { therapistService } from '@/services/therapistService';
import type { Therapist } from '@/types/therapist';
import { EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS } from '@/data/mock';
import type { Emotion } from '@/data/mock';

const { width: SCREEN_W } = Dimensions.get('window');

const EMOTION_IMAGES: Record<Emotion, any> = {
  joy:     require('../../assets/emotions/happniess.png'),
  calm:    require('../../assets/emotions/calm.png'),
  comfort: require('../../assets/emotions/comfort.png'),
  sad:     require('../../assets/emotions/sad.png'),
  anxious: require('../../assets/emotions/anxiety.png'),
  angry:   require('../../assets/emotions/anger.png'),
};

const _now = new Date();
const TODAY = { year: _now.getFullYear(), month: _now.getMonth(), day: _now.getDate() };

function todayKey() {
  return `${TODAY.year}-${String(TODAY.month + 1).padStart(2, '0')}-${String(TODAY.day).padStart(2, '0')}`;
}

function fmtDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function greeting() {
  const h = _now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// yellow/orange need dark text; the rest work fine with white
const LIGHT_EMOTION_COLORS = new Set(['#FFD02C', '#FFA852']);
function onColor(bg: string) {
  return LIGHT_EMOTION_COLORS.has(bg) ? '#1a1a1a' : '#ffffff';
}

// ── No-entry hero ─────────────────────────────────────────────────────────────
function NoEntryHero({ accentColor, onWrite }: { accentColor: string; onWrite: () => void }) {
  const fg = onColor(accentColor);
  return (
    <View style={styles.heroContent}>
      <Text style={[styles.heroGreeting, { color: fg }]}>{greeting()} ✨</Text>
      <Text style={[styles.heroPrompt, { color: fg, opacity: 0.85 }]}>
        How are you feeling today?
      </Text>
      <Text style={[styles.heroSub, { color: fg, opacity: 0.65 }]}>
        Write about your day and let Solis{'\n'}understand your emotions.
      </Text>
      <Pressable
        onPress={onWrite}
        style={({ pressed }) => [
          styles.ctaBtn,
          { backgroundColor: fg === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)', opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <MaterialCommunityIcons name="pencil-plus-outline" size={20} color={fg} />
        <Text style={[styles.ctaBtnText, { color: fg }]}>Write Today's Diary</Text>
      </Pressable>
    </View>
  );
}

// ── Analyzing hero ────────────────────────────────────────────────────────────
function AnalyzingHero({ accentColor }: { accentColor: string }) {
  const fg = onColor(accentColor);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1800, useNativeDriver: true })).start();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={[styles.heroContent, { alignItems: 'center' }]}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <MaterialCommunityIcons name="shimmer" size={48} color={fg} />
      </Animated.View>
      <Text style={[styles.heroPrompt, { color: fg, marginTop: 16 }]}>Analyzing your diary…</Text>
      <Text style={[styles.heroSub, { color: fg, opacity: 0.65 }]}>Solis is reading your emotions</Text>
    </View>
  );
}

// ── Emotion hero ──────────────────────────────────────────────────────────────
function EmotionHero({
  emotion, detail, accentColor, onChat, onEdit,
}: {
  emotion: Emotion;
  detail: DiaryDetail | null;
  accentColor: string;
  onChat: () => void;
  onEdit: () => void;
}) {
  const fg = onColor(accentColor);
  return (
    <View style={[styles.heroContent, { alignItems: 'center' }]}>
      <Text style={[styles.heroSub, { color: fg, opacity: 0.75, marginBottom: 8 }]}>Today you're feeling</Text>
      <Image source={EMOTION_IMAGES[emotion]} style={styles.emotionImage} resizeMode="contain" />
      <Text style={[styles.emotionLabel, { color: fg }]}>
        {EMOTION_EMOJIS[emotion]}  {EMOTION_LABELS[emotion].toUpperCase()}
      </Text>
      {detail?.solis_message ? (
        <Text style={[styles.solisMsg, { color: fg, opacity: 0.8 }]} numberOfLines={3}>
          "{detail.solis_message}"
        </Text>
      ) : null}
      <View style={styles.actionRow}>
        <Pressable
          onPress={onChat}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: fg === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="chat-outline" size={18} color={fg} />
          <Text style={[styles.actionBtnText, { color: fg }]}>Chat with Solis</Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.actionBtnSmall,
            { backgroundColor: fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={fg} />
        </Pressable>
      </View>
    </View>
  );
}

// ── This Week strip ───────────────────────────────────────────────────────────
function WeekStrip({ entries }: { entries: Record<string, CalendarEntry> }) {
  const theme = useTheme();

  // Build last 7 days ending today
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(_now);
    d.setDate(_now.getDate() - (6 - i));
    return d;
  });

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={styles.weekRow}>
      {days.map((d, idx) => {
        const key = fmtDateKey(d);
        const entry = entries[key];
        const isToday = key === todayKey();
        const emotionColor = entry?.emotion ? EMOTION_COLORS[entry.emotion as Emotion] : null;
        const isPending = entry?.status === 'pending' || entry?.status === 'analyzing';

        return (
          <Pressable
            key={key}
            onPress={() => router.push('/calendar')}
            style={({ pressed }) => [
              styles.dayCell,
              isToday && { backgroundColor: theme.colors.primaryContainer },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.dayLabel, { color: theme.colors.outline }]}>
              {DAY_LABELS[d.getDay()]}
            </Text>
            <Text style={[styles.dayNum, { color: isToday ? theme.colors.primary : theme.colors.onSurface, fontWeight: isToday ? '800' : '400' }]}>
              {d.getDate()}
            </Text>
            <View style={styles.dayDot}>
              {isPending ? (
                <ActivityIndicator size={8} color={theme.colors.primary} />
              ) : emotionColor ? (
                <View style={[styles.emotionDot, { backgroundColor: emotionColor }]} />
              ) : (
                <View style={[styles.emotionDot, { backgroundColor: 'transparent' }]} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Recent Chat card ──────────────────────────────────────────────────────────
function RecentChatCard({ conv }: { conv: Conversation }) {
  const theme = useTheme();
  const ago = (() => {
    const diff = Date.now() - new Date(conv.updated_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conv.id } })}
      style={({ pressed }) => [styles.recentChatCard, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.chatIconBox, { backgroundColor: '#0284C718' }]}>
        <MaterialCommunityIcons name="chat-outline" size={22} color="#0284C7" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
          {conv.title}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
          {ago}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.outline} />
    </Pressable>
  );
}

// ── Therapist card ────────────────────────────────────────────────────────────
function TherapistCard({ t }: { t: Therapist }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/therapists/[id]', params: { id: t.therapist_id } })}
      style={({ pressed }) => [styles.therapistCard, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.therapistTop}>
        <View style={[styles.therapistAvatar, { backgroundColor: '#DC262618' }]}>
          <MaterialCommunityIcons name="account-heart-outline" size={22} color="#DC2626" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
            {t.name}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{t.location}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <MaterialCommunityIcons name="star" size={13} color="#F59E0B" />
          <Text style={styles.ratingText}>{t.rating.toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.therapistTags}>
        {t.specializes_in.slice(0, 2).map(s => (
          <View key={s} style={[styles.tag, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.tagText, { color: theme.colors.onSurfaceVariant }]}>{s}</Text>
          </View>
        ))}
        {t.online_available && (
          <View style={[styles.tag, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.tagText, { color: '#065F46' }]}>Online</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const theme = useTheme();
  const [todayEntry, setTodayEntry] = useState<CalendarEntry | null | undefined>(undefined); // undefined = loading
  const [todayDetail, setTodayDetail] = useState<DiaryDetail | null>(null);
  const [monthEntries, setMonthEntries] = useState<Record<string, CalendarEntry>>({});

  // Sections below Quick Access
  const [recentConv, setRecentConv] = useState<Conversation | null | undefined>(undefined);
  const [matchedTherapists, setMatchedTherapists] = useState<Therapist[] | null>(null);
  const [therapistsLoading, setTherapistsLoading] = useState(false);

  // accentColor drives both header and hero background
  const emotion = todayDetail?.emotion ?? todayEntry?.emotion ?? null;
  const accentColor = emotion ? EMOTION_COLORS[emotion] : theme.colors.primary;

  // Re-fetch whenever the screen comes into focus (covers both create and update)
  useFocusEffect(useCallback(() => {
    diaryService.getMonth(TODAY.year, TODAY.month + 1)
      .then(data => {
        setMonthEntries(data);
        const entry = data[todayKey()] ?? null;
        setTodayEntry(entry);
        if (entry) {
          diaryService.getDetail(entry.entry_id)
            .then(setTodayDetail)
            .catch(() => setTodayDetail(null));
        } else {
          setTodayDetail(null);
        }
      })
      .catch(() => setTodayEntry(null));

    // Fetch most recent conversation
    chatService.list()
      .then(convs => setRecentConv(convs.length > 0 ? convs[0] : null))
      .catch(() => setRecentConv(null));
  }, []));

  // Poll while today's entry is pending/analyzing
  useEffect(() => {
    if (!todayEntry) return;
    if (todayEntry.status !== 'pending' && todayEntry.status !== 'analyzing') return;

    const INTERVAL = 3000;
    const id = setInterval(async () => {
      try {
        const detail = await diaryService.getDetail(todayEntry.entry_id);
        setTodayDetail(detail);
        if (detail.status !== 'pending' && detail.status !== 'analyzing') {
          setTodayEntry(prev => prev ? { ...prev, status: detail.status, emotion: detail.emotion } : prev);
          clearInterval(id);
        }
      } catch {
        // network blip — keep polling
      }
    }, INTERVAL);

    return () => clearInterval(id);
  }, [todayEntry?.entry_id, todayEntry?.status]);

  // Fetch therapist recommendations once we have today's emotion
  useEffect(() => {
    if (!emotion) return;
    setTherapistsLoading(true);
    therapistService.match({
      emotion,
      context: todayDetail?.solis_message ?? todayDetail?.summary ?? undefined,
    })
      .then(list => {
        console.log('[therapist/match] response:', JSON.stringify(list, null, 2));
        setMatchedTherapists(list.slice(0, 2));
      })
      .catch((err) => {
        console.error('[therapist/match] error:', err);
        setMatchedTherapists(null);
      })
      .finally(() => setTherapistsLoading(false));
  }, [emotion]);

  const handleChat = async () => {
    if (!todayEntry) return;
    try {
      const convs = await chatService.list(todayEntry.entry_id);
      const target = convs.length > 0 ? convs[0] : await chatService.create(todayEntry.entry_id);
      router.push({ pathname: '/chat/[id]', params: { id: target.id } });
    } catch {}
  };

  const isAnalyzing = todayEntry && (todayEntry.status === 'pending' || todayEntry.status === 'analyzing');
  const isDone = todayEntry && todayEntry.status === 'done' && emotion;

  return (
    <Screen
      background={<AppHeaderBg backgroundColor={accentColor} />}
      edges={['top', 'left', 'right']}
    >
      <AppHeader currentRoute="index" backgroundColor={accentColor} foregroundColor={onColor(accentColor)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* ── Hero card ─────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: accentColor }]}>
          {todayEntry === undefined ? (
            // still loading
            <View style={[styles.heroContent, { alignItems: 'center' }]}>
              <ActivityIndicator color={onColor(accentColor)} />
            </View>
          ) : !todayEntry ? (
            <NoEntryHero accentColor={accentColor} onWrite={() => router.push('/write')} />
          ) : isAnalyzing ? (
            <AnalyzingHero accentColor={accentColor} />
          ) : isDone ? (
            <EmotionHero
              emotion={emotion as Emotion}
              detail={todayDetail}
              accentColor={accentColor}
              onChat={handleChat}
              onEdit={() => router.push({ pathname: '/write', params: { id: todayEntry.entry_id } })}
            />
          ) : (
            // entry exists but no emotion yet (failed analysis etc.)
            <NoEntryHero accentColor={accentColor} onWrite={() => router.push({ pathname: '/write', params: { id: todayEntry.entry_id } })} />
          )}
        </View>

        {/* ── Quick actions ─────────────────────────── */}
        <View style={styles.quickSection}>
          <Text variant="labelLarge" style={{ color: theme.colors.outline, letterSpacing: 1, marginBottom: 14 }}>
            QUICK ACCESS
          </Text>
          <View style={styles.quickGrid}>
            <QuickCard icon="calendar-month-outline" label="Calendar" color="#6750A4" onPress={() => router.push('/calendar')} />
            <QuickCard icon="chat-outline" label="Chat" color="#0284C7" onPress={() => router.push('/chat')} />
            <QuickCard icon="chart-bar" label="Report" color="#059669" onPress={() => router.push('/report')} />
            <QuickCard icon="account-heart-outline" label="Therapists" color="#DC2626" onPress={() => router.push('/therapists')} />
          </View>
        </View>

        {/* ── This Week ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader label="THIS WEEK" onMore={() => router.push('/calendar')} />
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <WeekStrip entries={monthEntries} />
          </View>
        </View>

        {/* ── Recent Chat ───────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader label="RECENT CHAT" onMore={() => router.push('/chat')} />
          {recentConv === undefined ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 8 }} />
          ) : recentConv ? (
            <RecentChatCard conv={recentConv} />
          ) : (
            <Pressable
              onPress={() => router.push('/chat')}
              style={({ pressed }) => [styles.emptyCard, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.8 : 1 }]}
            >
              <MaterialCommunityIcons name="chat-plus-outline" size={24} color={theme.colors.outline} />
              <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginLeft: 10 }}>Start a conversation with Solis</Text>
            </Pressable>
          )}
        </View>

        {/* ── Recommended Therapists ────────────────── */}
        {emotion && (
          <View style={styles.section}>
            <SectionHeader label="RECOMMENDED FOR YOU" onMore={() => router.push('/therapists')} />
            {therapistsLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 8 }} />
            ) : matchedTherapists && matchedTherapists.length > 0 ? (
              <View style={{ gap: 10 }}>
                {matchedTherapists.map(t => <TherapistCard key={t.therapist_id} t={t} />)}
              </View>
            ) : (
              <Pressable
                onPress={() => router.push('/therapists')}
                style={({ pressed }) => [styles.emptyCard, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.8 : 1 }]}
              >
                <MaterialCommunityIcons name="account-search-outline" size={24} color={theme.colors.outline} />
                <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginLeft: 10 }}>Browse therapist directory</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHeader({ label, onMore }: { label: string; onMore: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text variant="labelLarge" style={{ color: theme.colors.outline, letterSpacing: 1 }}>{label}</Text>
      <Pressable onPress={onMore} hitSlop={8}>
        <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>See all</Text>
      </Pressable>
    </View>
  );
}

function QuickCard({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickCard, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={26} color={color} />
      </View>
      <Text variant="labelMedium" style={{ marginTop: 8, fontWeight: '600', color: theme.colors.onSurface }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroBg: {
    height: 380,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  heroCard: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 36,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroContent: {
    paddingTop: 12,
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroPrompt: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  emotionImage: {
    width: 140,
    height: 140,
    marginBottom: 8,
  },
  emotionLabel: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  solisMsg: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginHorizontal: 8,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionBtnSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  quickSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickCard: {
    width: (SCREEN_W - 52) / 2,
    borderRadius: 20,
    padding: 18,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Sections ──────────────────────────────────
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // ── Week strip ────────────────────────────────
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    minWidth: 36,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayNum: {
    fontSize: 15,
    marginBottom: 4,
  },
  dayDot: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  // ── Recent Chat ───────────────────────────────
  recentChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // ── Therapist card ────────────────────────────
  therapistCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  therapistTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  therapistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  therapistTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
