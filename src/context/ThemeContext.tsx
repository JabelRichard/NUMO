import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  background: '#E6E6E6',
  card: '#FFFFFF',
  text: '#1C1C1E',
  subtext: '#666666',
  muted: '#8E8E93',
  border: '#EFEFEF',
  divider: 'rgba(0, 0, 0, 0.06)',
  pillBg: '#F2F2F7',
  primary: '#EC673C',
  accentPurple: '#AFA2FE',
  accentYellow: '#F6FE91',
  isDark: false,
};

export const darkTheme = {
  background: '#121214',
  card: '#1C1C1E',
  text: '#F2F2F7',
  subtext: '#A1A1A6',
  muted: '#636366',
  border: '#2C2C2E',
  divider: 'rgba(255, 255, 255, 0.08)',
  pillBg: '#2C2C2E',
  primary: '#EE5839',
  accentPurple: '#8E82FE',
  accentYellow: '#E5ED72',
  isDark: true,
};

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: typeof lightTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  themeMode: 'system',
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('user_theme').then((saved) => {
      if (saved) setThemeModeState(saved as ThemeMode);
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem('user_theme', mode);
  };

  const isDarkMode =
    themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);