import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Text, useTheme, Surface, Menu, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/Screen';
import { chatService, type Conversation } from '@/services/chatService';
import { diaryService, type CalendarEntry } from '@/services/diaryService';

const _now = new Date();
const TODAY = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const [menuVisible, setMenuVisible] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (params.date) {
      const d = new Date(params.date + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return TODAY;
  });

  const [diaryEntry, setDiaryEntry] = useState<CalendarEntry | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (date: Date) => {
    setLoading(true);
    setDiaryEntry(null);
    setConversations([]);
    try {
      const monthData = await diaryService.getMonth(date.getFullYear(), date.getMonth() + 1);
      const entry = monthData[toDateKey(date)] ?? null;
      setDiaryEntry(entry);
      if (entry) {
        const convs = await chatService.list(entry.entry_id);
        setConversations(convs);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedDate);
  }, [selectedDate, load]);

  const goDay = (delta: number) => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const handleNewChat = async () => {
    setCreating(true);
    try {
      const conv = await chatService.create(diaryEntry?.entry_id);
      setConversations(prev => [conv, ...prev]);
      router.push({ pathname: '/chat/[id]', params: { id: conv.id } });
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const isToday = toDateKey(selectedDate) === toDateKey(TODAY);

  return (
    <Screen
      background={<View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]} />}
      edges={['top', 'left', 'right']}
    >
      {/* ── Header ──────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="titleLarge" style={{ fontWeight: '700', color: '#fff' }}>Chat</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          }
        >
          <Menu.Item onPress={() => { setMenuVisible(false); router.replace('/'); }} title="Calendar" leadingIcon="calendar" />
          <Divider />
          <Menu.Item onPress={() => setMenuVisible(false)} title="Chat" leadingIcon="chat-outline" />
          <Divider />
          <Menu.Item onPress={() => { setMenuVisible(false); router.push('/report'); }} title="Report" leadingIcon="chart-bar" />
        </Menu>

        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* ── Date selector ───────────────────────────── */}
      <View style={[styles.datePicker, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 }]}>
        <Pressable onPress={() => goDay(-1)} hitSlop={12} style={styles.arrowBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={theme.colors.onSurface} />
        </Pressable>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: theme.colors.onSurface }}>
            {formatDateLabel(selectedDate)}
          </Text>
          {isToday && (
            <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600', marginTop: 1 }}>Today</Text>
          )}
        </View>

        <Pressable
          onPress={() => goDay(1)}
          hitSlop={12}
          style={styles.arrowBtn}
          disabled={selectedDate >= TODAY}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={26}
            color={selectedDate >= TODAY ? theme.colors.surfaceVariant : theme.colors.onSurface}
          />
        </Pressable>
      </View>

      {/* ── Content ─────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              {/* 새 채팅 button */}
              <Pressable
                style={({ pressed }) => [
                  styles.newChatBtn,
                  {
                    backgroundColor: diaryEntry ? theme.colors.primary : theme.colors.surfaceVariant,
                    opacity: pressed || creating ? 0.7 : 1,
                  },
                ]}
                onPress={handleNewChat}
                disabled={!diaryEntry || creating}
              >
                {creating
                  ? <ActivityIndicator size={18} color="#fff" />
                  : <MaterialCommunityIcons name="plus" size={20} color={diaryEntry ? '#fff' : theme.colors.outline} />}
                <Text style={{ color: diaryEntry ? '#fff' : theme.colors.outline, fontWeight: '700', fontSize: 15 }}>
                  New Chat
                </Text>
              </Pressable>

              {/* no diary notice */}
              {!diaryEntry && (
                <View style={[styles.noDiaryNotice, { backgroundColor: theme.colors.errorContainer }]}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.error} />
                  <Text style={{ color: theme.colors.error, fontSize: 13, flex: 1 }}>
                    Write a diary entry for this day to start a chat.
                  </Text>
                </View>
              )}

              {conversations.length > 0 && (
                <Text style={{ color: theme.colors.outline, fontSize: 12, marginTop: 8 }}>
                  {conversations.length}개의 대화
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <MaterialCommunityIcons name="chat-outline" size={48} color={theme.colors.surfaceVariant} />
              <Text style={{ color: theme.colors.outline, marginTop: 12, textAlign: 'center' }}>
                아직 대화가 없어요.{'\n'}새 채팅을 시작해보세요.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}>
              {({ pressed }) => (
                <Surface
                  style={[styles.convItem, { opacity: pressed ? 0.7 : 1 }]}
                  elevation={0}
                >
                  <View style={[styles.convIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={{ fontSize: 18 }}>✨</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: theme.colors.onSurface, fontSize: 14 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={{ color: theme.colors.outline, fontSize: 12, marginTop: 2 }}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.outline} />
                </Surface>
              )}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBg: { height: 80 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  arrowBtn: {
    padding: 6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  list: {
    padding: 16,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  noDiaryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  convIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
