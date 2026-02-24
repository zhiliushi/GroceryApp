/**
 * Central theme hook for GroceryApp.
 *
 * Resolves the effective light/dark mode from user preference (settingsStore)
 * and system setting (useColorScheme), then returns the Paper theme, navigation
 * theme, and convenience accessors.
 */

import {useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {useSettingsStore} from '../store/settingsStore';
import {
  getAppTheme,
  getNavigationTheme,
  type AppColors,
  type AppTheme,
  type Spacing,
} from '../config/theme';
import type {Theme as NavigationTheme} from '@react-navigation/native';

interface UseAppThemeResult {
  /** Full react-native-paper MD3 theme (pass to PaperProvider). */
  theme: AppTheme;
  /** React Navigation theme (pass to NavigationContainer). */
  navTheme: NavigationTheme;
  /** Whether dark mode is active. */
  isDark: boolean;
  /** Flat color tokens for quick access. */
  colors: AppColors;
  /** Spacing scale. */
  spacing: Spacing;
}

export function useAppTheme(): UseAppThemeResult {
  const userPref = useSettingsStore(s => s.theme);
  const systemScheme = useColorScheme();

  const effectiveMode: 'light' | 'dark' = useMemo(() => {
    if (userPref === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return userPref;
  }, [userPref, systemScheme]);

  const theme = useMemo(() => getAppTheme(effectiveMode), [effectiveMode]);
  const navTheme = useMemo(() => getNavigationTheme(effectiveMode), [effectiveMode]);

  return {
    theme,
    navTheme,
    isDark: effectiveMode === 'dark',
    colors: theme.custom,
    spacing: theme.spacing,
  };
}
