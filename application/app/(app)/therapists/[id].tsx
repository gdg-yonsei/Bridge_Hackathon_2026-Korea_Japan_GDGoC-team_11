import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Text, useTheme, Surface, Divider, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { therapistService } from '@/services/therapistService';
import type { Therapist } from '@/types/therapist';

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <MaterialCommunityIcons
          key={i}
          name={i < full ? 'star' : i === full && half ? 'star-half-full' : 'star-outline'}
          size={18}
          color="#F59E0B"
        />
      ))}
      <Text variant="bodyMedium" style={{ marginLeft: 4, fontWeight: '700' }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="labelLarge" style={{ color: theme.colors.outline, letterSpacing: 1, marginBottom: 10 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function TagList({ items, color, bg }: { items: string[]; color: string; bg: string }) {
  return (
    <View style={styles.tagRow}>
      {items.map(item => (
        <View key={item} style={[styles.tag, { backgroundColor: bg }]}>
          <Text style={[styles.tagText, { color }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TherapistDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Fetch all and find by id — single GET /therapist endpoint only
        const all = await therapistService.list();
        const found = all.find(t => t.therapist_id === id) ?? null;
        setTherapist(found);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* ── Top bar ──────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.colors.primary,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text variant="titleMedium" style={{ color: '#fff', fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {therapist?.name ?? 'Therapist'}
        </Text>
      </View>

      {/* ── Content ──────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error || !therapist ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={{ color: theme.colors.error, marginTop: 12 }}>
            {error ? 'Failed to load therapist.' : 'Therapist not found.'}
          </Text>
          <Button mode="tonal" onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero card ─────────────────────────────── */}
          <Surface style={[styles.hero, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.heroAvatar}>
              <MaterialCommunityIcons name="account-circle" size={72} color={theme.colors.primary} />
            </View>
            <Text variant="headlineSmall" style={{ fontWeight: '800', textAlign: 'center' }}>
              {therapist.name}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 4 }}>
              {therapist.location} · {therapist.years_experience} years experience
            </Text>
            <View style={{ marginTop: 10 }}>
              <StarRating rating={therapist.rating} />
            </View>

            {/* Availability */}
            <View style={styles.badgeRow}>
              {therapist.online_available && (
                <View style={[styles.badge, { backgroundColor: '#EDE9FE' }]}>
                  <MaterialCommunityIcons name="laptop" size={14} color="#7C3AED" />
                  <Text style={[styles.badgeText, { color: '#7C3AED' }]}>Online</Text>
                </View>
              )}
              {therapist.in_person_available && (
                <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color="#065F46" />
                  <Text style={[styles.badgeText, { color: '#065F46' }]}>In-person</Text>
                </View>
              )}
            </View>

            {/* Price */}
            <View style={[styles.priceBadge, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '800' }}>
                {therapist.price_per_session}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.7 }}>
                per session
              </Text>
            </View>
          </Surface>

          {/* ── Bio ───────────────────────────────────── */}
          <Divider style={styles.sectionDivider} />
          <Section title="About">
            <Text variant="bodyMedium" style={{ lineHeight: 24, color: theme.colors.onSurfaceVariant }}>
              {therapist.bio}
            </Text>
          </Section>

          {/* ── Education & Certifications ────────────── */}
          <Divider style={styles.sectionDivider} />
          <Section title="Education">
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{therapist.education}</Text>
          </Section>

          {therapist.certifications.length > 0 && (
            <>
              <Divider style={styles.sectionDivider} />
              <Section title="Certifications">
                {therapist.certifications.map(cert => (
                  <View key={cert} style={styles.bulletRow}>
                    <MaterialCommunityIcons name="check-circle-outline" size={16} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurface }}>{cert}</Text>
                  </View>
                ))}
              </Section>
            </>
          )}

          {/* ── Approach ──────────────────────────────── */}
          {therapist.approach.length > 0 && (
            <>
              <Divider style={styles.sectionDivider} />
              <Section title="Therapeutic Approach">
                <TagList
                  items={therapist.approach}
                  color={theme.colors.onSecondaryContainer}
                  bg={theme.colors.secondaryContainer}
                />
              </Section>
            </>
          )}

          {/* ── Specialties ───────────────────────────── */}
          {therapist.specializes_in.length > 0 && (
            <>
              <Divider style={styles.sectionDivider} />
              <Section title="Specializes In">
                <TagList
                  items={therapist.specializes_in}
                  color={theme.colors.onPrimaryContainer}
                  bg={theme.colors.primaryContainer}
                />
              </Section>
            </>
          )}

          {/* ── Emotions ──────────────────────────────── */}
          {therapist.emotions_treated.length > 0 && (
            <>
              <Divider style={styles.sectionDivider} />
              <Section title="Emotions Treated">
                <TagList
                  items={therapist.emotions_treated}
                  color={theme.colors.onTertiaryContainer}
                  bg={theme.colors.tertiaryContainer}
                />
              </Section>
            </>
          )}

          {/* ── Languages ─────────────────────────────── */}
          <Divider style={styles.sectionDivider} />
          <Section title="Languages">
            <TagList
              items={therapist.languages}
              color={theme.colors.onSurfaceVariant}
              bg={theme.colors.surfaceVariant}
            />
          </Section>

          {/* ── CTA ───────────────────────────────────── */}
          <Divider style={styles.sectionDivider} />
          <Button
            mode="contained"
            icon="calendar-check-outline"
            contentStyle={{ height: 52 }}
            style={styles.ctaBtn}
            onPress={() => {}}
          >
            Book a Session
          </Button>
          <Text variant="labelSmall" style={{ textAlign: 'center', color: theme.colors.outline, marginTop: 8 }}>
            Booking integration coming soon
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  scroll: {
    padding: 20,
  },
  hero: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  heroAvatar: {
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceBadge: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  sectionDivider: {
    marginVertical: 20,
  },
  section: {
    gap: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  ctaBtn: {
    borderRadius: 16,
  },
});
