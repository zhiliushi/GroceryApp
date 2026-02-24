import React from 'react';
import {View, StyleSheet} from 'react-native';
import {ActivityIndicator, Text} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

/**
 * Full-screen centered loading spinner with optional message.
 * Use for initial screen loads and page transitions.
 */
export default function LoadingSpinner({
  message = 'Loading...',
  size = 'large',
  color,
}: LoadingSpinnerProps): React.JSX.Element {
  const {colors} = useAppTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {message ? <Text style={[styles.text, {color: colors.textSecondary}]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    marginTop: 12,
    textAlign: 'center',
  },
});
