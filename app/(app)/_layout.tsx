import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { typography } from '@/src/constants/typography';

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const isDark = theme.isDark;

  const barBackground = isDark ? '#0A0F0B' : '#FFFFFF';
  const activeColor = isDark ? '#FFFFFF' : '#000000';
  const inactiveColor = theme.subtext;
  const borderTopColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: barBackground,
            borderTopColor: borderTopColor,
            height: 52 + (insets.bottom > 0 ? insets.bottom : 10),
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          },
        ],
      }}
    >
      {/* 1. Home Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />

      {/* 2. Practice (Training) */}
      <Tabs.Screen
        name="training/index"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={23}
              color={color as string}
            />
          ),
        }}
      />

      {/* 3. Stats */}
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={23}
              color={color as string}
            />
          ),
        }}
      />

      {/* 4. Profile */}
      <Tabs.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={23}
              color={color as string}
            />
          ),
        }}
      />

      {/* Hidden Screens: Accessible via in-app navigation, not visible on tab bar */}
      <Tabs.Screen
        name="settings"
        options={{
          // href: null now redirects away from the screen (expo-router SDK 58), so only hide the button.
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="workout"
        options={{
          // href: null now redirects away from the screen (expo-router SDK 58), so only hide the button.
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="results"
        options={{
          // href: null now redirects away from the screen (expo-router SDK 58), so only hide the button.
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  label: {
    ...typography.caption,
    marginTop: 2,
    letterSpacing: -0.1,
  },
});