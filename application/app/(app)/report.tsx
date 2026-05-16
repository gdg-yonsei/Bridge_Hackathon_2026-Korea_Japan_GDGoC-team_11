import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Dimensions } from 'react-native';
import { Text, useTheme, Button, Surface, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '@/components/Screen';
import { AppHeader, AppHeaderBg } from '@/components/AppHeader';
import { useCreateReportMutation } from '@/store/api/reportApi';
import { setCachedReport, clearCachedReport } from '@/store/slices/reportSlice';
import { RootState } from '@/store';
import { EMOTION_COLORS, EMOTION_LABELS, EMOTION_EMOJIS, type Emotion } from '@/data/mock';

const EMOTION_IMAGES: Record<string, any> = {
  joy:     require('../../assets/emotions/happniess.png'),
  calm:    require('../../assets/emotions/calm.png'),
  comfort: require('../../assets/emotions/comfort.png'),
  sad:     require('../../assets/emotions/sad.png'),
  anxious: require('../../assets/emotions/anxiety.png'),
  angry:   require('../../assets/emotions/anger.png'),
};

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function ReportScreen() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { cachedReport, savedAt } = useSelector((state: RootState) => state.report);
  const [report, setReport] = useState(cachedReport);

  useEffect(() => {
    if (savedAt) {
      const isExpired = Date.now() - new Date(savedAt).getTime() > TTL_MS;
      if (isExpired) {
        dispatch(clearCachedReport());
        setReport(null);
      } else {
        setReport(cachedReport);
      }
    }
  }, [cachedReport, savedAt, dispatch]);

  // For now, using simple state. 
  const [periodStart, setPeriodStart] = useState('2026-05-10');
  const [periodEnd, setPeriodEnd] = useState('2026-05-17');

  const setPreset = (days: number) => {
    const end = new Date('2026-05-17'); // Using fixed "today" for hackathon consistency
    const start = new Date(end);
    start.setDate(end.getDate() - days);
    
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setPeriodStart(fmt(start));
    setPeriodEnd(fmt(end));
  };

  const [createReport, { isLoading, error }] = useCreateReportMutation();

  const handleGenerate = async () => {
    try {
      const result = await createReport({
        period_start: periodStart,
        period_end: periodEnd,
      }).unwrap();
      
      dispatch(setCachedReport(result));
      setReport(result);
    } catch (err) {
      console.error('Failed to generate report:', err);
    }
  };

  return (
    <Screen
      background={<AppHeaderBg />}
      edges={['top', 'left', 'right']}
    >
      <AppHeader currentRoute="report" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Period Selection ───────────────────────────── */}
        <View style={styles.periodSection}>
          <Text variant="titleMedium" style={{ marginBottom: 16, fontWeight: '700' }}>Select Period</Text>
          
          <View style={styles.presetRow}>
            <Button compact mode="tonal" onPress={() => setPreset(7)} style={styles.presetBtn}>Last 7 Days</Button>
            <Button compact mode="tonal" onPress={() => setPreset(30)} style={styles.presetBtn}>Last 30 Days</Button>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>From</Text>
              <Text variant="bodyLarge" style={{ fontWeight: '600' }}>{periodStart}</Text>
            </View>
            <View style={[styles.dateDivider, { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={styles.dateField}>
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>To</Text>
              <Text variant="bodyLarge" style={{ fontWeight: '600' }}>{periodEnd}</Text>
            </View>
          </View>
          
          <Button 
            mode="contained" 
            onPress={handleGenerate} 
            loading={isLoading}
            disabled={isLoading}
            style={styles.generateBtn}
            contentStyle={{ height: 48 }}
          >
            Generate Report
          </Button>
        </View>

        <Divider style={{ marginVertical: 8, backgroundColor: 'transparent' }} />

        {/* ── Loading State ──────────────────────────────── */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 12, color: theme.colors.outline }}>Gemini is analyzing your diaries...</Text>
          </View>
        )}

        {/* ── Error State ────────────────────────────────── */}
        {error && (
          <View style={[styles.errorContainer, { borderRadius: theme.roundness * 2 }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={24} color={theme.colors.error} />
            <Text style={{ color: theme.colors.error, marginLeft: 8 }}>Failed to generate report. Please try again.</Text>
          </View>
        )}

        {/* ── Report Content ─────────────────────────────── */}
        {report && !isLoading && (
          <View style={{ gap: 32, marginTop: 16 }}>
            {/* Dominant Emotion */}
            <View style={styles.emotionSection}>
              <Text variant="labelLarge" style={{ color: theme.colors.outline, textAlign: 'center', marginBottom: 12, letterSpacing: 1.2 }}>
                DOMINANT EMOTION
              </Text>
              <View style={styles.emotionContainer}>
                {EMOTION_IMAGES[report.dominant_emotion] && (
                  <Image 
                    source={EMOTION_IMAGES[report.dominant_emotion]} 
                    style={styles.emotionImage} 
                    resizeMode="contain" 
                  />
                )}
                <Text variant="displaySmall" style={{ fontWeight: '900', color: EMOTION_COLORS[report.dominant_emotion as Emotion] || theme.colors.primary }}>
                  {(EMOTION_LABELS[report.dominant_emotion as Emotion] || report.dominant_emotion).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Summary */}
            <View>
              <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: 12 }}>Summary</Text>
              <Text variant="bodyLarge" style={{ lineHeight: 26, color: theme.colors.onSurfaceVariant }}>
                {report.summary}
              </Text>
            </View>

            {/* Stats */}
            {Object.keys(report.stats).length > 0 && (
              <View>
                <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: 20 }}>Emotion Analysis</Text>
                {Object.entries(report.stats).map(([emotion, stat]) => (
                  <View key={emotion} style={styles.statRow}>
                    <View style={styles.statInfo}>
                      <Text style={{ fontSize: 24 }}>{EMOTION_EMOJIS[emotion as Emotion] || '•'}</Text>
                      <View>
                        <Text variant="bodyLarge" style={{ fontWeight: '700' }}>{EMOTION_LABELS[emotion as Emotion] || emotion}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{stat.days} days recorded</Text>
                      </View>
                    </View>
                    <View style={styles.statProgressWrapper}>
                      <View style={[styles.statProgressBar, { 
                        width: `${(stat.avg / 5) * 100}%`, 
                        backgroundColor: EMOTION_COLORS[emotion as Emotion] || theme.colors.primary 
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 24, paddingBottom: 24, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant, paddingTop: 24 }}>
              <Text variant="labelSmall" style={{ textAlign: 'center', color: theme.colors.outline }}>
                Powered by {report.model_name}
              </Text>
              <Text variant="labelSmall" style={{ textAlign: 'center', color: theme.colors.outline, marginTop: 4 }}>
                Generated on {new Date(report.generated_at).toLocaleDateString()} at {new Date(report.generated_at).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  periodSection: {
    marginBottom: 16,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  presetBtn: {
    flex: 1,
    borderRadius: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  dateField: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  dateDivider: {
    width: 24,
    height: 1,
    marginHorizontal: 16,
  },
  generateBtn: {
    borderRadius: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 48,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFEBEE',
  },
  emotionSection: {
    alignItems: 'center',
  },
  emotionContainer: {
    alignItems: 'center',
    gap: 16,
  },
  emotionImage: {
    width: 140,
    height: 140,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  statInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statProgressWrapper: {
    width: 100,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
});
