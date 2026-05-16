import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS, EMOTION_BG } from '@/data/mock';
import type { Emotion } from '@/data/mock';

const DATE_LABEL = 'Thursday, May 16, 2026';
const EMOTIONS: Emotion[] = ['joy', 'calm', 'neutral', 'sadness', 'anxiety', 'anger'];
const NUM_LINES = 18;
const BINDING_DOTS = 9;

const { width: SW, height: SH } = Dimensions.get('window');
const COVER_SIZE = Math.ceil(Math.sqrt(SW * SW + SH * SH)) + 80;

// ── Keyword-based emotion classifier ──────────────────────────────
const KEYWORD_MAP: { keywords: string[]; emotion: Emotion }[] = [
  {
    keywords: ['happy', 'joy', 'great', 'amazing', 'wonderful', 'excited', 'love', 'good', 'fun', 'laugh', 'smile', 'fantastic', 'awesome'],
    emotion: 'joy',
  },
  {
    keywords: ['sad', 'miss', 'lonely', 'cry', 'tears', 'loss', 'hurt', 'unhappy', 'depressed', 'blue', 'grief', 'mourn'],
    emotion: 'sadness',
  },
  {
    keywords: ['angry', 'frustrated', 'mad', 'annoying', 'terrible', 'awful', 'hate', 'rage', 'furious', 'irritated', 'upset'],
    emotion: 'anger',
  },
  {
    keywords: ['anxious', 'nervous', 'worry', 'stress', 'scared', 'fear', 'panic', 'overwhelm', 'pressure', 'tense', 'dread'],
    emotion: 'anxiety',
  },
  {
    keywords: ['calm', 'peaceful', 'relax', 'quiet', 'serene', 'gentle', 'content', 'ease', 'rest', 'grateful', 'mindful'],
    emotion: 'calm',
  },
];

function classifyEmotion(text: string): Emotion {
  const lower = text.toLowerCase();
  let best: Emotion = 'neutral';
  let bestCount = 0;
  for (const { keywords, emotion } of KEYWORD_MAP) {
    const count = keywords.filter(k => lower.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      best = emotion;
    }
  }
  return best;
}
// ──────────────────────────────────────────────────────────────────

