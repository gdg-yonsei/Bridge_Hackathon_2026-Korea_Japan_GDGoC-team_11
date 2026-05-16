import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, ProgressBar, useTheme } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { HealingCard } from '@/components/common/HealingCard';
import { EmotionChip } from '@/components/common/EmotionChip';
import { tokens } from '@/theme/tokens';
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
  'This month you experienced mostly positive emotions — Joyful and Peaceful together made up over half of your recorded days. A few unsettled days appeared around deadlines, but you recovered quickly. Overall, a healthy emotional balance! Keep writing — consistency helps you spot patterns over time.';

export default function ReportScreen() {
  const theme = useTheme();
  const counts = countEmotions();
  const total = Object.keys(MOCK_ENTRIES).length;
  const sorted = (Object.entries(counts) as [Emotion, number][]).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0];

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>Monthly Insights</Text>
        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>May 2026</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Summary Stats ────────────────────────────── */}
        <View style={styles.statsRow}>
          <HealingCard variant="flat" style={styles.statCard}>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>ENTRIES</Text>
            <Text variant="displaySmall" style={{ fontWeight: '700', color: theme.colors.primary }}>{total}</Text>
          </HealingCard>
          
          <HealingCard variant="flat" style={styles.statCard}>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>STREAK</Text>
            <Text variant="displaySmall" style={{ fontWeight: '700', color: theme.colors.secondary }}>12</Text>
          </HealingCard>
        </View>

        {/* ── Dominant Mood ────────────────────────────── */}
        {dominant && (
          <HealingCard variant="floating" style={styles.dominantCard}>
            <Text variant="titleMedium" style={{ marginBottom: 12 }}>Dominant Presence</Text>
            <View style={styles.dominantContent}>
              <EmotionChip emotion={dominant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.outline, flex: 1 }}>
                This mood appeared in {counts[dominant]} of your entries this month.
              </Text>
            </View>
          </HealingCard>
        )}

        {/* ── Emotion Breakdown ─────────────────────────── */}
        <HealingCard style={styles.breakdownCard}>
          <Text variant="titleMedium" style={{ marginBottom: 20 }}>Growth Distribution</Text>
          {sorted.map(([emotion, count]) => (
            <View key={emotion} style={styles.emotionRow}>
              <View style={styles.emotionLabelRow}>
                <Text style={styles.emotionIcon}>{EMOTION_EMOJIS[emotion]}</Text>
                <Text variant="bodyMedium" style={styles.emotionName}>{EMOTION_LABELS[emotion]}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {Math.round((count / total) * 100)}%
                </Text>
              </View>
              <ProgressBar
                progress={count / total}
                color={EMOTION_COLORS[emotion]}
                style={styles.progressBar}
              />
            </View>
          ))}
        </HealingCard>

        {/* ── AI Insight ────────────────────────────────── */}
        <HealingCard variant="flat" style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <MaterialCommunityIcons name="sparkles" size={20} color={theme.colors.primary} />
            <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '700' }}>
              Healing Insight
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.insightText}>
            {AI_INSIGHT}
          </Text>
        </HealingCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: '700',
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  dominantCard: {
    padding: tokens.spacing.lg,
  },
  dominantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  breakdownCard: {
    padding: tokens.spacing.xl,
  },
  emotionRow: {
    marginBottom: 16,
    gap: 8,
  },
  emotionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emotionIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  emotionName: {
    flex: 1,
    fontWeight: '500',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F0F2EE',
  },
  insightCard: {
    backgroundColor: '#EBF2EA',
    padding: tokens.spacing.xl,
    borderWidth: 1,
    borderColor: '#D8E5D6',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightText: {
    lineHeight: 24,
    color: '#2D3B2C',
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
    paddingBottom: 32,
  },
  card: {
    padding: tokens.spacing.lg,
    marginVertical: 0,
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
    borderRadius: tokens.roundness.full,
  },
  badgeText: {
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
