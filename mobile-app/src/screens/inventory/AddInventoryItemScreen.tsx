import React, {useState} from 'react';
import {View, ScrollView, FlatList, StyleSheet, Alert, Platform} from 'react-native';
import {Text, TextInput, Button, Chip, IconButton} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import {useAuthStore} from '../../store/authStore';
import {useSettingsStore} from '../../store/settingsStore';
import {capitaliseLocation} from '../../utils/locationUtils';

type Props = NativeStackScreenProps<any, 'AddItem'>;

export default function AddInventoryItemScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const {category: categoryRepo, unit: unitRepo, inventory} = useDatabase();
  const {storageLocations, defaultStorageLocation} = useSettingsStore();
  const {user} = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Pre-fill from barcode scanner if available
  const params = route.params as {
    barcode?: string;
    productName?: string;
    brand?: string;
    category?: string;
    imageUrl?: string;
    isNewProduct?: boolean;
  } | undefined;

  // Item needs review if: manual add (no barcode), or barcode not found in API
  const needsReview = !params?.barcode || params?.isNewProduct === true || !params?.productName;

  const [name, setName] = useState(params?.productName ?? '');
  const [barcode, setBarcode] = useState(params?.barcode ?? '');
  const [brand, setBrand] = useState(params?.brand ?? '');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState(defaultStorageLocation);
  const [notes, setNotes] = useState('');

  // Expiry date state
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [expiryConfirmed, setExpiryConfirmed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setExpiryDate(selectedDate);
      setExpiryConfirmed(true);
    }
  };

  const handleNoExpiry = () => {
    setExpiryDate(null);
    setExpiryConfirmed(true);
  };

  const handleClearExpiry = () => {
    setExpiryDate(null);
    setExpiryConfirmed(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }

    setLoading(true);
    try {
      const categories = await categoryRepo.getAll();
      const units = await unitRepo.getAll();

      const defaultCategory = categories.find(c => c.name === 'Other') || categories[0];
      const defaultUnit = units.find(u => u.abbreviation === 'pcs') || units[0];

      if (!defaultCategory || !defaultUnit) {
        Alert.alert('Error', 'Database not initialized. Please restart the app.');
        return;
      }

      await inventory.insert({
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        brand: brand.trim() || undefined,
        categoryId: defaultCategory.id,
        quantity: parseInt(quantity, 10) || 1,
        unitId: defaultUnit.id,
        location,
        notes: notes.trim() || undefined,
        userId: user?.uid ?? 'local',
        expiryDate: expiryDate ?? undefined,
        needsReview,
      });

      Alert.alert('Success', 'Item added to inventory', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (err: any) {
      console.error('Failed to save item:', err);
      Alert.alert('Error', 'Failed to save item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TextInput
          label="Product Name *"
          mode="outlined"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <TextInput
          label="Barcode (optional)"
          mode="outlined"
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="Brand (optional)"
          mode="outlined"
          value={brand}
          onChangeText={setBrand}
          style={styles.input}
        />

        <TextInput
          label="Quantity"
          mode="outlined"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          style={styles.input}
        />

        {/* Expiry Date Section */}
        <Text variant="labelLarge" style={styles.label}>
          Expiry Date
        </Text>
        <View style={styles.expiryRow}>
          {expiryDate ? (
            <View style={[styles.expiryDateDisplay, {backgroundColor: colors.surfaceVariant}]}>
              <IconButton icon="calendar-check" iconColor={colors.success} size={20} style={styles.expiryIcon} />
              <Text variant="bodyMedium" style={[styles.expiryDateText, {color: colors.success}]}>
                {formatDate(expiryDate)}
              </Text>
              <IconButton icon="close" size={18} onPress={handleClearExpiry} />
            </View>
          ) : expiryConfirmed ? (
            <View style={[styles.expiryDateDisplay, {backgroundColor: colors.surfaceVariant}]}>
              <IconButton icon="infinity" iconColor={colors.accent} size={20} style={styles.expiryIcon} />
              <Text variant="bodyMedium" style={[styles.noExpiryText, {color: colors.accent}]}>
                No expiry date
              </Text>
              <IconButton icon="close" size={18} onPress={handleClearExpiry} />
            </View>
          ) : (
            <Text variant="bodySmall" style={styles.expiryHint}>
              Set an expiry date or mark as no expiry
            </Text>
          )}
        </View>
        <View style={styles.expiryActions}>
          <Button
            mode="outlined"
            icon="calendar"
            onPress={() => setShowDatePicker(true)}
            style={styles.expiryBtn}
            compact>
            {expiryDate ? 'Change Date' : 'Set Expiry Date'}
          </Button>
          {!expiryConfirmed && (
            <Button
              mode="outlined"
              icon="infinity"
              onPress={handleNoExpiry}
              style={styles.expiryBtn}
              compact>
              No Expiry
            </Button>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={expiryDate ?? new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        <Text variant="labelLarge" style={styles.label}>
          Storage Location
        </Text>
        <FlatList
          data={storageLocations}
          horizontal
          keyExtractor={l => l}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.locationChips}
          renderItem={({item: loc}) => (
            <Chip
              selected={location === loc}
              onPress={() => setLocation(loc)}
              style={[styles.locationChip, {backgroundColor: colors.surfaceVariant}, location === loc && {backgroundColor: colors.accent}]}
              textStyle={location === loc ? {color: colors.textInverse} : undefined}
              showSelectedCheck={false}>
              {capitaliseLocation(loc)}
            </Chip>
          )}
        />

        <TextInput
          label="Notes (optional)"
          mode="outlined"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          buttonColor={colors.accent}
          style={styles.saveBtn}>
          Add to Inventory
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          disabled={loading}
          style={styles.cancelBtn}>
          Cancel
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1},
  content: {padding: 16},
  input: {marginBottom: 12},
  label: {marginBottom: 8, marginTop: 8},
  saveBtn: {marginTop: 16},
  cancelBtn: {marginTop: 8},
  expiryRow: {marginBottom: 8},
  expiryDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  expiryIcon: {margin: 0},
  expiryDateText: {flex: 1, fontWeight: '500'},
  noExpiryText: {flex: 1, fontWeight: '500'},
  expiryHint: {opacity: 0.6, fontStyle: 'italic'},
  expiryActions: {flexDirection: 'row', gap: 8, marginBottom: 16},
  expiryBtn: {flex: 1},
  locationChips: {gap: 8, paddingVertical: 4, marginBottom: 16},
  locationChip: {},
});