export default function WriteScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ emotion?: string }>();

  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'pinned'>('idle');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion>('neutral');

  // Sync emotion chip when navigated from Home with a param
  useEffect(() => {
    const e = params.emotion as Emotion | undefined;
    if (e && EMOTIONS.includes(e)) setSelectedEmotion(e);
  }, [params.emotion]);

  // ── Background circle ──────────────────────────────────────────
  const [bgEmotion, setBgEmotion] = useState<Emotion>('neutral');
  const bgEmotionRef = useRef<Emotion>('neutral');
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scaleTargetRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync so the interval closure always sees the latest value
  useEffect(() => { bgEmotionRef.current = bgEmotion; }, [bgEmotion]);

  // Helper: collapse circle, swap colour, re-expand to current text target
  const transitionTo = useCallback((emotion: Emotion) => {
    const target = scaleTargetRef.current;
    Animated.timing(scaleAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setBgEmotion(emotion);
      bgEmotionRef.current = emotion;
      if (target > 0) {
        Animated.timing(scaleAnim, {
          toValue: target,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
  }, []);

  // Emotion chip changed: update background
  useEffect(() => {
    transitionTo(selectedEmotion);
  }, [selectedEmotion]);

  // Per-second analysis while typing — runs classify every 1 s and transitions
  // to the new emotion only when it differs from the current background
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!text.trim()) { intervalRef.current = null; return; }

    intervalRef.current = setInterval(() => {
      const detected = classifyEmotion(text);
      if (detected !== bgEmotionRef.current) transitionTo(detected);
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [text, transitionTo]);

  // Real-time circle size: grows proportionally as the user types
  const handleTextChange = (t: string) => {
    setText(t);
    if (state === 'pinned') setState('idle');

    const newTarget = t.length > 0 ? Math.min(0.06 + t.length / 220, 1) : 0;
    scaleTargetRef.current = newTarget;
    Animated.timing(scaleAnim, {
      toValue: newTarget,
      duration: 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // Reflect = pin: stop analysis, lock circle at full scale, show insight
  const handlePin = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setState('pinned');
    scaleTargetRef.current = 1;
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleSave = () => {
    setText('');
    setState('idle');
    scaleTargetRef.current = 0;
    Animated.timing(scaleAnim, { toValue: 0, duration: 900, useNativeDriver: true }).start();
  };

  return (
    <Screen
      edges={['top', 'left', 'right']}
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
                transform: [{ scale: scaleAnim }],
              },
            ]}
          />
        </>
      }
    >
      {/* ── Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <Text variant="titleMedium" style={[styles.headerTitle, { color: theme.colors.primary }]}>
          Today's Journal
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
          {DATE_LABEL}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Emotion picker ─────────────────────── */}
          <View
            style={[
              styles.emotionSection,
              { backgroundColor: theme.colors.surfaceVariant, borderRadius: theme.roundness * 4 },
            ]}
          >
            <Text variant="labelSmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
              How are you feeling right now?
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emotionRow}
            >
              {EMOTIONS.map(emotion => (
                <Pressable
                  key={emotion}
                  onPress={() => setSelectedEmotion(emotion)}
                  style={({ pressed }) => [
                    styles.emotionChip,
                    {
                      borderColor: EMOTION_COLORS[emotion],
                      backgroundColor:
                        selectedEmotion === emotion ? EMOTION_COLORS[emotion] : 'transparent',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={styles.chipEmoji}>{EMOTION_EMOJIS[emotion]}</Text>
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: selectedEmotion === emotion ? '#fff' : EMOTION_COLORS[emotion] },
                    ]}
                  >
                    {EMOTION_LABELS[emotion]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ── Notebook body ──────────────────────── */}
          <View style={styles.notebookOuter}>
            <View style={[styles.bindingRail, { backgroundColor: theme.colors.primaryContainer }]}>
              {Array.from({ length: BINDING_DOTS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.bindingDot,
                    { borderColor: theme.colors.primary, backgroundColor: '#F8F4EF' },
                  ]}
                />
              ))}
            </View>
            <View style={[styles.paperArea, { borderLeftColor: theme.colors.outlineVariant }]}>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {Array.from({ length: NUM_LINES }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.ruledLine, { top: 36 + i * 28, borderBottomColor: '#E2D8CC' }]}
                  />
                ))}
              </View>
              <TextInput
                style={[styles.journalInput, { color: theme.colors.onSurface }]}
                placeholder="Write freely — this is your safe space.\nNo right or wrong answers here…"
                placeholderTextColor={theme.colors.outline}
                multiline
                value={text}
                onChangeText={handleTextChange}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* ── Insight card (shown after Reflect is pressed) ── */}
          {state === 'pinned' && (
            <View
              style={[
                styles.insightCard,
                { backgroundColor: theme.colors.primaryContainer, borderRadius: theme.roundness * 4 },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.primary, marginBottom: 8, fontWeight: '700' }}
              >
                Reflection insight
              </Text>
              <View style={[styles.emotionBadge, { backgroundColor: EMOTION_COLORS[bgEmotion] }]}>
                <Text style={styles.badgeEmoji}>{EMOTION_EMOJIS[bgEmotion]}</Text>
                <Text style={styles.badgeLabel}>{EMOTION_LABELS[bgEmotion]}</Text>
              </View>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onPrimaryContainer, marginTop: 10, lineHeight: 19 }}
              >
                Your words carry a sense of {EMOTION_LABELS[bgEmotion].toLowerCase()}. Writing this
                down is a meaningful step.
              </Text>
            </View>
          )}

          {state === 'idle' && !text && (
            <Text style={[styles.hint, { color: theme.colors.outline }]}>
              Your diary is private. Be as honest as you'd like.
            </Text>
          )}
        </ScrollView>

        {/* ── Action bar ───────────────────────────── */}
        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: theme.colors.outlineVariant,
              borderTopWidth: 1,
              backgroundColor: 'rgba(255,255,255,0.7)',
            },
          ]}
        >
          <Button
            mode="outlined"
            onPress={handlePin}
            disabled={!text.trim() || state !== 'idle'}
            style={{ flex: 1 }}
            contentStyle={styles.btnContent}
          >
            Reflect
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={state !== 'pinned'}
            style={{ flex: 1 }}
            contentStyle={styles.btnContent}
          >
            Save to Journal
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
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
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 12,
  },
  emotionSection: {
    padding: 14,
  },
  emotionRow: {
    gap: 8,
    flexDirection: 'row',
  },
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipEmoji: {
    fontSize: 15,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  notebookOuter: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 340,
  },
  bindingRail: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
  },
  bindingDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  paperArea: {
    flex: 1,
    backgroundColor: '#FFFEF9',
    minHeight: 340,
    borderLeftWidth: 1,
  },
  ruledLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
  },
  journalInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 28,
    padding: 12,
    minHeight: 320,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  insightCard: {
    padding: 16,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  btnContent: {
    height: 44,
  },
});
