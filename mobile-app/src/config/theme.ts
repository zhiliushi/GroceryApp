/**
 * Centralized theme system for GroceryApp.
 *
 * Single source of truth for colors, spacing, and typography tokens.
 * Supports light and dark modes.
 */

import {MD3LightTheme, MD3DarkTheme} from 'react-native-paper';
import type {MD3Theme} from 'react-native-paper';
import {DefaultTheme, DarkTheme} from '@react-navigation/native';
import type {Theme as NavigationTheme} from '@react-navigation/native';

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

const lightColors = {
  background: '#F8F8F8',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F1F1',
  card: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  accent: '#3B82F6',
  accentContainer: '#EBF2FF',
  border: '#E5E5E5',
  borderSubtle: '#F0F0F0',

  // Semantic
  success: '#4B9460',
  successBg: '#EEF6F0',
  warning: '#C4873B',
  warningBg: '#FBF3E8',
  danger: '#C45454',
  dangerBg: '#FBEDED',
  info: '#3B82F6',
  infoBg: '#EBF2FF',
};

const darkColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceVariant: '#2A2A2A',
  card: '#1E1E1E',
  textPrimary: '#F0F0F0',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textInverse: '#121212',
  accent: '#60A5FA',
  accentContainer: '#1E3A5F',
  border: '#2E2E2E',
  borderSubtle: '#252525',

  // Semantic
  success: '#6BBF80',
  successBg: '#1A2E1F',
  warning: '#E0A54F',
  warningBg: '#2E2418',
  danger: '#E07070',
  dangerBg: '#2E1818',
  info: '#60A5FA',
  infoBg: '#1E3A5F',
};

export type AppColors = typeof lightColors;

// ---------------------------------------------------------------------------
// Category colors (desaturated)
// ---------------------------------------------------------------------------

export const categoryColors: Record<string, string> = {
  // Old vivid → new muted (works in both modes)
  '#FFC107': '#D4A843', // Dairy
  '#4CAF50': '#5A9E5E', // Produce
  '#F44336': '#C45454', // Meat
  '#FF9800': '#C4873B', // Bakery
  '#2196F3': '#4A80C4', // Beverages
  '#00BCD4': '#4A9EA8', // Frozen
  '#9C27B0': '#8A5A96', // Snacks
  '#607D8B': '#6B7D87', // Household
  '#9E9E9E': '#8A8A8A', // Other
};

/** Map a potentially vivid category color to its muted version. */
export function desaturateCategory(color: string): string {
  return categoryColors[color] ?? color;
}

// ---------------------------------------------------------------------------
// Spacing scale (4px grid)
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type Spacing = typeof spacing;

// ---------------------------------------------------------------------------
// Theme builders
// ---------------------------------------------------------------------------

export function getAppTheme(mode: 'light' | 'dark'): MD3Theme & {custom: AppColors; spacing: Spacing} {
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const colors = mode === 'dark' ? darkColors : lightColors;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      primaryContainer: colors.accentContainer,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceVariant,
      onSurface: colors.textPrimary,
      onSurfaceVariant: colors.textSecondary,
      outline: colors.border,
      outlineVariant: colors.borderSubtle,
      error: colors.danger,
      errorContainer: colors.dangerBg,
      onError: colors.textInverse,
      inverseSurface: mode === 'dark' ? '#E0E0E0' : '#2E2E2E',
      inverseOnSurface: mode === 'dark' ? '#1A1A1A' : '#F0F0F0',
      inversePrimary: mode === 'dark' ? '#3B82F6' : '#60A5FA',
      elevation: {
        ...base.colors.elevation,
        level0: colors.background,
        level1: colors.surface,
        level2: mode === 'dark' ? '#252525' : '#FAFAFA',
        level3: mode === 'dark' ? '#2A2A2A' : '#F5F5F5',
        level4: mode === 'dark' ? '#2E2E2E' : '#F1F1F1',
        level5: mode === 'dark' ? '#333333' : '#EEEEEE',
      },
    },
    custom: colors,
    spacing,
  };
}

export type AppTheme = ReturnType<typeof getAppTheme>;

export function getNavigationTheme(mode: 'light' | 'dark'): NavigationTheme {
  const colors = mode === 'dark' ? darkColors : lightColors;
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };
}
