import { Stack } from 'expo-router';

// 인증 가드 없음 — 일기 기능은 누구나 사용 가능
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
