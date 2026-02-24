import React, {useEffect, useState, useCallback} from 'react';
import {View, ScrollView, StyleSheet, Platform} from 'react-native';
import {Text, Button, TextInput} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useDatabase} from '../../hooks/useDatabase';
import {useToast} from '../../components/common/ToastProvider';
import {useAppTheme} from '../../hooks/useAppTheme';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type ListItem from '../../database/models/ListItem';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'EditListItem'>;

export default function EditListItemScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const {itemId} = route.params as {itemId: string};
  const {shoppingList} = useDatabase();
  const {showSuccess, showError} = useToast();
  const {colors} = useAppTheme();

  const [item, setItem] = useState<ListItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      // Find item across all lists
      const allLists = await shoppingList.getAllIncludingCompleted();
      for (const list of allLists) {
        const items = await shoppingList.getListItems(list.id);
        const found = items.find(i => i.id === itemId);
        if (found) {
          setItem(found);
          setPrice(found.price != null ? String(found.price) : '');
          setQuantity(String(found.quantity));
          setNotes(found.notes ?? '');
          break;
        }
      }
    } catch {
      showError('Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [shoppingList, itemId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const priceVal = price.trim() ? parseFloat(price) : null;
      const qtyVal = quantity.trim() ? parseInt(quantity, 10) : item.quantity;

      await shoppingList.updateItem(item, {
        price: priceVal,
        quantity: qtyVal > 0 ? qtyVal : 1,
        notes: notes.trim() || null,
      });
      showSuccess('Item updated');
      navigation.goBack();
    } catch {
      showError('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setExpiryDate(selectedDate);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading item..." />;
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Item not found</Text>
        <Button mode="text" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.background}]} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        {item.itemName}
      </Text>
      {item.brand && (
        <Text style={{color: colors.textSecondary, marginBottom: 16}}>{item.brand}</Text>
      )}

      <TextInput
        label="Price"
        mode="outlined"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        left={<TextInput.Affix text="$" />}
        style={styles.input}
      />

      <TextInput
        label="Quantity"
        mode="outlined"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        style={styles.input}
      />

      <TextInput
        label="Notes / Instructions"
        mode="outlined"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        style={styles.input}
        placeholder="e.g. Lady's Choice preferred, if not available buy others"
      />

      <View style={styles.expirySection}>
        <Text variant="labelLarge" style={{marginBottom: 8, color: colors.textSecondary}}>
          Expiry Date
        </Text>
        {expiryDate ? (
          <View style={styles.expiryRow}>
            <Text style={styles.expiryText}>
              {expiryDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Button
              mode="text"
              compact
              onPress={() => setExpiryDate(null)}>
              Clear
            </Button>
          </View>
        ) : (
          <Button
            mode="outlined"
            icon="calendar-plus"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateBtn}>
            Set Expiry Date
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

      <Button
        mode="contained"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={[styles.saveBtn, {backgroundColor: colors.accent}]}>
        Save
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 20, paddingBottom: 40},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {marginBottom: 4},
  input: {marginBottom: 16},
  expirySection: {marginBottom: 24},
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiryText: {fontSize: 16, fontWeight: '500'},
  dateBtn: {alignSelf: 'flex-start'},
  saveBtn: {marginTop: 8},
});
