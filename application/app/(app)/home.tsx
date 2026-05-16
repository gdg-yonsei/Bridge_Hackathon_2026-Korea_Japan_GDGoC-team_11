import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, Image,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';

import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader, AppHeaderBg } from '@/components/AppHeader';
import { diaryService, type CalendarEntry, type DiaryDetail } from '@/services/diaryService';
import { chatService } from '@/services/chatService';
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const theme = useTheme();
  const [todayEntry, setTodayEntry] = useState<CalendarEntry | null | undefined>(undefined); // undefined = loading
  const [todayDetail, setTodayDetail] = useState<DiaryDetail | null>(null);

  // accentColor drives both header and hero background
  const emotion = todayDetail?.emotion ?? todayEntry?.emotion ?? null;
  const accentColor = emotion ? EMOTION_COLORS[emotion] : theme.colors.primary;

  useEffect(() => {
    diaryService.getMonth(TODAY.year, TODAY.month + 1)
      .then(data => {
        const entry = data[todayKey()] ?? null;
        setTodayEntry(entry);
        if (entry) {
          diaryService.getDetail(entry.entry_id)
            .then(setTodayDetail)
            .catch(() => setTodayDetail(null));
        }
      })
      .catch(() => setTodayEntry(null));
  }, []);

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
      <AppHeader currentRoute="home" backgroundColor={accentColor} foregroundColor={onColor(accentColor)} />

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
            <QuickCard icon="calendar-month-outline" label="Calendar" color="#6750A4" onPress={() => router.push('/')} />
            <QuickCard icon="chat-outline" label="Chat" color="#0284C7" onPress={() => router.push('/chat')} />
            <QuickCard icon="chart-bar" label="Report" color="#059669" onPress={() => router.push('/report')} />
            <QuickCard icon="account-heart-outline" label="Therapists" color="#DC2626" onPress={() => router.push('/therapists')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
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
});
