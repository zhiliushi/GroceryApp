import React from 'react';
import {View, StyleSheet, Modal} from 'react-native';
import {ActivityIndicator, Text} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

/**
 * Transparent overlay with a centered spinner.
 * Use for blocking operations like save, delete, or sync.
 */
export default function LoadingOverlay({
  visible,
  message = 'Please wait...',
}: LoadingOverlayProps): React.JSX.Element | null {
  const {colors} = useAppTheme();
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, {backgroundColor: colors.surface}]}>
          <ActivityIndicator size="large" />
          {message ? <Text style={[styles.text, {color: colors.textSecondary}]}>{message}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 180,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
  },
});
