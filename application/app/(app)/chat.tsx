import { useState, useRef, useEffect } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useGetConversationQuery, usePostMessageMutation } from '@/store/api/chatApi';
import type { Message } from '@/types/chat';

export default function ChatScreen() {
  const theme = useTheme();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const id = Number(conversationId);

  const { data: conversation, isLoading, isError, refetch } = useGetConversationQuery(id, {
    skip: !id,
  });
  const [postMessage, { isLoading: isPosting }] = usePostMessageMutation();

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const messages = conversation?.messages || [];

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || isPosting) return;

    setInput('');
    try {
      await postMessage({
        conversationId: id,
        body: { message: trimmed },
      }).unwrap();
      // Scroll to end after sending is handled by useEffect on messages change
    } catch (err) {
      console.error('Failed to send message:', err);
      setInput(trimmed); // Restore input on failure
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (isLoading) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <Text>Failed to load conversation.</Text>
          <IconButton icon="refresh" onPress={refetch} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ─────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={{ fontSize: 22 }}>🤖</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
            {conversation?.title || 'Chat'}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            {isPosting ? 'AI is thinking…' : 'Gemini Copilot'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* ── Message list ─────────────────────────── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => `${item.created_at}-${index}`}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <Bubble item={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                Start a conversation about your diary entry.
              </Text>
            </View>
          }
        />

        {/* ── Input bar ────────────────────────────── */}
        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: theme.colors.surfaceVariant,
              borderTopWidth: 1,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Surface
            style={[
              styles.inputWrap,
              { backgroundColor: theme.colors.surfaceVariant, borderRadius: 24 },
            ]}
            elevation={0}
          >
            <TextInput
              style={[styles.textInput, { color: theme.colors.onSurface }]}
              placeholder="Message..."
              placeholderTextColor={theme.colors.outline}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
              editable={!isPosting}
            />
          </Surface>
          <IconButton
            icon="send"
            size={22}
            iconColor={input.trim() && !isPosting ? theme.colors.primary : theme.colors.outline}
            onPress={send}
            disabled={!input.trim() || isPosting}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ item }: { item: Message }) {
  const theme = useTheme();
  const isUser = item.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: theme.colors.surfaceVariant, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text
          style={{
            color: isUser ? '#fff' : theme.colors.onSurface,
            lineHeight: 20,
            fontSize: 14,
          }}
        >
          {item.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    padding: 16,
    gap: 10,
    paddingBottom: 20,
  },
  bubbleRow: {
    flexDirection: 'row',
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
  emptyState: {
    padding: 40,
    alignItems: 'center',
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
