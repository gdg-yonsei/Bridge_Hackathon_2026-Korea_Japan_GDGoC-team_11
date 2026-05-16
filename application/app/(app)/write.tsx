import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { HealingCard } from '@/components/common/HealingCard';
import { HealingButton } from '@/components/common/HealingButton';
import { EmotionChip } from '@/components/common/EmotionChip';
import { tokens } from '@/theme/tokens';

// Simulated result from Gemini emotion classification
const DEMO_EMOTION = 'calm' as const;
const DATE_LABEL = 'Thursday, May 16';

export default function WriteScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'analyzing' | 'done'>('idle');

  const handleAnalyze = () => {
    setState('analyzing');
    setTimeout(() => setState('done'), 1500);
  };

  const handleSave = () => {
    router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <View style={styles.headerTitleContainer}>
          <Text variant="titleMedium" style={styles.headerTitle}>New Reflection</Text>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>{DATE_LABEL}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <HealingCard variant="flat" style={styles.editorCard}>
            <TextInput
              style={[styles.textInput, { color: theme.colors.onSurface }]}
              placeholder="How is your inner garden today? Describe your thoughts and feelings..."
              placeholderTextColor={theme.colors.outlineVariant}
              multiline
              autoFocus
              value={text}
              onChangeText={t => { setText(t); if (state === 'done') setState('idle'); }}
              textAlignVertical="top"
            />
          </HealingCard>

          {state === 'done' && (
            <HealingCard variant="floating" style={styles.resultCard}>
              <Text variant="labelLarge" style={styles.resultLabel}>Emotional Essence</Text>
              <View style={styles.resultContent}>
                <EmotionChip emotion={DEMO_EMOTION} />
                <Text variant="bodyMedium" style={styles.resultText}>
                  Gemini sensed a deep feeling of <Text style={{ fontWeight: '700' }}>Peaceful</Text> in your words.
                </Text>
              </View>
            </HealingCard>
          )}

          {state === 'idle' && (
            <View style={styles.footerHint}>
              <Text variant="bodySmall" style={styles.hintText}>
                Your thoughts are safe and private. Only you can see this garden.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actionArea}>
          {state !== 'done' ? (
            <HealingButton
              variant="tonal"
              onPress={handleAnalyze}
              loading={state === 'analyzing'}
              disabled={!text.trim() || state === 'analyzing'}
              style={{ flex: 1 }}
            >
              Analyze Emotion
            </HealingButton>
          ) : (
            <HealingButton
              onPress={handleSave}
              style={{ flex: 1 }}
            >
              Plant this Reflection
            </HealingButton>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  editorCard: {
    minHeight: 320,
    padding: tokens.spacing.md,
    backgroundColor: '#F7F8F5',
    borderWidth: 1,
    borderColor: '#E8EAE6',
  },
  textInput: {
    fontSize: 18,
    lineHeight: 28,
    padding: tokens.spacing.md,
    minHeight: 280,
  },
  resultCard: {
    marginTop: 24,
    padding: tokens.spacing.xl,
    backgroundColor: '#fff',
  },
  resultLabel: {
    color: tokens.opacity.muted.toString(),
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultContent: {
    gap: 16,
  },
  resultText: {
    lineHeight: 22,
    color: '#444842',
  },
  footerHint: {
    marginTop: 40,
    alignItems: 'center',
  },
  hintText: {
    color: tokens.opacity.muted.toString(),
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 18,
  },
  actionArea: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    flexDirection: 'row',
    backgroundColor: '#fff',
    ...tokens.shadows.medium,
  },
});

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
    borderRadius: tokens.roundness.full,
  },
  emoji: {
    fontSize: 18,
  },
  emotionLabel: {
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
