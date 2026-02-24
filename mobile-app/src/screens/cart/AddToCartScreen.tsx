import React, {useState, useEffect, useMemo} from 'react';
import {View, ScrollView, StyleSheet, Alert} from 'react-native';
import {Text, TextInput, Button, SegmentedButtons} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import {WEIGHT_UNITS, type WeightUnit} from '../../config/constants';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'AddToCart'>;

const WEIGHT_UNIT_OPTIONS = WEIGHT_UNITS.map(u => ({value: u, label: u}));

export default function AddToCartScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const {cart, unit: unitRepo} = useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();
  const userId = user?.uid ?? 'local';

  const [loading, setLoading] = useState(false);
  const [defaultUnitId, setDefaultUnitId] = useState<string | null>(null);

  // Pre-fill from barcode scanner if available
  const params = route.params as {
    barcode?: string;
    productName?: string;
    brand?: string;
    imageUrl?: string;
    isNewProduct?: boolean; // If true, save to Firebase as unconfirmed
  } | undefined;

  const [name, setName] = useState(params?.productName ?? '');
  const [barcode, setBarcode] = useState(params?.barcode ?? '');
  const [brand, setBrand] = useState(params?.brand ?? '');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('g');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Get default unit (pcs)
    unitRepo.getAll().then(units => {
      const pcs = units.find(u => u.abbreviation === 'pcs');
      setDefaultUnitId(pcs?.id ?? units[0]?.id ?? null);
    });
  }, [unitRepo]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }

    if (!defaultUnitId) {
      Alert.alert('Error', 'No units available. Please restart the app.');
      return;
    }

    setLoading(true);
    try {
      // If this is a new/unknown product, save to Firebase for admin review
      if (params?.isNewProduct && barcode.trim()) {
        try {
          await firestore()
            .collection('contributed_products')
            .doc(barcode.trim())
            .set(
              {
                barcode: barcode.trim(),
                name: name.trim(),
                brand: brand.trim() || null,
                imageUrl: params?.imageUrl ?? null,
                confirmed: false,
                contributedAt: firestore.FieldValue.serverTimestamp(),
                contributedBy: userId,
              },
              {merge: true},
            );
          console.log('[AddToCart] Saved unconfirmed product to Firebase');
        } catch (firebaseErr) {
          // Don't block cart add if Firebase save fails
          console.warn('[AddToCart] Failed to save to Firebase:', firebaseErr);
        }
      }

      await cart.add({
        name: name.trim(),
        userId,
        unitId: defaultUnitId,
        quantity: parseInt(quantity, 10) || 1,
        barcode: barcode.trim() || null,
        brand: brand.trim() || null,
        price: price.trim() ? parseFloat(price) : null,
        weight: weight.trim() ? parseFloat(weight) : null,
        weightUnit: weight.trim() ? weightUnit : null,
        imageUrl: params?.imageUrl ?? null,
        notes: notes.trim() || null,
      });

      Alert.alert('Success', 'Item added to cart', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (err: any) {
      console.error('Failed to add to cart:', err);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        saveBtn: {marginTop: 16, backgroundColor: colors.accent},
      }),
    [colors],
  );

  return (
    <SafeAreaView style={staticStyles.safeArea} edges={['bottom']}>
      <ScrollView style={staticStyles.container} contentContainerStyle={staticStyles.content}>
        <TextInput
          label="Product Name *"
          mode="outlined"
          value={name}
          onChangeText={setName}
          style={staticStyles.input}
        />

        <TextInput
          label="Barcode (optional)"
          mode="outlined"
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="numeric"
          style={staticStyles.input}
        />

        <TextInput
          label="Brand (optional)"
          mode="outlined"
          value={brand}
          onChangeText={setBrand}
          style={staticStyles.input}
        />

        <View style={staticStyles.row}>
          <TextInput
            label="Quantity"
            mode="outlined"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            style={[staticStyles.input, staticStyles.halfInput]}
          />

          <TextInput
            label="Price ($)"
            mode="outlined"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            style={[staticStyles.input, staticStyles.halfInput]}
          />
        </View>

        <Text variant="labelLarge" style={staticStyles.label}>
          Weight (for price comparison)
        </Text>
        <View style={staticStyles.row}>
          <TextInput
            label="Weight"
            mode="outlined"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            style={[staticStyles.input, staticStyles.halfInput]}
          />
          <View style={staticStyles.halfInput}>
            <SegmentedButtons
              value={weightUnit}
              onValueChange={val => setWeightUnit(val as WeightUnit)}
              buttons={WEIGHT_UNIT_OPTIONS}
              density="small"
            />
          </View>
        </View>

        <TextInput
          label="Notes (optional)"
          mode="outlined"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={staticStyles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          style={dynamicStyles.saveBtn}>
          Add to Cart
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          disabled={loading}
          style={staticStyles.cancelBtn}>
          Cancel
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const staticStyles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1},
  content: {padding: 16},
  input: {marginBottom: 12},
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {marginBottom: 8, marginTop: 8},
  cancelBtn: {marginTop: 8},
});
