import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Surface, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { diaryService } from '@/services/diaryService';
import { useGetConversationsQuery, useCreateConversationMutation } from '@/store/api/chatApi';

export default function WriteScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // For chat navigation
  const { data: conversations, isLoading: loadingConversations } = useGetConversationsQuery(
    { diary_id: id ? Number(id) : undefined },
    { skip: !id }
  );
  const [createConversation, { isLoading: creatingConversation }] = useCreateConversationMutation();

  useEffect(() => {
    if (id) {
      setLoading(true);
      diaryService.getDetail(Number(id))
        .then(detail => {
          setText(detail.content);
        })
        .catch(error => {
          console.error('Failed to load diary entry:', error);
          Alert.alert('Error', 'Failed to load existing entry.');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleChat = async () => {
    if (!id) return;

    try {
      let conversationId: number;
      if (conversations && conversations.length > 0) {
        conversationId = conversations[0].id;
      } else {
        const newConv = await createConversation({
          diary_entry_id: Number(id),
          title: `Chat about ${dateLabel}`,
        }).unwrap();
        conversationId = newConv.id;
      }
      router.push({ pathname: '/chat', params: { conversationId } });
    } catch (err) {
      console.error('Failed to start conversation:', err);
      Alert.alert('Error', 'Failed to start a conversation.');
    }
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      if (id) {
        await diaryService.update(Number(id), { content: text });
      } else {
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const entry_date = `${year}-${month}-${day}`;
        
        const payload = { entry_date, content: text };
        console.log('[DEBUG] Save payload:', payload);
        await diaryService.create(payload);
      }
      router.back();
    } catch (error: any) {
      console.error('Failed to save diary entry:', error);
      if (error?.message?.includes('409')) {
        Alert.alert('Entry Exists', 'You already have a diary entry for today.');
      } else {
        Alert.alert('Error', 'Failed to save diary entry. Please try again.');
      }
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* ── Header ───────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
            {id ? 'Edit Entry' : 'New Entry'}
          </Text>
          <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
            {dateLabel}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Button
            mode="text"
            onPress={handleSave}
            loading={saving}
            disabled={saving || !text.trim() || loading}
            compact
          >
            {id ? 'Update' : 'Save'}
          </Button>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* ── Text input ────────────────────────────── */}
            <Surface style={[styles.inputCard, { borderRadius: theme.roundness * 2 }]} elevation={0}>
              <TextInput
                style={[styles.textInput, { color: theme.colors.onSurface }]}
                placeholder="How was your day? What's on your mind…"
                placeholderTextColor={theme.colors.outline}
                multiline
                autoFocus
                value={text}
                onChangeText={setText}
                textAlignVertical="top"
              />
            </Surface>

            {/* ── Hint ─────────────────────────────────── */}
            {!text && (
              <Text style={[styles.hint, { color: theme.colors.outline }]}>
                Write freely — Gemini will detect your emotion after saving.
              </Text>
            )}
          </ScrollView>
        )}

        {/* ── Action bar ───────────────────────────── */}
        <View style={[styles.bottomBar, {
          borderTopColor: theme.colors.surfaceVariant,
          borderTopWidth: 1,
          backgroundColor: theme.colors.surface,
        }]}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving || !text.trim() || loading}
            style={{ flex: 1 }}
          >
            {id ? 'Update & Analyse' : 'Save & Analyse'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  scroll: { padding: 16, gap: 16, paddingBottom: 8 },
  inputCard: { minHeight: 220, padding: 4 },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    padding: 12,
    minHeight: 200,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  bottomBar: {
    padding: 16,
  },
});
