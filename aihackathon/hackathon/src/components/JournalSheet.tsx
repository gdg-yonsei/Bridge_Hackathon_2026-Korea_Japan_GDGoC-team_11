import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Keyboard,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodKey, JournalEntry } from '../types';
import { MOODS, DETAIL_TAGS, COLORS } from '../constants/moods';
import { saveEntry } from '../lib/storage';
import { analyzeEntry } from '../lib/cbt';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.88, 680);

interface Props {
  selectedMood: MoodKey;
  onSaved: (entry: JournalEntry) => void;
}

export interface JournalSheetHandle {
  open: () => void;
  close: () => void;
}

const JournalSheet = forwardRef<JournalSheetHandle, Props>(
  ({ selectedMood, onSaved }, ref) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SHEET_HEIGHT);
    const overlayOpacity = useSharedValue(0);

    const [visible, setVisible] = useState(false);
    const [content, setContent] = useState('');
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const open = useCallback(() => {
      setVisible(true);
      Keyboard.dismiss();
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      overlayOpacity.value = withTiming(1, { duration: 260 });
    }, []);

    const closeSheet = useCallback(() => {
      Keyboard.dismiss();
      translateY.value = withSpring(
        SHEET_HEIGHT,
        { damping: 20, stiffness: 200 },
        (finished) => {
          if (finished) runOnJS(setVisible)(false);
        }
      );
      overlayOpacity.value = withTiming(0, { duration: 240 });
    }, []);

    useImperativeHandle(ref, () => ({ open, close: closeSheet }));

    const sheetStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
      opacity: overlayOpacity.value,
    }));

    const toggleTag = (tag: string) => {
      setActiveTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    };

    const handleSave = async () => {
      if (saving) return;
      setSaving(true);

      const words = content
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      const entry: JournalEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        mood: selectedMood,
        tags: activeTags,
        content,
        wordCount: words,
        createdAt: Date.now(),
      };

      await saveEntry(entry);
      // fire-and-forget AI analysis
      analyzeEntry(entry).catch(console.error);

      setSaving(false);
      setContent('');
      setActiveTags([]);
      closeSheet();
      setTimeout(() => onSaved(entry), 360);
    };

    if (!visible) return null;

    const mood = MOODS[selectedMood];

    return (
      <>
        {/* Dimmed overlay */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { height: SHEET_HEIGHT, paddingBottom: insets.bottom || 16 },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Today's Journal</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Paper */}
            <View style={styles.paper}>
              {/* Ring holes */}
              <View style={styles.rings}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={styles.ring} />
                ))}
              </View>
              {/* Red margin line */}
              <View style={styles.marginLine} />

              {/* Mood pill — tapping closes sheet to change mood */}
              <TouchableOpacity
                style={[styles.moodPill, { backgroundColor: mood.bg }]}
                onPress={closeSheet}
                activeOpacity={0.8}
              >
                <Text style={styles.moodPillEmoji}>{mood.face}</Text>
                <Text style={[styles.moodPillLabel, { color: mood.textColor }]}>
                  {mood.label}
                </Text>
                <Text style={styles.moodPillChange}>change</Text>
              </TouchableOpacity>

              {/* Detail tags */}
              <View style={styles.tagsSection}>
                <Text style={styles.tagsLabel}>FEELINGS</Text>
                <View style={styles.tagsWrap}>
                  {DETAIL_TAGS.map((tag) => {
                    const active = activeTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tagBtn, active && styles.tagBtnActive]}
                        onPress={() => toggleTag(tag)}
                      >
                        <Text
                          style={[styles.tagTxt, active && styles.tagTxtActive]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Textarea */}
              <TextInput
                style={styles.input}
                placeholder="Write freely about your day..."
                placeholderTextColor="#c8bea8"
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
                autoCorrect
                autoCapitalize="sentences"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.draftBtn} onPress={closeSheet}>
              <Text style={styles.draftTxt}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveTxt}>
                {saving ? 'Saving...' : 'Save entry'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </>
    );
  }
);

export default JournalSheet;

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 35, 25, 0.42)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    borderColor: COLORS.borderPaper,
    zIndex: 11,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 14 },
    }),
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: '#d0c8b0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ede8d8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3d3020',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { fontSize: 13, color: '#7a6e5a' },

  bodyContent: { padding: 12, paddingBottom: 20 },

  paper: {
    backgroundColor: COLORS.paper,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.borderPaper,
    paddingLeft: 42,
    paddingRight: 16,
    paddingVertical: 16,
    minHeight: 380,
  },
  rings: {
    position: 'absolute',
    left: 10,
    top: 28,
    gap: 42,
    flexDirection: 'column',
  },
  ring: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.ringBg,
    borderWidth: 1.5,
    borderColor: COLORS.ringBorder,
  },
  marginLine: {
    position: 'absolute',
    left: 34,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#f0b8b8',
    opacity: 0.55,
  },

  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  moodPillEmoji: { fontSize: 18 },
  moodPillLabel: { fontSize: 12, fontWeight: '700' },
  moodPillChange: { fontSize: 10, color: '#8abba8' },

  tagsSection: { marginBottom: 14 },
  tagsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9a907a',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: COLORS.tagBg,
    borderWidth: 0.5,
    borderColor: COLORS.tagBorder,
  },
  tagBtnActive: {
    backgroundColor: COLORS.tagActiveBg,
    borderColor: COLORS.tagActiveBorder,
  },
  tagTxt: { fontSize: 11, color: COLORS.tagText },
  tagTxtActive: { color: COLORS.tagActiveText },

  input: {
    fontSize: 18,
    lineHeight: 30,
    color: '#3d3020',
    minHeight: 180,
    paddingTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#ede8d8',
    backgroundColor: COLORS.paper,
  },
  draftBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8c0a8',
    alignItems: 'center',
  },
  draftTxt: { fontSize: 13, color: '#7a6e5a' },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveTxt: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
