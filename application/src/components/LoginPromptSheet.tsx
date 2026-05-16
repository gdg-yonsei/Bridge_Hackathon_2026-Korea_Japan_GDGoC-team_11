import { StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function LoginPromptSheet({ visible, onDismiss }: Props) {
  const theme = useTheme();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={styles.title}>AI 분석 리포트</Text>
        <Text variant="bodyMedium" style={[styles.desc, { color: theme.colors.outline }]}>
          Gemini AI가 일기를 분석해 감정 패턴과 심리 인사이트를 정리해드려요.{'\n'}
          이 기능은 로그인이 필요합니다.
        </Text>
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => {
              onDismiss();
              router.push('/(auth)/login');
            }}
          >
            로그인하기
          </Button>
          <Button
            mode="text"
            onPress={() => {
              onDismiss();
              router.push('/(auth)/register');
            }}
          >
            계정이 없으신가요? 회원가입
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    margin: 24,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontWeight: 'bold' },
  desc: { lineHeight: 22 },
  actions: { gap: 8, marginTop: 8 },
});
