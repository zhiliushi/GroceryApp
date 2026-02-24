import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Button, IconButton} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';

interface EmptyStateProps {
  /** Icon name (Material Community Icons). */
  icon?: string;
  /** Primary text. */
  title: string;
  /** Secondary description text. */
  description?: string;
  /** Optional action button label. */
  actionLabel?: string;
  /** Called when the action button is pressed. */
  onAction?: () => void;
  /** Icon color. Defaults to theme textTertiary. */
  iconColor?: string;
  /** If true, renders compactly for use inside lists/sections. */
  compact?: boolean;
}

/**
 * Empty state placeholder for screens or sections with no data.
 * Shows an icon, message, and optional CTA button.
 */
export default function EmptyState({
  icon = 'package-variant',
  title,
  description,
  actionLabel,
  onAction,
  iconColor,
  compact = false,
}: EmptyStateProps): React.JSX.Element {
  const {colors} = useAppTheme();
  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      <IconButton
        icon={icon}
        iconColor={iconColor ?? colors.textTertiary}
        size={compact ? 36 : 56}
        style={styles.icon}
      />
      <Text
        variant={compact ? 'bodyMedium' : 'titleMedium'}
        style={[styles.title, {color: colors.textSecondary}]}>
        {title}
      </Text>
      {description ? (
        <Text
          variant="bodyMedium"
          style={[styles.description, {color: colors.textTertiary}]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button mode="contained" onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  compactContainer: {
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    margin: 0,
  },
  title: {
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 20,
  },
});
