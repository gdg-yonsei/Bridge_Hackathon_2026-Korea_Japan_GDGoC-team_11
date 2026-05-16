import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const STORE_KEY = 'screenLock';

async function authenticate(): Promise<boolean> {
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm your identity',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  return result.success;
}

interface ScreenLock {
  isEnabled: boolean;
  isSupported: boolean;
  isLoading: boolean;
  toggle: () => Promise<void>;
  authenticate: () => Promise<boolean>;
}

export function useScreenLock(): ScreenLock {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const [compatible, enrolled, stored] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(STORE_KEY),
      ]);
      setIsSupported(compatible && enrolled);
      setIsEnabled(stored === 'true');
      setIsLoading(false);
    }
    init();
  }, []);

  const toggle = useCallback(async () => {
    // always require auth before changing the lock setting
    const ok = await authenticate();
    if (!ok) return;

    const next = !isEnabled;
    await SecureStore.setItemAsync(STORE_KEY, next ? 'true' : 'false');
    setIsEnabled(next);
  }, [isEnabled]);

  return { isEnabled, isSupported, isLoading, toggle, authenticate };
}

export { authenticate as triggerAuthentication };
