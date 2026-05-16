import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Modal, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { PaperProvider, Text, Button, useTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { store, persistor } from '@/store';
import { lightTheme, darkTheme } from '@/theme';
import { AuthProvider } from '@/context/AuthContext';
import { triggerAuthentication } from '@/hooks/useScreenLock';

function ScreenLockGuard() {
  const theme = useTheme();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const tryUnlock = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    const ok = await triggerAuthentication();
    setIsAuthenticating(false);
    if (ok) setIsLocked(false);
  }, [isAuthenticating]);

  // Auto-trigger auth whenever the overlay appears
  useEffect(() => {
    if (isLocked) tryUnlock();
  }, [isLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cold start: check lock state on first mount
  useEffect(() => {
    SecureStore.getItemAsync('screenLock').then((enabled) => {
      if (enabled === 'true') setIsLocked(true);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      appState.current = next;

      // Lock as soon as the app leaves foreground
      if ((next === 'inactive' || next === 'background') && prev === 'active') {
        const enabled = await SecureStore.getItemAsync('screenLock');
        if (enabled === 'true') setIsLocked(true);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <Modal
      visible={isLocked}
      transparent={false}
      animationType="none"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={40}
            color={theme.colors.primary}
          />
        </View>

        <Text
          variant="headlineSmall"
          style={{ color: theme.colors.onBackground, fontWeight: '700', marginTop: 24 }}
        >
          App Locked
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.outline, marginTop: 8, textAlign: 'center' }}
        >
          Authenticate to continue
        </Text>

        <Button
          mode="contained"
          onPress={tryUnlock}
          loading={isAuthenticating}
          disabled={isAuthenticating}
          icon="fingerprint"
          style={styles.unlockButton}
          contentStyle={styles.unlockButtonContent}
        >
          Unlock
        </Button>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <ScreenLockGuard />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthProvider>
        </PaperProvider>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButton: {
    marginTop: 40,
    minWidth: 160,
  },
  unlockButtonContent: {
    paddingVertical: 6,
  },
});
