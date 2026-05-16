import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>Bridge</Text>
        {user && (
          <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
            {user.email}
          </Text>
        )}
      </View>

      <Button
        mode="text"
        onPress={() => router.push('/(app)/debug')}
        style={styles.debugButton}
      >
        🛠 Debug
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontWeight: 'bold' },
  debugButton: { alignSelf: 'center' },
});
