import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, ProgressBar, useTheme } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { MOCK_ENTRIES, EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS } from '@/data/mock';
import type { Emotion } from '@/data/mock';

function countEmotions() {
  const counts: Partial<Record<Emotion, number>> = {};
  for (const { emotion } of Object.values(MOCK_ENTRIES)) {
    counts[emotion] = (counts[emotion] ?? 0) + 1;
  }
  return counts;
}

const AI_INSIGHT =
  'This month you experienced mostly positive emotions — Joy and Calm together made up over half of your recorded days. A few anxious days appeared around deadlines, but you recovered quickly. Overall, a healthy emotional balance! Keep writing — consistency helps you spot patterns over time.';

export default function ReportScreen() {
  const theme = useTheme();
  const counts = countEmotions();
  const total = Object.keys(MOCK_ENTRIES).length;
  const sorted = (Object.entries(counts) as [Emotion, number][]).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0];

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ───────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 },
        ]}
      >
        <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
          Monthly Report
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
          May 2026
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Summary ──────────────────────────────────── */}
        <Surface style={[styles.card, { borderRadius: theme.roundness * 2 }]} elevation={1}>
          <Text variant="labelLarge" style={{ color: theme.colors.outline }}>
            Entries this month
          </Text>
          <Text
            variant="displaySmall"
            style={{ color: theme.colors.primary, fontWeight: '700', marginVertical: 4 }}
          >
            {total}
          </Text>
          {dominant && (
            <View style={styles.dominantRow}>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Dominant mood{' '}
              </Text>
              <View
                style={[styles.badge, { backgroundColor: EMOTION_COLORS[dominant] }]}
              >
                <Text style={styles.badgeText}>
                  {EMOTION_EMOJIS[dominant]}  {EMOTION_LABELS[dominant]}
                </Text>
              </View>
            </View>
          )}
        </Surface>

        {/* ── Emotion breakdown ─────────────────────────── */}
        <Surface style={[styles.card, { borderRadius: theme.roundness * 2 }]} elevation={1}>
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: 16, color: theme.colors.onSurface }}
          >
            Emotion Breakdown
          </Text>

          {sorted.map(([emotion, count]) => (
            <View key={emotion} style={styles.emotionRow}>
              <View style={styles.emotionLabelRow}>
                <Text style={{ fontSize: 16 }}>{EMOTION_EMOJIS[emotion]}</Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurface, flex: 1, marginLeft: 8 }}
                >
                  {EMOTION_LABELS[emotion]}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {count} {count === 1 ? 'day' : 'days'}
                </Text>
              </View>
              <ProgressBar
                progress={count / total}
                color={EMOTION_COLORS[emotion]}
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              />
            </View>
          ))}
        </Surface>

        {/* ── AI Insight ────────────────────────────────── */}
        <Surface
          style={[
            styles.card,
            {
              borderRadius: theme.roundness * 2,
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          elevation={0}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.primary, marginBottom: 10, fontWeight: '700' }}
          >
            🤖  Gemini Insight
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onPrimaryContainer, lineHeight: 22 }}
          >
            {AI_INSIGHT}
          </Text>
        </Surface>
      </ScrollView>
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
    paddingBottom: 32,
  },
  card: {
    padding: 18,
  },
  dominantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  emotionRow: {
    gap: 6,
    marginBottom: 12,
  },
  emotionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
});
