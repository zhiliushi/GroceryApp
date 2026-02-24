import React, {useEffect, useRef, useMemo} from 'react';
import {View, StyleSheet, Animated, Easing} from 'react-native';
import {useAppTheme} from '../../hooks/useAppTheme';

interface BarcodeOverlayProps {
  /** Whether the scanner is actively scanning (controls the animation). */
  active?: boolean;
}

/**
 * Semi-transparent overlay with a clear viewfinder rectangle
 * and an animated scan line shown on top of the camera preview.
 */
export default function BarcodeOverlay({
  active = true,
}: BarcodeOverlayProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      scanLineAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2_000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2_000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [active, scanLineAnim]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, VIEWFINDER_SIZE - 4],
  });

  const accentColor = colors.accent;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top dimmed area */}
      <View style={styles.dim} />

      {/* Middle row: dim | viewfinder | dim */}
      <View style={styles.middleRow}>
        <View style={styles.dim} />
        <View style={styles.viewfinder}>
          {/* Corner markers */}
          <View style={[styles.corner, styles.topLeft, {borderColor: accentColor}]} />
          <View style={[styles.corner, styles.topRight, {borderColor: accentColor}]} />
          <View style={[styles.corner, styles.bottomLeft, {borderColor: accentColor}]} />
          <View style={[styles.corner, styles.bottomRight, {borderColor: accentColor}]} />

          {/* Animated scan line */}
          {active && (
            <Animated.View
              style={[
                styles.scanLine,
                {backgroundColor: accentColor, transform: [{translateY: scanLineTranslateY}]},
              ]}
            />
          )}
        </View>
        <View style={styles.dim} />
      </View>

      {/* Bottom dimmed area */}
      <View style={styles.dim} />
    </View>
  );
}

const VIEWFINDER_SIZE = 250;
const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  dim: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'},
  middleRow: {flexDirection: 'row', height: VIEWFINDER_SIZE},
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE},
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 0,
    height: 2,
    opacity: 0.8,
  },
});
