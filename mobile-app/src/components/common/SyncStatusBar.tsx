import React from 'react';
import {View, StyleSheet, Pressable} from 'react-native';
import {Text, IconButton, ActivityIndicator} from 'react-native-paper';
import {useSyncStore} from '../../store/syncStore';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';

interface SyncStatusBarProps {
  onSyncPress?: () => void;
}

/**
 * Horizontal bar showing current sync status.
 * - Idle: grey, shows last synced time
 * - Syncing: blue with spinner
 * - Success: green with checkmark
 * - Error: red with retry button
 */
export default function SyncStatusBar({
  onSyncPress,
}: SyncStatusBarProps): React.JSX.Element {
  const {status, isOnline, lastSyncAt, errorMessage} = useSyncStore();
  const {tier} = useAuthStore();
  const {colors} = useAppTheme();

  // Free users: show local-only message
  if (tier !== 'paid') {
    return (
      <View style={[styles.container, {borderLeftColor: colors.success, backgroundColor: colors.surface}]}>
        <IconButton
          icon="database-outline"
          iconColor={colors.success}
          size={16}
          style={styles.icon}
        />
        <Text
          variant="bodySmall"
          style={[styles.text, {color: colors.textSecondary}]}
          numberOfLines={1}>
          Your data is saved locally, consider upgrade to have cloud sync
        </Text>
      </View>
    );
  }

  const lastSyncLabel = lastSyncAt
    ? `Last synced ${formatTimeAgo(lastSyncAt)}`
    : 'Not synced yet';

  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
        return colors.accent;
      case 'success':
        return colors.success;
      case 'error':
        return colors.danger;
      default:
        return colors.textTertiary;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return null; // Use spinner instead
      case 'success':
        return 'cloud-check';
      case 'error':
        return 'cloud-alert';
      default:
        return isOnline ? 'cloud-outline' : 'cloud-off-outline';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return lastSyncLabel;
      case 'error':
        return errorMessage ?? 'Sync failed';
      default:
        return isOnline ? lastSyncLabel : 'Offline';
    }
  };

  const color = getStatusColor();
  const icon = getStatusIcon();

  return (
    <Pressable onPress={onSyncPress} disabled={status === 'syncing'}>
      <View style={[styles.container, {borderLeftColor: color, backgroundColor: colors.surface}]}>
        {status === 'syncing' ? (
          <ActivityIndicator size={16} color={color} style={styles.spinner} />
        ) : icon ? (
          <IconButton
            icon={icon}
            iconColor={color}
            size={16}
            style={styles.icon}
          />
        ) : null}

        <Text
          variant="bodySmall"
          style={[styles.text, {color}]}
          numberOfLines={1}>
          {getStatusText()}
        </Text>

        {status === 'error' && (
          <IconButton
            icon="refresh"
            iconColor={color}
            size={14}
            style={styles.retryIcon}
            onPress={onSyncPress}
          />
        )}

        {status !== 'syncing' && status !== 'error' && (
          <IconButton
            icon="sync"
            iconColor={colors.textTertiary}
            size={14}
            style={styles.retryIcon}
            onPress={onSyncPress}
          />
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 6,
    elevation: 1,
  },
  spinner: {marginRight: 6, marginLeft: 4},
  icon: {margin: 0, marginRight: -2},
  text: {flex: 1, fontSize: 12},
  retryIcon: {margin: 0},
});
