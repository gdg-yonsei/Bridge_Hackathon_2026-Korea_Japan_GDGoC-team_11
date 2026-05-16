import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Menu, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

// ── Route registry ────────────────────────────────────────────────────────────

type AppRoute = 'index' | 'calendar' | 'chat' | 'report' | 'therapists';

const NAV_ITEMS: { route: AppRoute; label: string; icon: string; href: string }[] = [
  { route: 'index',      label: 'Home',       icon: 'home-outline',          href: '/' },
  { route: 'calendar',   label: 'Calendar',   icon: 'calendar',              href: '/calendar' },
  { route: 'chat',       label: 'Chat',       icon: 'chat-outline',          href: '/chat' },
  { route: 'report',     label: 'Report',     icon: 'chart-bar',             href: '/report' },
  { route: 'therapists', label: 'Therapists', icon: 'account-heart-outline', href: '/therapists' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface AppHeaderProps {
  /** Which screen is currently active — used to suppress navigation on that item */
  currentRoute: AppRoute;
  /** Header background color. Defaults to theme.colors.primary */
  backgroundColor?: string;
  /** Icon / text color. Defaults to '#fff' */
  foregroundColor?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppHeader({
  currentRoute,
  backgroundColor,
  foregroundColor = '#fff',
}: AppHeaderProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const bg = backgroundColor ?? theme.colors.primary;
  const fg = foregroundColor;

  const currentLabel = NAV_ITEMS.find(n => n.route === currentRoute)?.label ?? '';

  return (
    <View style={[styles.header, { backgroundColor: bg }]}>
      {/* ── Left: title + dropdown ──────────────────── */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={styles.titleRow}
            hitSlop={8}
          >
            <Text variant="titleLarge" style={{ fontWeight: '700', color: fg }}>
              {currentLabel}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={fg} />
          </Pressable>
        }
      >
        {NAV_ITEMS.map((item, index) => {
          const isCurrent = item.route === currentRoute;
          return (
            <View key={item.route}>
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  if (!isCurrent) router.push(item.href as any);
                }}
                title={item.label}
                leadingIcon={item.icon}
                trailingIcon={isCurrent ? 'check' : undefined}
                titleStyle={isCurrent ? { fontWeight: '700' } : undefined}
              />
              {index < NAV_ITEMS.length - 1 && <Divider />}
            </View>
          );
        })}
      </Menu>

      {/* ── Right: settings ─────────────────────────── */}
      <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
        <MaterialCommunityIcons name="cog-outline" size={24} color={fg} />
      </Pressable>
    </View>
  );
}

// ── Background helper (put behind SafeAreaView) ───────────────────────────────

/** Drop this into Screen's `background` prop to color the status-bar area */
export function AppHeaderBg({ backgroundColor }: { backgroundColor?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.headerBg, { backgroundColor: backgroundColor ?? theme.colors.primary }]} />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerBg: {
    height: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
