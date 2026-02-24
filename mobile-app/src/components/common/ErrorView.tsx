import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Button, IconButton} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';

interface ErrorViewProps {
  /** Short error title. Defaults to "Something went wrong". */
  title?: string;
  /** Detailed error message shown below the title. */
  message?: string;
  /** Icon name (Material Community Icons). Defaults to 'alert-circle-outline'. */
  icon?: string;
  /** Called when the user taps the retry button. If omitted, no button shown. */
  onRetry?: () => void;
  /** Label for the retry button. Defaults to "Try Again". */
  retryLabel?: string;
  /** If true, renders in a compact inline style instead of full-screen. */
  compact?: boolean;
}

/**
 * Error display with optional retry button.
 * - Full-screen: use for page-level errors (failed data load).
 * - Compact: use inside cards or sections.
 */
export default function ErrorView({
  title = 'Something went wrong',
  message,
  icon = 'alert-circle-outline',
  onRetry,
  retryLabel = 'Try Again',
  compact = false,
}: ErrorViewProps): React.JSX.Element {
  const {colors} = useAppTheme();

  if (compact) {
    return (
      <View style={[styles.compactContainer, {backgroundColor: colors.dangerBg}]}>
        <IconButton icon={icon} iconColor={colors.danger} size={24} style={styles.compactIcon} />
        <View style={styles.compactText}>
          <Text variant="bodyMedium" style={[styles.compactTitle, {color: colors.danger}]}>{title}</Text>
          {message ? (
            <Text variant="bodySmall" style={[styles.compactMessage, {color: colors.danger}]}>{message}</Text>
          ) : null}
        </View>
        {onRetry ? (
          <Button mode="text" onPress={onRetry} compact>
            {retryLabel}
          </Button>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <IconButton icon={icon} iconColor={colors.danger} size={56} />
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {message ? (
        <Text variant="bodyMedium" style={[styles.message, {color: colors.textSecondary}]}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button
          mode="contained"
          onPress={onRetry}
          style={styles.button}
          icon="refresh">
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen layout
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 24,
  },
  // Compact inline layout
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  compactIcon: {
    margin: 0,
    marginRight: 4,
  },
  compactText: {
    flex: 1,
  },
  compactTitle: {
    fontWeight: '600',
  },
  compactMessage: {
    marginTop: 2,
  },
});
