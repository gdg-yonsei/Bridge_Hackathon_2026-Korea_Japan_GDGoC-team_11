import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, IconButton, Surface, useTheme } from 'react-native-paper';
import { Screen } from '@/components/Screen';

type Role = 'user' | 'bot';
type Message = { id: string; role: Role; text: string };

const SEED: Message[] = [
  {
    id: '0',
    role: 'bot',
    text: "Hi, welcome back. This is a quiet space just for you — no judgement, no rush. What's on your mind today?",
  },
];

const RESPONSES = [
  "That sounds really meaningful. Can you tell me more about what you noticed in that moment?",
  "I hear you. It's natural to feel that way. What thoughts were going through your mind?",
  "Let's explore that a bit more. What evidence supports that thought — and what might challenge it?",
  "That's a great observation. How did that make you feel physically?",
  "It sounds like you're already showing a lot of self-awareness. What small step could you take today?",
];

export default function ChatScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [input, setInput] = useState('');
  const [responding, setResponding] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || responding) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setResponding(true);

    // simulate vLLM streaming response delay
    setTimeout(() => {
      const reply = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
      const botMsg: Message = { id: `b-${Date.now()}`, role: 'bot', text: reply };
      setMessages(prev => [...prev, botMsg]);
      setResponding(false);
    }, 1000 + Math.random() * 600);
  };

  return (
    // SafeAreaView covers top + sides; KeyboardAvoidingView handles the input bar
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ─────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={{ fontSize: 22 }}>🌿</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
            Wellness Guide
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            {responding ? 'Thinking…' : 'Here for you'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* ── Message list ─────────────────────────── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => <Bubble item={item} />}
        />

        {/* ── Typing indicator ─────────────────────── */}
        {responding && (
          <View style={styles.typingRow}>
            <Text style={{ color: '#888', fontSize: 20, letterSpacing: 2 }}>···</Text>
          </View>
        )}

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
            iconColor={input.trim() && !responding ? theme.colors.primary : theme.colors.outline}
            onPress={send}
            disabled={!input.trim() || responding}
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
          {item.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 8,
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
