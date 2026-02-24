import React from 'react';
import {View, StyleSheet} from 'react-native';
import {ActivityIndicator, Text} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';

interface LoadingProps {
  message?: string;
}

export default function Loading({
  message = 'Loading...',
}: LoadingProps): React.JSX.Element {
  const {colors} = useAppTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={[styles.text, {color: colors.textSecondary}]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  text: {marginTop: 12},
});
