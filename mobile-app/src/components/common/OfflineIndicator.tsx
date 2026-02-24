import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated} from 'react-native';
import {Text} from 'react-native-paper';
import {useSyncStore} from '../../store/syncStore';
import {useAppTheme} from '../../hooks/useAppTheme';

/**
 * Persistent banner at the top of the screen when the device is offline.
 * Slides in/out with animation. Shows nothing when online.
 *
 * Mount this in the root layout or top of navigators.
 */
export default function OfflineIndicator(): React.JSX.Element | null {
  const isOnline = useSyncStore(s => s.isOnline);
  const {colors} = useAppTheme();
  const slideAnim = useRef(new Animated.Value(isOnline ? -40 : 0)).current;
  const wasOffline = useRef(!isOnline);

  useEffect(() => {
    if (!isOnline) {
      // Slide in
      wasOffline.current = true;
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (wasOffline.current) {
      // Slide out after brief "Back online" display
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -40,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          wasOffline.current = false;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, slideAnim]);

  // Don't render at all if never went offline
  if (isOnline && !wasOffline.current) return null;

  return (
    <Animated.View
      style={[styles.container, {transform: [{translateY: slideAnim}]}]}>
      <View
        style={[
          styles.banner,
          {backgroundColor: isOnline ? colors.success : colors.danger},
        ]}>
        <Text style={[styles.icon, {color: colors.textInverse}]}>{isOnline ? '✓' : '⚡'}</Text>
        <Text style={[styles.text, {color: colors.textInverse}]}>
          {isOnline ? 'Back online' : 'No internet connection'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 6,
    fontSize: 13,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
