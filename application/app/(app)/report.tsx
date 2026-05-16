import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, Menu, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';

export default function ReportScreen() {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <Screen
      background={<View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]} />}
      edges={['top', 'left', 'right']}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary, justifyContent: 'space-between' }]}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="titleLarge" style={{ fontWeight: '700', color: '#fff' }}>Report</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          }
        >
          <Menu.Item onPress={() => { setMenuVisible(false); router.replace('/'); }} title="Calendar" leadingIcon="calendar" />
          <Divider />
          <Menu.Item onPress={() => setMenuVisible(false)} title="Report" leadingIcon="chart-bar" />
        </Menu>

        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Content goes here */}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBg: { height: 80 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
});
