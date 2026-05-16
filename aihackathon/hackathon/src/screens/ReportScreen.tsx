import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { JournalEntry, MoodKey, RootStackParamList } from '../types';
import { MOODS, COLORS, WEEKLY_THEMES, MONTHLY_THEMES } from '../constants/moods';

type Nav = StackNavigationProp<RootStackParamList, 'Report'>;
type Route = RouteProp<RootStackParamList, 'Report'>;
type Tab = 'daily' | 'weekly' | 'monthly';

const WEEKLY_DIST: Record<MoodKey, number> = {
  great: 40, okay: 25, neutral: 15, sad: 14, bad: 6,
};
const MONTHLY_DIST: Record<MoodKey, number> = {
  great: 33, okay: 28, neutral: 20, sad: 12, bad: 7,
};

export default function ReportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const entry: JournalEntry = route.params.entry;
  const [tab, setTab] = useState<Tab>('daily');

  const mood = MOODS[entry.mood];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Your Reports</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved banner */}
        <View style={styles.savedBanner}>
          <Text style={{ fontSize: 26 }}>{mood.face}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.savedTxt}>
              Entry saved!{' '}
              <Text style={{ fontWeight: '700' }}>
                Feeling {mood.label.toLowerCase()}
              </Text>{' '}
              today.
            </Text>
            <Text style={styles.savedSub}>Your therapist has been notified.</Text>
          </View>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          {(['daily', 'weekly', 'monthly'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── DAILY ── */}
        {tab === 'daily' && (
          <View style={styles.panel}>
            <View style={styles.statRow}>
              <StatCard label="Mood Today" value={mood.face} sub={mood.label} />
              <StatCard
                label="Words Written"
                value={entry.wordCount > 0 ? String(entry.wordCount) : '—'}
                sub="words"
              />
            </View>
            <InsightCard tag="AI CBT INSIGHT" text={entry.aiInsight ?? mood.insight} />
            {entry.aiDistortions && entry.aiDistortions.length > 0 && (
              <TagsCard label="PATTERNS DETECTED" tags={entry.aiDistortions} />
            )}
            <CBTCard
              tag="TODAY'S EXERCISE"
              title={mood.exercise.title}
              text={mood.exercise.description}
            />
          </View>
        )}

        {/* ── WEEKLY ── */}
        {tab === 'weekly' && (
          <View style={styles.panel}>
            <View style={styles.statRow}>
              <StatCard label="Entries" value="5 / 7" sub="days this week" />
              <StatCard label="Avg. Mood" value="🙂" sub="Okay · trending up" />
            </View>
            <MoodBars distribution={WEEKLY_DIST} />
            <ThemeList title="RECURRING THEMES" items={WEEKLY_THEMES} />
            <InsightCard
              tag="THERAPIST NOTE"
              text="Academic stress appeared 3 times this week. Your next session will focus on cognitive restructuring around exam anxiety."
            />
          </View>
        )}

        {/* ── MONTHLY ── */}
        {tab === 'monthly' && (
          <View style={styles.panel}>
            <View style={styles.statRow}>
              <StatCard label="Total Entries" value="18" sub="of 30 days" />
              <StatCard label="Best Streak" value="9" sub="days in a row" />
            </View>
            <MoodBars distribution={MONTHLY_DIST} />
            <ThemeList title="TOP PATTERNS" items={MONTHLY_THEMES} />
            <CBTCard
              tag="MONTHLY CBT SUMMARY"
              title="Progress noted"
              text="Positive moods up 12% vs last month. Catastrophizing patterns are decreasing — your cognitive restructuring work is showing results."
            />
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={() => navigation.goBack()}>
          <Text style={styles.ctaTxt}>🏠  Back to home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={sc.card}>
      <Text style={sc.label}>{label}</Text>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.sub}>{sub}</Text>
    </View>
  );
}

function InsightCard({ tag, text }: { tag: string; text: string }) {
  return (
    <View style={ic.card}>
      <Text style={ic.tag}>{tag}</Text>
      <Text style={ic.text}>{text}</Text>
    </View>
  );
}

function TagsCard({ label, tags }: { label: string; tags: string[] }) {
  return (
    <View style={ic.card}>
      <Text style={ic.tag}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {tags.map((t) => (
          <View key={t} style={tc.pill}>
            <Text style={tc.txt}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CBTCard({ tag, title, text }: { tag: string; title: string; text: string }) {
  return (
    <View style={cc.card}>
      <Text style={cc.tag}>{tag}</Text>
      <Text style={cc.title}>{title}</Text>
      <Text style={cc.text}>{text}</Text>
    </View>
  );
}

function MoodBars({ distribution }: { distribution: Record<MoodKey, number> }) {
  const order: MoodKey[] = ['great', 'okay', 'neutral', 'sad', 'bad'];
  return (
    <View style={mb.card}>
      <Text style={mb.label}>MOOD DISTRIBUTION</Text>
      {order.map((key) => (
        <View key={key} style={mb.row}>
          <Text style={{ fontSize: 16, width: 24 }}>{MOODS[key].face}</Text>
          <View style={mb.track}>
            <View style={[mb.fill, { width: `${distribution[key]}%` as any }]} />
          </View>
          <Text style={mb.pct}>{distribution[key]}%</Text>
        </View>
      ))}
    </View>
  );
}

function ThemeList({
  title,
  items,
}: {
  title: string;
  items: { name: string; count: number; color: string }[];
}) {
  return (
    <View style={tl.card}>
      <Text style={tl.label}>{title}</Text>
      {items.map((item) => (
        <View key={item.name} style={tl.row}>
          <View style={[tl.dot, { backgroundColor: item.color }]} />
          <Text style={tl.name}>{item.name}</Text>
          <Text style={tl.count}>{item.count}×</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: '#d0c8b0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: '#5a7a6a' },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { paddingBottom: 36 },

  savedBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#d8f0e8',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedTxt: { fontSize: 13, color: '#1a5a38', lineHeight: 20 },
  savedSub: { fontSize: 11, color: '#3a8a60', marginTop: 2 },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 14,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.green },
  tabTxt: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  tabTxtActive: { color: '#fff' },

  panel: { paddingHorizontal: 16, gap: 12 },
  statRow: { flexDirection: 'row', gap: 10 },

  cta: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.green,
    alignItems: 'center',
  },
  ctaTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const sc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8aaa9a',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  value: { fontSize: 24, fontWeight: '700', color: '#1a4a38' },
  sub: { fontSize: 10, color: '#9aaa9a', marginTop: 2 },
});

const ic = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.green,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  text: { fontSize: 13, color: '#3a4a3e', lineHeight: 20 },
});

const tc = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#fff0e0',
    borderWidth: 0.5,
    borderColor: '#fac775',
  },
  txt: { fontSize: 11, color: '#854f0b' },
});

const cc = StyleSheet.create({
  card: {
    backgroundColor: '#e8f5ee',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#b8dfc8',
    padding: 14,
  },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1a6a48',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#1a4a38', marginBottom: 4 },
  text: { fontSize: 12, color: '#3a6a4e', lineHeight: 19 },
});

const mb = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8aaa9a',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: '#eef6f2',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: COLORS.green, borderRadius: 4 },
  pct: { fontSize: 11, color: '#5a8a7a', minWidth: 32, textAlign: 'right' },
});

const tl = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8aaa9a',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1, fontSize: 13, color: '#3a4a3e' },
  count: { fontSize: 11, color: '#8aaa9a' },
});
