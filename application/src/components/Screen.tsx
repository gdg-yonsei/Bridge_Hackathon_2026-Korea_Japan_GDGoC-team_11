import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

interface ScreenProps {
  children: React.ReactNode;
  /** safe area 밖까지 채울 배경 레이어 (색상, 이미지 등) */
  background?: React.ReactNode;
  /** safe area를 적용할 방향. 기본값: 전체 */
  edges?: Edge[];
  style?: ViewStyle;
}

/**
 * 두 레이어 구조:
 *   1. 외부 View  — 화면 전체(edge-to-edge), safe area 무시
 *   2. SafeAreaView — 콘텐츠 영역, safe area 내부로 제한
 */
export function Screen({ children, background, edges, style }: ScreenProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* safe area를 무시하는 배경 레이어 */}
      {background && <View style={StyleSheet.absoluteFill}>{background}</View>}

      {/* safe area 내부 콘텐츠 레이어 */}
      <SafeAreaView edges={edges} style={[styles.content, style]}>
        {children}
      </SafeAreaView>
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
