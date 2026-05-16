import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('OAuth URL을 받지 못했습니다.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        await supabase.auth.exchangeCodeForSession(result.url);
      }
    } catch (e) {
      console.error('Google 로그인 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Bridge
        </Text>
        <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.outline }]}>
          일기를 쓰고 AI 분석을 받아보세요
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="google"
          loading={loading}
          disabled={loading}
          onPress={signInWithGoogle}
          contentStyle={styles.buttonContent}
        >
          Google로 계속하기
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    paddingBottom: 16,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
