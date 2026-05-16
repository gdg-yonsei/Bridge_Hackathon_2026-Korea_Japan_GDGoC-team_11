import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, List, Divider, Switch, ActivityIndicator, TouchableRipple, useTheme, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HealingCard } from '@/components/common/HealingCard';
import { tokens } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import { useScreenLock } from '@/hooks/useScreenLock';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const storage = useStorageUsage();
  const screenLock = useScreenLock();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge" style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.primary }]}>Profile</Text>
          <HealingCard variant="outlined" style={styles.card}>
            <List.Item
              title={user?.email ?? 'Guest User'}
              description="Connected via Google"
              left={p => <List.Icon {...p} icon="account-circle-outline" />}
              right={p => <IconButton {...p} icon="pencil-outline" size={20} />}
            />
          </HealingCard>
        </View>

        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.primary }]}>Security & Privacy</Text>
          <HealingCard variant="outlined" style={styles.card}>
            <TouchableRipple onPress={screenLock.toggle}>
              <View style={styles.row}>
                <List.Icon icon="fingerprint" color={theme.colors.outline} />
                <View style={styles.rowContent}>
                  <Text variant="bodyLarge">Biometric Lock</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Protect your diary from prying eyes</Text>
                </View>
                <Switch value={screenLock.isEnabled} onValueChange={screenLock.toggle} />
              </View>
            </TouchableRipple>
            <Divider horizontalInset />
            <List.Item
              title="Cloud Sync"
              description="Keep your diary safe in the cloud"
              left={p => <List.Icon {...p} icon="cloud-check-outline" />}
              right={() => <Switch value={true} disabled />}
            />
          </HealingCard>
        </View>

        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.primary }]}>Storage</Text>
          <HealingCard variant="outlined" style={styles.card}>
            <List.Item
              title="Local Cache"
              description={storage.isLoading ? 'Calculating...' : `${storage.formatted} used`}
              left={p => <List.Icon {...p} icon="database-outline" />}
              right={() => <IconButton icon="refresh" size={20} onPress={storage.refresh} />}
            />
          </HealingCard>
        </View>

        <View style={styles.footer}>
          <HealingCard 
            variant="flat" 
            style={[styles.signOutCard, { backgroundColor: '#FEEEEE' }]}
          >
            <TouchableRipple onPress={handleSignOut} style={styles.signOutRipple}>
              <View style={styles.signOutContent}>
                <Text variant="labelLarge" style={{ color: theme.colors.error, fontWeight: '700' }}>
                  Sign Out from Healing Garden
                </Text>
              </View>
            </TouchableRipple>
          </HealingCard>
          <Text variant="labelSmall" style={styles.versionText}>Version 1.2.4 (Beta)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerTitle: { fontWeight: '700' },
  scroll: { padding: 20, gap: 24 },
  section: { gap: 8 },
  sectionLabel: { 
    marginLeft: 4, 
    fontWeight: '700', 
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  card: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  rowContent: { flex: 1 },
  footer: { marginTop: 24, alignItems: 'center', gap: 16 },
  signOutCard: { width: '100%', padding: 0, overflow: 'hidden' },
  signOutRipple: { padding: 16 },
  signOutContent: { alignItems: 'center' },
  versionText: { color: '#B0B4AE' },
});
