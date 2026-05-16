import { useRef, useCallback } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';

const { width: SW, height: SH } = Dimensions.get('window');
// Large enough to cover every corner from the screen center
const TRANS_SIZE = Math.ceil(Math.sqrt(SW * SW + SH * SH)) + 80;

interface ScreenProps {
  children: React.ReactNode;
  background?: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}

export function Screen({ children, background, edges, style }: ScreenProps) {
  const theme = useTheme();
  const transAnim = useRef(new Animated.Value(1)).current;

  // On every tab focus: a parchment circle covers the screen, then shrinks to a
  // centre point — content is revealed spreading outward from the middle.
  useFocusEffect(
    useCallback(() => {
      transAnim.setValue(1);
      Animated.timing(transAnim, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return () => transAnim.stopAnimation();
    }, [])
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {background && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {background}
        </View>
      )}

      <SafeAreaView edges={edges} style={[styles.content, style]}>
        {children}
      </SafeAreaView>

      {/* Transition overlay: shrinks from full-cover to a centre point on focus */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: TRANS_SIZE,
          height: TRANS_SIZE,
          borderRadius: TRANS_SIZE / 2,
          backgroundColor: theme.colors.background,
          top: SH / 2 - TRANS_SIZE / 2,
          left: SW / 2 - TRANS_SIZE / 2,
          transform: [{ scale: transAnim }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
