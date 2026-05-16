import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MoodKey } from '../types';
import { MOODS, COLORS } from '../constants/moods';

interface Props {
  selected: MoodKey | null;
  onSelect: (mood: MoodKey) => void;
}

export default function MoodGrid({ selected, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {(Object.keys(MOODS) as MoodKey[]).map((key) => {
        const m = MOODS[key];
        const isSelected = selected === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.face,
                { backgroundColor: m.bg },
                isSelected && styles.faceSelected,
              ]}
            >
              <Text style={styles.emoji}>{m.face}</Text>
            </View>
            <Text style={[styles.label, isSelected && { color: COLORS.green }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    gap: 5,
  },
  face: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  faceSelected: {
    borderColor: '#2a7a5e',
    transform: [{ scale: 1.1 }],
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 10,
    color: '#6a8a7a',
    fontWeight: '700',
  },
});
