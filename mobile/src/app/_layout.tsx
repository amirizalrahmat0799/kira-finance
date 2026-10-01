import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { migrate } from '@/db/schema';
import { configureNotifications } from '@/services/notifications';
import { SyncProvider } from '@/sync/SyncProvider';
import { useColors } from '@/ui/theme';
import { ToastHost } from '@/ui/widgets';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.card, text: c.text, border: c.border, primary: c.primary },
  };

  useEffect(() => {
    void configureNotifications();
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <SQLiteProvider databaseName="kira.db" onInit={migrate}>
        <SyncProvider>
          <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="transaction" options={{ presentation: 'modal', title: 'Transaction' }} />
            <Stack.Screen name="budget" options={{ presentation: 'modal', title: 'Budget' }} />
            <Stack.Screen name="bill" options={{ presentation: 'modal', title: 'Recurring bill' }} />
            <Stack.Screen name="account" options={{ presentation: 'modal', title: 'Account' }} />
            <Stack.Screen name="category" options={{ presentation: 'modal', title: 'New category' }} />
            <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: 'Sync your data' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
          <ToastHost />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </SyncProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
