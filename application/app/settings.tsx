import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, List, Divider, Switch, ActivityIndicator, Surface, TouchableRipple, useTheme, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import { useScreenLock } from '@/hooks/useScreenLock';
import { useCreateDiaryMutation } from '@/store/api/diaryApi';
import { MOCK_ENTRIES } from '@/data/mock';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const storage = useStorageUsage();
  const screenLock = useScreenLock();
  const [createDiary, { isLoading: isSeeding }] = useCreateDiaryMutation();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleScreenLockToggle = async () => {
    if (!screenLock.isSupported) {
      Alert.alert(
        'Not Available',
        'No biometrics or device passcode enrolled. Set one up in your device settings first.',
      );
      return;
    }
    await screenLock.toggle();
  };

  const handleSeedData = async () => {
    Alert.alert(
      'Seed Dummy Data',
      'This will create 15 diary entries from May 1 to May 15, 2026. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Seed', 
          onPress: async () => {
            try {
              const entries = Object.entries(MOCK_ENTRIES).sort();
              for (const [date, data] of entries) {
                // Ensure date is in the requested range
                if (date >= '2026-05-01' && date <= '2026-05-15') {
                  await createDiary({
                    entry_date: date,
                    title: `Entry for ${date}`,
                    content: data.snippet,
                  }).unwrap();
                }
              }
              Alert.alert('Success', 'Dummy data seeded successfully!');
            } catch (err) {
              console.error('Failed to seed data:', err);
              Alert.alert('Error', 'Failed to seed some or all data.');
            }
          } 
        },
      ]
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.surfaceVariant, borderBottomWidth: 1 }]}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={theme.colors.onSurface}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
          Account
        </Text>
        <Surface style={[styles.card, { borderRadius: theme.roundness * 3 }]} elevation={0}>
          <List.Item
            title={user?.email ?? '—'}
            description="Signed in with email"
            left={() => <List.Icon icon="email-outline" color={theme.colors.outline} />}
            titleStyle={{ color: theme.colors.onSurface }}
            descriptionStyle={{ color: theme.colors.outline }}
          />
          <Divider horizontalInset />
          <List.Item
            title="Sign Out"
            titleStyle={{ color: theme.colors.error }}
            left={() => <List.Icon icon="logout" color={theme.colors.error} />}
            onPress={handleSignOut}
          />
        </Surface>

        {/* Privacy */}
        <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
          Privacy
        </Text>
        <Surface style={[styles.card, { borderRadius: theme.roundness * 3 }]} elevation={0}>
          <TouchableRipple onPress={handleScreenLockToggle} borderless style={styles.ripple}>
            <View style={styles.lockRow}>
              <List.Icon icon="fingerprint" color={theme.colors.outline} style={styles.lockIcon} />
              <View style={styles.lockText}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                  Screen Lock
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                  {screenLock.isLoading
                    ? 'Loading…'
                    : screenLock.isSupported
                    ? 'Require biometrics when resuming the app'
                    : 'No biometrics enrolled on this device'}
                </Text>
              </View>
              {screenLock.isLoading ? (
                <ActivityIndicator size={20} />
              ) : (
                <>
                  <View style={[styles.verticalDivider, { backgroundColor: theme.colors.surfaceVariant }]} />
                  <Switch
                    value={screenLock.isEnabled}
                    onValueChange={handleScreenLockToggle}
                    disabled={!screenLock.isSupported}
                  />
                </>
              )}
            </View>
          </TouchableRipple>
        </Surface>

        {/* Storage */}
        <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
          Storage
        </Text>
        <Surface style={[styles.card, { borderRadius: theme.roundness * 3 }]} elevation={0}>
          <List.Item
            title="App Data"
            description={storage.isLoading ? 'Calculating…' : `${storage.formatted} used locally`}
            left={() => <List.Icon icon="database-outline" color={theme.colors.outline} />}
            titleStyle={{ color: theme.colors.onSurface }}
            descriptionStyle={{ color: theme.colors.outline }}
            right={() =>
              storage.isLoading ? (
                <ActivityIndicator size={20} style={styles.rightSlot} />
              ) : (
                <StorageBar bytes={storage.bytes} />
              )
            }
            onPress={storage.refresh}
          />
        </Surface>

        {/* About */}
        <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
          About
        </Text>
        <Surface style={[styles.card, { borderRadius: theme.roundness * 3 }]} elevation={0}>
          <List.Item
            title="Version"
            description="1.0.0"
            left={() => <List.Icon icon="information-outline" color={theme.colors.outline} />}
            titleStyle={{ color: theme.colors.onSurface }}
            descriptionStyle={{ color: theme.colors.outline }}
          />
        </Surface>

        {/* Debug */}
        <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.error }]}>
          Debug
        </Text>
        <Surface style={[styles.card, { borderRadius: theme.roundness * 3 }]} elevation={0}>
          <List.Item
            title="Seed Dummy Data"
            description="Create 15 entries for May 2026"
            left={() => <List.Icon icon="bug-outline" color={theme.colors.error} />}
            onPress={handleSeedData}
            right={() => isSeeding && <ActivityIndicator size={20} style={{ alignSelf: 'center', marginRight: 16 }} />}
          />
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

// Simple visual bar capped at 5 MB
function StorageBar({ bytes }: { bytes: number }) {
  const theme = useTheme();
  const MAX = 5 * 1024 * 1024;
  const ratio = Math.min(bytes / MAX, 1);

  return (
    <View style={styles.storageBarWrap}>
      <View style={[styles.storageBarTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View
          style={[
            styles.storageBarFill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: ratio > 0.8 ? theme.colors.error : theme.colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    gap: 8,
  },
  backButton: {
    padding: 8,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 8,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    overflow: 'hidden',
  },
  rightSlot: {
    alignSelf: 'center',
    marginRight: 8,
  },
  ripple: {
    borderRadius: 12,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 16,
    gap: 12,
  },
  lockIcon: {
    margin: 0,
  },
  lockText: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    height: 28,
    borderRadius: 1,
  },
  storageBarWrap: {
    justifyContent: 'center',
    marginRight: 8,
  },
  storageBarTrack: {
    width: 80,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
