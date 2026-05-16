import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { chatService, type Message } from '@/services/chatService';

// ── Typing indicator ──────────────────────────────────────────────
function TypingDots() {
  const theme = useTheme();
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(560 - delay),
        ])
      );

    const a0 = makeAnim(dot0, 0);
    const a1 = makeAnim(dot1, 140);
    const a2 = makeAnim(dot2, 280);
    a0.start(); a1.start(); a2.start();
    return () => { a0.stop(); a1.stop(); a2.stop(); };
  }, [dot0, dot1, dot2]);

  return (
    <View style={[styles.bubbleRow, { marginBottom: 8 }]}>
      <View style={[styles.botAvatar, { backgroundColor: theme.colors.primaryContainer }]}>
        <Text style={{ fontSize: 14 }}>✨</Text>
      </View>
      <View style={[styles.typingBubble, { backgroundColor: theme.colors.surfaceVariant }]}>
        {[dot0, dot1, dot2].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: theme.colors.outline, transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────
const SUGGESTIONS = [
  "How are you feeling today?",
  "I'd like to reflect on something.",
  "I've been feeling anxious lately.",
  "Can you help me understand my emotions?",
];

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyAvatar, { backgroundColor: theme.colors.primaryContainer }]}>
        <Text style={{ fontSize: 38 }}>✨</Text>
      </View>
      <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface, marginTop: 16 }}>
        Hi, I'm Solis
      </Text>
      <Text style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 6, lineHeight: 20, fontSize: 14 }}>
        I'm here to listen and help you reflect.{'\n'}Share what's on your mind.
      </Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map(s => (
          <Pressable
            key={s}
            onPress={() => onSuggestion(s)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: pressed ? theme.colors.primaryContainer : theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.colors.primary, fontSize: 13 }}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function Bubble({ item }: { item: Message }) {
  const theme = useTheme();
  const isUser = item.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.botAvatar, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={{ fontSize: 14 }}>✨</Text>
        </View>
      )}
      <View style={isUser ? styles.userGroup : styles.botGroup}>
        <View style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: theme.colors.surfaceVariant, borderBottomLeftRadius: 4 },
        ]}>
          <Text style={{ color: isUser ? '#fff' : theme.colors.onSurface, lineHeight: 20, fontSize: 14 }}>
            {item.content}
          </Text>
        </View>
        <Text style={[styles.timestamp, { textAlign: isUser ? 'right' : 'left', color: theme.colors.outline }]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function ChatRoomScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const sendScale = useRef(new Animated.Value(0.85)).current;
  const canSend = input.trim().length > 0 && !sending;

  useEffect(() => {
    Animated.spring(sendScale, {
      toValue: canSend ? 1 : 0.85,
      useNativeDriver: true,
      tension: 260,
      friction: 12,
    }).start();
  }, [canSend, sendScale]);

  useEffect(() => {
    if (!conversationId) return;
    chatService.getDetail(conversationId)
      .then(detail => setMessages(detail.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  const scrollToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const send = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;

    setInput('');
    setSending(true);

    const optimisticUser: Message = {
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const { assistant_message } = await chatService.sendMessage(conversationId, trimmed);
      setMessages(prev => [...prev, assistant_message]);
    } catch {
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ─────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 }]}>
        <IconButton icon="arrow-left" size={22} onPress={() => router.back()} style={{ margin: 0 }} />
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={{ fontSize: 20 }}>✨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
            Solis
          </Text>
          <Text variant="labelSmall" style={{ color: sending ? theme.colors.primary : theme.colors.outline }}>
            {sending ? 'Thinking…' : 'Ready to listen'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={[styles.messageList, messages.length === 0 && { flex: 1 }]}
            onContentSizeChange={scrollToEnd}
            ListEmptyComponent={<EmptyState onSuggestion={text => setInput(text)} />}
            ListFooterComponent={sending ? <TypingDots /> : null}
            renderItem={({ item }) => <Bubble item={item} />}
          />

          {/* ── Input bar ──────────────────────────── */}
          <View style={[styles.inputBar, { borderTopColor: theme.colors.surfaceVariant, borderTopWidth: 1, backgroundColor: theme.colors.surface }]}>
            <View style={[styles.inputWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.onSurface }]}
                placeholder="Share what's on your mind…"
                placeholderTextColor={theme.colors.outline}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => send()}
                returnKeyType="send"
                blurOnSubmit={false}
                multiline
              />
            </View>
            <Pressable onPress={() => send()} disabled={!canSend}>
              <Animated.View
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: canSend ? theme.colors.primary : theme.colors.surfaceVariant,
                    transform: [{ scale: sendScale }],
                  },
                ]}
              >
                <Text style={{ color: canSend ? '#fff' : theme.colors.outline, fontSize: 20, lineHeight: 24 }}>↑</Text>
              </Animated.View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    alignSelf: 'flex-end',
  },
  userGroup: { alignItems: 'flex-end', maxWidth: '80%' },
  botGroup: { alignItems: 'flex-start', maxWidth: '80%' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 3,
    marginHorizontal: 4,
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    marginTop: 24,
    gap: 10,
    width: '100%',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
