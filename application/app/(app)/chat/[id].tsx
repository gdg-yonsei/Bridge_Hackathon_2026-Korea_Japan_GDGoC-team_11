import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text, IconButton, Surface, useTheme } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { chatService, type Message } from '@/services/chatService';

export default function ChatRoomScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

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

  const send = async () => {
    const trimmed = input.trim();
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
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
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
            contentContainerStyle={styles.messageList}
            onContentSizeChange={scrollToEnd}
            ListEmptyComponent={
              <Text style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 32 }}>
                Say hi to start the conversation.
              </Text>
            }
            renderItem={({ item }) => <Bubble item={item} />}
          />

          {sending && (
            <View style={styles.typingRow}>
              <Text style={{ color: theme.colors.outline, fontSize: 20, letterSpacing: 2 }}>···</Text>
            </View>
          )}

          <View style={[styles.inputBar, { borderTopColor: theme.colors.surfaceVariant, borderTopWidth: 1, backgroundColor: theme.colors.surface }]}>
            <Surface style={[styles.inputWrap, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 24 }]} elevation={0}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.onSurface }]}
                placeholder="Share what's on your mind…"
                placeholderTextColor={theme.colors.outline}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                returnKeyType="send"
                multiline
              />
            </Surface>
            <IconButton
              icon="send"
              size={22}
              iconColor={input.trim() && !sending ? theme.colors.primary : theme.colors.outline}
              onPress={send}
              disabled={!input.trim() || sending}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
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
    </View>
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
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    alignSelf: 'flex-end',
  },
  messageList: {
    padding: 16,
    gap: 10,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  typingRow: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  inputWrap: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
});
