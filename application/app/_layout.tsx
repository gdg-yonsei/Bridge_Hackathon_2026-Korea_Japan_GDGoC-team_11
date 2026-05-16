import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { store, persistor } from '@/store';
import { lightTheme, darkTheme } from '@/theme';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </PaperProvider>
      </PersistGate>
    </Provider>
  );
}
