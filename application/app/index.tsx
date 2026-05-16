import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;

  return session ? <Redirect href="/(app)" /> : <Redirect href="/(auth)/login" />;
}
