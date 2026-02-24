import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Linking,
  Image,
} from 'react-native';
import {Text, Button, ActivityIndicator, IconButton} from 'react-native-paper';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import {useFocusEffect} from '@react-navigation/native';
import BarcodeService from '../../services/barcode/BarcodeService';
import {useBarcode} from '../../hooks/useBarcode';
import {useAppTheme} from '../../hooks/useAppTheme';
import BarcodeOverlay from '../../components/scanner/BarcodeOverlay';
import PriceHistoryPreview from '../../components/scanner/PriceHistoryPreview';
import RecordPriceCard from '../../components/scanner/RecordPriceCard';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Scanner'>;

// ---------------------------------------------------------------------------
// Permission states
// ---------------------------------------------------------------------------

type PermissionState = 'loading' | 'granted' | 'denied' | 'not-determined';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BarcodeScannerScreen({
  navigation,
}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const device = useCameraDevice('back');
  const {scanning, loading, product, source, error, handleScan, reset} =
    useBarcode();

  const [torch, setTorch] = useState(false);
  const [permissionState, setPermissionState] =
    useState<PermissionState>('loading');

  // Deactivate camera when screen loses focus (saves battery)
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, []),
  );

  // Check permission on mount
  useEffect(() => {
    (async () => {
      const status = await BarcodeService.getPermissionStatus();
      if (status === 'granted') {
        setPermissionState('granted');
      } else if (status === 'denied') {
        setPermissionState('denied');
      } else {
        setPermissionState('not-determined');
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    setPermissionState('loading');
    const granted = await BarcodeService.requestPermission();
    setPermissionState(granted ? 'granted' : 'denied');
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const navigateToInventory = (prefill?: Record<string, any>) => {
    navigation.navigate('AddItem', prefill);
  };

  const navigateToShoppingList = (prefill?: Record<string, any>) => {
    navigation.navigate('ListPicker', prefill);
  };

  // ---------------------------------------------------------------------------
  // Permission not granted
  // ---------------------------------------------------------------------------

  if (permissionState === 'loading') {
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (permissionState === 'not-determined') {
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <IconButton icon="camera" size={48} iconColor={colors.accent} />
        <Text variant="titleMedium" style={styles.permissionTitle}>
          Camera Permission Required
        </Text>
        <Text style={[styles.permissionBody, {color: colors.textSecondary}]}>
          We need camera access to scan barcodes on your grocery items.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.permissionBtn}>
          Grant Camera Access
        </Button>
        <Button
          mode="text"
          onPress={() => navigateToInventory()}
          style={styles.manualBtn}>
          Enter Manually Instead
        </Button>
      </View>
    );
  }

  if (permissionState === 'denied') {
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <IconButton icon="camera-off" size={48} iconColor={colors.danger} />
        <Text variant="titleMedium" style={styles.permissionTitle}>
          Camera Access Denied
        </Text>
        <Text style={[styles.permissionBody, {color: colors.textSecondary}]}>
          Please enable camera access in your device settings to scan barcodes.
        </Text>
        <Button
          mode="contained"
          onPress={() => Linking.openSettings()}
          style={styles.permissionBtn}>
          Open Settings
        </Button>
        <Button
          mode="text"
          onPress={() => navigateToInventory()}
          style={styles.manualBtn}>
          Enter Manually Instead
        </Button>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // No camera device
  // ---------------------------------------------------------------------------

  if (!device) {
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <IconButton icon="camera-off" size={48} iconColor={colors.danger} />
        <Text variant="titleMedium">No Camera Available</Text>
        <Text style={[styles.permissionBody, {color: colors.textSecondary}]}>
          This device does not have a usable camera.
        </Text>
        <Button
          mode="contained"
          onPress={() => navigateToInventory()}
          style={styles.permissionBtn}>
          Enter Manually
        </Button>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Product result
  // ---------------------------------------------------------------------------

  if (product) {
    const prefill = {
      barcode: product.barcode,
      productName: product.productName,
      brand: product.brands,
      category: product.categories,
      imageUrl: product.imageUrl,
      isNewProduct: !product.found,
    };

    // Not found — show options to add manually
    if (!product.found) {
      return (
        <ScrollView
          style={[styles.resultScroll, {backgroundColor: colors.background}]}
          contentContainerStyle={styles.resultContent}>
          <IconButton icon="barcode-off" size={56} iconColor={colors.warning} />

          <Text variant="headlineSmall" style={styles.resultHeading}>
            Product Not Found
          </Text>
          <Text style={[styles.notFoundBody, {color: colors.textSecondary}]}>
            This barcode isn't in our database yet. You can still add it manually.
          </Text>
          <Text style={[styles.barcode, {color: colors.textTertiary}]}>Barcode: {product.barcode}</Text>

          <PriceHistoryPreview barcode={product.barcode} />
          <RecordPriceCard barcode={product.barcode} productName={product.barcode} />

          <View style={styles.actions}>
            <Button
              mode="contained"
              icon="fridge"
              onPress={() => navigateToInventory(prefill)}>
              Add to Inventory
            </Button>
            <Button
              mode="outlined"
              icon="cart-plus"
              onPress={() => navigateToShoppingList(prefill)}>
              Add to Shopping List
            </Button>
            <Button mode="text" onPress={reset}>
              Scan Another
            </Button>
          </View>
        </ScrollView>
      );
    }

    // Found — show product details with options
    return (
      <ScrollView
        style={[styles.resultScroll, {backgroundColor: colors.background}]}
        contentContainerStyle={styles.resultContent}>
        {product.imageUrl && (
          <Image source={{uri: product.imageUrl}} style={[styles.productImage, {backgroundColor: colors.surfaceVariant}]} />
        )}

        <Text variant="headlineSmall" style={styles.resultHeading}>
          Product Found
        </Text>

        <Text variant="titleMedium" style={styles.productName}>
          {product.productName || 'Unknown Product'}
        </Text>
        {!product.productName && (
          <Text style={[styles.meta, {color: colors.textSecondary}]}>
            You can enter a name on the next screen
          </Text>
        )}
        {product.brands && <Text style={[styles.meta, {color: colors.textSecondary}]}>{product.brands}</Text>}
        {product.categories && (
          <Text style={[styles.meta, {color: colors.textSecondary}]}>{product.categories}</Text>
        )}

        <Text style={[styles.barcode, {color: colors.textTertiary}]}>Barcode: {product.barcode}</Text>

        {source && source !== 'not_found' && (
          <Text style={[styles.sourceTag, {color: colors.textTertiary}]}>
            Source: {source.replace('_', ' ')}
          </Text>
        )}

        <PriceHistoryPreview barcode={product.barcode} />
        <RecordPriceCard barcode={product.barcode} productName={product.productName || 'Unknown'} />

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="fridge"
            onPress={() => navigateToInventory(prefill)}>
            Add to Inventory
          </Button>
          <Button
            mode="outlined"
            icon="cart-plus"
            onPress={() => navigateToShoppingList(prefill)}>
            Add to Shopping List
          </Button>
          <Button mode="text" onPress={reset}>
            Scan Another
          </Button>
        </View>
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" />
        <Text style={[styles.loadingText, {color: colors.textSecondary}]}>Looking up product...</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <IconButton icon="alert-circle" size={48} iconColor={colors.danger} />
        <Text style={[styles.error, {color: colors.danger}]}>{error}</Text>
        <Button mode="contained" onPress={reset}>
          Try Again
        </Button>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Camera scanning view
  // ---------------------------------------------------------------------------

  const codeScanner = BarcodeService.createCodeScanner(handleScan);
  const isCameraActive = scanning && isScreenFocused;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        codeScanner={codeScanner}
        torch={torch ? 'on' : 'off'}
      />
      <BarcodeOverlay active={isCameraActive} />

      {/* Top controls */}
      <View style={styles.topBar}>
        <IconButton
          icon={torch ? 'flashlight' : 'flashlight-off'}
          iconColor="#fff"
          size={28}
          onPress={() => setTorch(t => !t)}
          style={styles.torchButton}
        />
      </View>

      {/* Bottom footer */}
      <View style={styles.footer}>
        <Text style={styles.hint}>Point camera at a barcode</Text>
        <Button
          mode="text"
          textColor="#fff"
          onPress={() => navigateToInventory()}>
          Enter Manually
        </Button>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // Permission screens
  permissionTitle: {marginTop: 8, textAlign: 'center'},
  permissionBody: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionBtn: {marginTop: 24, width: '100%'},
  manualBtn: {marginTop: 8},
  // Result screen
  resultScroll: {
    flex: 1,
  },
  resultContent: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  resultHeading: {marginTop: 16},
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  productName: {marginTop: 8},
  meta: {marginTop: 4},
  barcode: {marginTop: 12, fontFamily: 'monospace'},
  notFoundBody: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  sourceTag: {
    marginTop: 8,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  actions: {marginTop: 32, width: '100%', gap: 12},
  scanAgain: {marginTop: 4},
  // Camera view
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  torchButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  hint: {color: '#fff', marginBottom: 8, fontSize: 16},
  // Loading & error
  loadingText: {marginTop: 16},
  error: {marginBottom: 16, textAlign: 'center'},
});
