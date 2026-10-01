import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { useColors } from '@/ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'activity', title: 'Activity', icon: 'list-outline', iconActive: 'list' },
  { name: 'budgets', title: 'Budgets', icon: 'pie-chart-outline', iconActive: 'pie-chart' },
  { name: 'bills', title: 'Bills', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'insights', title: 'Insights', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
];

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          // On native the bar sizes itself around the safe area; the web preview needs room for the labels.
          ...(Platform.OS === 'web' ? { height: 70, paddingTop: 6, paddingBottom: 12 } : null),
        },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
