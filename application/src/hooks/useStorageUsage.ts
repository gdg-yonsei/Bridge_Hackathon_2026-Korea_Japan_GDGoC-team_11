import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageUsage {
  bytes: number;
  formatted: string;
  isLoading: boolean;
  refresh: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function useStorageUsage(): StorageUsage {
  const [bytes, setBytes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function measure() {
      setIsLoading(true);
      try {
        const keys = await AsyncStorage.getAllKeys();
        const pairs = await AsyncStorage.multiGet(keys);
        const total = pairs.reduce((sum, [, value]) => {
          return sum + (value ? new TextEncoder().encode(value).length : 0);
        }, 0);
        if (!cancelled) setBytes(total);
      } catch {
        // silently ignore — storage access can fail in some environments
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    measure();
    return () => { cancelled = true; };
  }, [tick]);

  return {
    bytes,
    formatted: formatBytes(bytes),
    isLoading,
    refresh: () => setTick(t => t + 1),
  };
}
