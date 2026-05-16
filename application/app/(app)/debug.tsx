import { ScrollView, StyleSheet } from 'react-native';
import { Button, Divider, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const PAGES = [
  { label: '홈', href: '/(app)' },
  { label: '로그인', href: '/(auth)/login' },
] as const;

export default function DebugScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={styles.heading}>🛠 Debug</Text>

        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
          Auth
        </Text>
        <Text variant="bodySmall" style={styles.info}>
          {user ? `로그인: ${user.email}` : '비로그인 상태'}
        </Text>
        <Button
          mode="outlined"
          onPress={signOut}
          style={styles.item}
        >
          로그아웃
        </Button>

        <Divider style={styles.divider} />

        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
          페이지 이동
        </Text>
        {PAGES.map(({ label, href }) => (
          <Button
            key={href}
            mode="contained-tonal"
            onPress={() => router.push(href as any)}
            style={styles.item}
          >
            {label}
          </Button>
        ))}

        <Divider style={styles.divider} />

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.item}
        >
          ← 뒤로
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, gap: 8 },
  heading: { fontWeight: 'bold', marginBottom: 8 },
  info: { marginBottom: 4 },
  item: { marginVertical: 2 },
  divider: { marginVertical: 12 },
});
