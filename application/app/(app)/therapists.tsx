import { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, Pressable, ActivityIndicator, ScrollView,
} from 'react-native';
import {
  Text, useTheme, Menu, Divider, Surface, Chip, Button, Modal, Portal,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { therapistService } from '@/services/therapistService';
import type { Therapist, TherapistFilter } from '@/types/therapist';

// ── Filter bar ───────────────────────────────────────────────────────────────

type Country = 'Korea' | 'Japan' | undefined;

function StarRating({ rating }: { rating: number }) {
  const theme = useTheme();
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <MaterialCommunityIcons
          key={i}
          name={i < full ? 'star' : i === full && half ? 'star-half-full' : 'star-outline'}
          size={14}
          color="#F59E0B"
        />
      ))}
      <Text variant="labelSmall" style={{ color: theme.colors.outline, marginLeft: 2 }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

// ── Therapist card ────────────────────────────────────────────────────────────

function TherapistCard({ item, onPress }: { item: Therapist; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>{item.name}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
              {item.location} · {item.years_experience} yrs exp
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.outline} />
        </View>

        {/* Rating */}
        <StarRating rating={item.rating} />

        {/* Availability badges */}
        <View style={styles.badgeRow}>
          {item.online_available && (
            <View style={[styles.badge, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="laptop" size={12} color="#7C3AED" />
              <Text style={[styles.badgeText, { color: '#7C3AED' }]}>Online</Text>
            </View>
          )}
          {item.in_person_available && (
            <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={12} color="#065F46" />
              <Text style={[styles.badgeText, { color: '#065F46' }]}>In-person</Text>
            </View>
          )}
        </View>

        {/* Languages */}
        <View style={styles.chipRow}>
          {item.languages.slice(0, 3).map(lang => (
            <View key={lang} style={[styles.tag, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.tagText, { color: theme.colors.onSurfaceVariant }]}>{lang}</Text>
            </View>
          ))}
        </View>

        {/* Specialties */}
        <View style={styles.chipRow}>
          {item.specializes_in.slice(0, 3).map(s => (
            <View key={s} style={[styles.tag, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[styles.tagText, { color: theme.colors.onPrimaryContainer }]}>{s}</Text>
            </View>
          ))}
          {item.specializes_in.length > 3 && (
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              +{item.specializes_in.length - 3}
            </Text>
          )}
        </View>

        {/* Bio preview */}
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, lineHeight: 18 }}
          numberOfLines={2}
        >
          {item.bio}
        </Text>

        {/* Price */}
        <Text variant="labelMedium" style={{ color: theme.colors.primary, marginTop: 8, fontWeight: '700' }}>
          {item.price_per_session}
        </Text>
      </Surface>
    </Pressable>
  );
}

// ── Skeleton placeholder ──────────────────────────────────────────────────────

function SkeletonCard() {
  const theme = useTheme();
  const bg = theme.colors.surfaceVariant;
  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={[styles.skeletonLine, { width: '60%', backgroundColor: bg }]} />
      <View style={[styles.skeletonLine, { width: '40%', backgroundColor: bg, marginTop: 6 }]} />
      <View style={[styles.skeletonLine, { width: '80%', backgroundColor: bg, marginTop: 12 }]} />
      <View style={[styles.skeletonLine, { width: '90%', backgroundColor: bg, marginTop: 6 }]} />
    </Surface>
  );
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────

type FilterSheetProps = {
  visible: boolean;
  initial: TherapistFilter;
  onApply: (f: TherapistFilter) => void;
  onDismiss: () => void;
};

function FilterSheet({ visible, initial, onApply, onDismiss }: FilterSheetProps) {
  const theme = useTheme();
  const [language, setLanguage] = useState(initial.language ?? '');
  const [concern, setConcern] = useState(initial.concern ?? '');
  const [emotion, setEmotion] = useState(initial.emotion ?? '');
  const [minRating, setMinRating] = useState<number | undefined>(initial.min_rating);

  const ratingOptions = [0, 3, 4, 4.5];

  useEffect(() => {
    setLanguage(initial.language ?? '');
    setConcern(initial.concern ?? '');
    setEmotion(initial.emotion ?? '');
    setMinRating(initial.min_rating);
  }, [visible]);

  const handleApply = () => {
    onApply({
      language:   language.trim()   || undefined,
      concern:    concern.trim()    || undefined,
      emotion:    emotion.trim()    || undefined,
      min_rating: minRating,
    });
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.sheetHandle} />
        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 20 }}>Filters</Text>

        {/* Min Rating */}
        <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 8 }}>Min Rating</Text>
        <View style={styles.chipRow}>
          {ratingOptions.map(r => (
            <Chip
              key={r}
              selected={minRating === r}
              onPress={() => setMinRating(minRating === r ? undefined : r)}
              style={{ marginRight: 8 }}
              compact
            >
              {r === 0 ? 'Any' : `★ ${r}+`}
            </Chip>
          ))}
        </View>

        {/* Language */}
        <Text variant="labelMedium" style={{ color: theme.colors.outline, marginTop: 20, marginBottom: 8 }}>Language</Text>
        <View style={styles.chipRow}>
          {['korean', 'japanese', 'english'].map(lang => (
            <Chip
              key={lang}
              selected={language === lang}
              onPress={() => setLanguage(language === lang ? '' : lang)}
              style={{ marginRight: 8, marginBottom: 4 }}
              compact
            >
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </Chip>
          ))}
        </View>

        {/* Concern */}
        <Text variant="labelMedium" style={{ color: theme.colors.outline, marginTop: 20, marginBottom: 8 }}>Concern</Text>
        <View style={styles.chipRow}>
          {['anxiety', 'depression', 'trauma', 'stress', 'relationship'].map(c => (
            <Chip
              key={c}
              selected={concern === c}
              onPress={() => setConcern(concern === c ? '' : c)}
              style={{ marginRight: 8, marginBottom: 4 }}
              compact
            >
              {c}
            </Chip>
          ))}
        </View>

        {/* Emotion */}
        <Text variant="labelMedium" style={{ color: theme.colors.outline, marginTop: 20, marginBottom: 8 }}>Emotion</Text>
        <View style={styles.chipRow}>
          {['sad', 'anxiety', 'anger', 'boredom', 'nostalgia'].map(e => (
            <Chip
              key={e}
              selected={emotion === e}
              onPress={() => setEmotion(emotion === e ? '' : e)}
              style={{ marginRight: 8, marginBottom: 4 }}
              compact
            >
              {e}
            </Chip>
          ))}
        </View>

        <View style={styles.sheetActions}>
          <Button mode="outlined" onPress={() => { setLanguage(''); setConcern(''); setEmotion(''); setMinRating(undefined); }} style={{ flex: 1 }}>
            Reset
          </Button>
          <Button mode="contained" onPress={handleApply} style={{ flex: 1 }}>
            Apply
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TherapistsScreen() {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const [country, setCountry] = useState<Country>(undefined);
  const [online, setOnline] = useState<boolean | undefined>(undefined);
  const [inPerson, setInPerson] = useState<boolean | undefined>(undefined);
  const [detailFilter, setDetailFilter] = useState<TherapistFilter>({});

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const activeDetailCount = [
    detailFilter.language, detailFilter.concern,
    detailFilter.emotion, detailFilter.min_rating,
  ].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const filter: TherapistFilter = {
        ...detailFilter,
        country,
        online,
        in_person: inPerson,
      };
      const data = await therapistService.list(filter);
      setTherapists(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [country, online, inPerson, detailFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApplyDetail = (f: TherapistFilter) => {
    setDetailFilter(f);
    setSheetVisible(false);
  };

  return (
    <Screen
      background={<View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]} />}
      edges={['top', 'left', 'right']}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary, justifyContent: 'space-between' }]}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="titleLarge" style={{ fontWeight: '700', color: '#fff' }}>Therapists</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          }
        >
          <Menu.Item onPress={() => { setMenuVisible(false); router.replace('/'); }} title="Calendar" leadingIcon="calendar" />
          <Divider />
          <Menu.Item onPress={() => { setMenuVisible(false); router.push('/chat'); }} title="Chat" leadingIcon="chat-outline" />
          <Divider />
          <Menu.Item onPress={() => { setMenuVisible(false); router.push('/report'); }} title="Report" leadingIcon="chart-bar" />
          <Divider />
          <Menu.Item onPress={() => setMenuVisible(false)} title="Therapists" leadingIcon="account-heart-outline" />
        </Menu>

        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* ── Quick filter bar ───────────────────────────── */}
      <View style={[styles.filterBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Country */}
          {(['Korea', 'Japan'] as const).map(c => (
            <Chip
              key={c}
              selected={country === c}
              onPress={() => setCountry(country === c ? undefined : c)}
              style={styles.filterChip}
              compact
            >
              {c === 'Korea' ? '🇰🇷 Korea' : '🇯🇵 Japan'}
            </Chip>
          ))}

          <View style={[styles.filterDivider, { backgroundColor: theme.colors.outlineVariant }]} />

          {/* Online / In-person */}
          <Chip
            selected={online === true}
            onPress={() => setOnline(online === true ? undefined : true)}
            style={styles.filterChip}
            compact
            icon="laptop"
          >
            Online
          </Chip>
          <Chip
            selected={inPerson === true}
            onPress={() => setInPerson(inPerson === true ? undefined : true)}
            style={styles.filterChip}
            compact
            icon="map-marker-outline"
          >
            In-person
          </Chip>

          <View style={[styles.filterDivider, { backgroundColor: theme.colors.outlineVariant }]} />

          {/* Detail filter */}
          <Chip
            selected={activeDetailCount > 0}
            onPress={() => setSheetVisible(true)}
            style={styles.filterChip}
            compact
            icon="tune-variant"
          >
            Filters{activeDetailCount > 0 ? ` (${activeDetailCount})` : ''}
          </Chip>
        </ScrollView>
      </View>

      {/* ── List ───────────────────────────────────────── */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.list}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={{ color: theme.colors.error, marginTop: 12 }}>Failed to load therapists</Text>
          <Button mode="tonal" onPress={load} style={{ marginTop: 16 }}>Retry</Button>
        </View>
      ) : therapists.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-search-outline" size={56} color={theme.colors.outlineVariant} />
          <Text variant="titleMedium" style={{ color: theme.colors.outline, marginTop: 16, fontWeight: '700' }}>
            No therapists found
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outlineVariant, marginTop: 8 }}>
            Try adjusting your filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={therapists}
          keyExtractor={item => item.therapist_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TherapistCard
              item={item}
              onPress={() => router.push({ pathname: '/therapists/[id]', params: { id: item.therapist_id } })}
            />
          )}
        />
      )}

      {/* ── Filter bottom sheet ─────────────────────────── */}
      <FilterSheet
        visible={sheetVisible}
        initial={detailFilter}
        onApply={handleApplyDetail}
        onDismiss={() => setSheetVisible(false)}
      />
    </Screen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerBg: { height: 80 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  filterBar: {
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexShrink: 0,
  },
  filterDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  skeletonLine: {
    height: 14,
    borderRadius: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  sheet: {
    margin: 16,
    borderRadius: 24,
    padding: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
});
