import React from 'react';
import { Alert, StyleSheet } from 'react-native';
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.isDark
          ? 'rgba(255, 255, 255, 0.45)'
          : 'rgba(255, 255, 255, 0.45)',
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.isDark ? '#1C1C1E' : '#1C1C1E',
            bottom: Math.max(insets.bottom, 16),
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
              size={22}
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
              name={focused ? 'calculator' : 'calculator-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Stats (Disabled) */}
      <Tabs.Screen
        name="stats"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            handleComingSoon('Stats');
          },
        }}
        options={{
          title: 'Stats',
          tabBarItemStyle: styles.disabledTab,
          tabBarIcon: () => (
            <Ionicons
              name="stats-chart-outline"
              size={22}
              color="rgba(255, 255, 255, 0.35)"
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
          tabBarIcon: () => (
            <Ionicons
              name="trophy-outline"
              size={22}
              color="rgba(255, 255, 255, 0.35)"
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
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* Hide full-screen screens from the tab bar dock */}
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
    marginHorizontal: 14,
    backgroundColor: '#1C1C1E',
    borderRadius: 36,
    height: 64,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    zIndex: 999,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  disabledTab: {
    opacity: 0.35,
  },
});