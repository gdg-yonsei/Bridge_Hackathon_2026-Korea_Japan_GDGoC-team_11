import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, Button, Surface, useTheme } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS } from '@/data/mock';
import type { Emotion } from '@/data/mock';

// Simulated result from Gemini emotion classification
const DEMO_EMOTION: Emotion = 'calm';

const DATE_LABEL = 'Thursday, May 16, 2026';

export default function WriteScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'analyzing' | 'done'>('idle');

  const handleAnalyze = () => {
    setState('analyzing');
    // simulate async Gemini call (202 + background task)
    setTimeout(() => setState('done'), 1500);
  };

  const handleSave = () => {
    setText('');
    setState('idle');
  };

  return (
    // SafeAreaView on top + sides; KeyboardAvoidingView handles the bottom
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ───────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 },
        ]}
      >
        <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
          New Entry
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
        >
          {/* ── Text input ────────────────────────────── */}
          <Surface style={[styles.inputCard, { borderRadius: theme.roundness * 2 }]} elevation={0}>
            <TextInput
              style={[styles.textInput, { color: theme.colors.onSurface }]}
              placeholder="How was your day? What's on your mind…"
              placeholderTextColor={theme.colors.outline}
              multiline
              value={text}
              onChangeText={t => { setText(t); if (state === 'done') setState('idle'); }}
              textAlignVertical="top"
            />
          </Surface>

          {/* ── Emotion result card ───────────────────── */}
          {state === 'done' && (
            <Surface
              style={[styles.resultCard, { borderRadius: theme.roundness * 2 }]}
              elevation={1}
            >
              <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 10 }}>
                Detected Emotion
              </Text>
              <View
                style={[
                  styles.emotionBadge,
                  { backgroundColor: EMOTION_COLORS[DEMO_EMOTION] },
                ]}
              >
                <Text style={styles.emoji}>{EMOTION_EMOJIS[DEMO_EMOTION]}</Text>
                <Text style={styles.emotionLabel}>{EMOTION_LABELS[DEMO_EMOTION]}</Text>
              </View>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline, marginTop: 10, lineHeight: 18 }}
              >
                Gemini analysed your diary and detected this emotion. Save to add it to your calendar.
              </Text>
            </Surface>
          )}

          {/* ── Hint when empty ───────────────────────── */}
          {state === 'idle' && !text && (
            <View style={styles.hint}>
              <Text style={[styles.hintText, { color: theme.colors.outline }]}>
                Write freely — there are no right answers. Your diary is private.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Action bar ───────────────────────────────── */}
        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: theme.colors.surfaceVariant,
              borderTopWidth: 1,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Button
            mode="outlined"
            onPress={handleAnalyze}
            loading={state === 'analyzing'}
            disabled={!text.trim() || state !== 'idle'}
            style={{ flex: 1 }}
          >
            Analyse
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={state !== 'done'}
            style={{ flex: 1 }}
          >
            Save
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 4,
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 8,
  },
  inputCard: {
    minHeight: 200,
    padding: 4,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    padding: 12,
    minHeight: 180,
  },
  resultCard: {
    padding: 16,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emoji: {
    fontSize: 18,
  },
  emotionLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    paddingHorizontal: 4,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
});
