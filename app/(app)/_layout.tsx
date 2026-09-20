import React from 'react';
import { Alert, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const handleComingSoon = (feature: string) => {
    Alert.alert(feature, 'This feature is coming soon to NUMO!');
  };

  const isDark = theme.isDark;

  // Instagram / TikTok style:
  // Active is solid deep black (#000000) in light mode, pure crisp white in dark mode.
  // Inactive is neutral secondary gray (#8E8E93).
  const barBackground = isDark ? '#0A0F0B' : '#FFFFFF';
  const activeColor = isDark ? '#FFFFFF' : '#000000';
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.45)' : '#8E8E93';
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
              color={color}
            />
          ),
        }}
      />

      {/* 2. Workout / Training */}
      <Tabs.Screen
        name="training/index"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={23}
              color={color}
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
              color={color}
            />
          ),
        }}
      />

      {/* 4. Compete (Disabled) */}
      <Tabs.Screen
        name="compete"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            handleComingSoon('Compete');
          },
        }}
        options={{
          title: 'Compete',
          tabBarItemStyle: styles.disabledTab,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="trophy-outline"
              size={23}
              color={color}
            />
          ),
        }}
      />

      {/* 5. Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />

      {/* Full-screen screens without the tab bar */}
      <Tabs.Screen
        name="workout"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="results"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
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
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: -0.1,
  },
  disabledTab: {
    opacity: 0.35,
  },
});