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
      const redirectTo = 'bridge:///';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('Failed to get OAuth URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log('[OAuth] result type:', result.type);

      if (result.type === 'success') {
        const fragment = result.url.split('#')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        }
      }
    } catch (e) {
      console.error('Google sign-in failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Solis
        </Text>
        <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.outline }]}>
          Write your diary and get AI-powered emotion insights
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
          Continue with Google
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
