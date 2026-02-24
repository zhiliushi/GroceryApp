import React, {useEffect, useState, useCallback} from 'react';
import {View, ScrollView, StyleSheet, Alert, Platform} from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  Divider,
  List,
  Portal,
  Dialog,
  IconButton,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import {useSettingsStore} from '../../store/settingsStore';
import {capitaliseLocation} from '../../utils/locationUtils';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type ShoppingList from '../../database/models/ShoppingList';
import type ListItem from '../../database/models/ListItem';
import type Store from '../../database/models/Store';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ShoppingCheckout'>;

export default function ShoppingCheckoutScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const {listId} = route.params as {listId: string};
  const {shoppingList: listRepo, store: storeRepo} = useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();
  const userId = user?.uid ?? 'local';
  const {storageLocations, defaultStorageLocation} = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState<ShoppingList | null>(null);
  const [purchasedItems, setPurchasedItems] = useState<ListItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [defaultLocation, setDefaultLocation] = useState(defaultStorageLocation);
  const [locationOverrides, setLocationOverrides] = useState<Record<string, string>>({});
  const [expiryDateOverrides, setExpiryDateOverrides] = useState<Record<string, number>>({});
  const [datePickerItemId, setDatePickerItemId] = useState<string | null>(null);
  const [showNewStoreDialog, setShowNewStoreDialog] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const foundList = await listRepo.getById(listId);
      setList(foundList);

      const items = await listRepo.getListItems(listId);
      setPurchasedItems(items.filter(i => i.isPurchased));

      const userStores = await storeRepo.getByUserId(userId);
      setStores(userStores);
    } catch (error) {
      console.error('Failed to load checkout data:', error);
    } finally {
      setLoading(false);
    }
  }, [listRepo, storeRepo, listId, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPrice = purchasedItems.reduce((sum, item) => {
    if (item.price != null) return sum + item.price * item.quantity;
    return sum;
  }, 0);

  const handleCreateStore = async () => {
    const name = newStoreName.trim();
    if (!name) return;
    try {
      const newStore = await storeRepo.create({name, userId});
      setStores(prev => [...prev, newStore]);
      setSelectedStoreId(newStore.id);
      setNewStoreName('');
      setShowNewStoreDialog(false);
    } catch {
      Alert.alert('Error', 'Failed to create store.');
    }
  };

  const handleLocationChange = (itemId: string, location: string) => {
    setLocationOverrides(prev => ({...prev, [itemId]: location}));
  };

  const handleSetExpiryDate = (itemId: string) => {
    setDatePickerItemId(itemId);
  };

  const handleExpiryDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setDatePickerItemId(null);
    if (selectedDate && datePickerItemId) {
      setExpiryDateOverrides(prev => ({
        ...prev,
        [datePickerItemId]: selectedDate.getTime(),
      }));
    }
  };

  const handleRemoveExpiryDate = (itemId: string) => {
    setExpiryDateOverrides(prev => {
      const next = {...prev};
      delete next[itemId];
      return next;
    });
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const handleCheckout = async () => {
    if (!selectedStoreId) {
      Alert.alert('Select Store', 'Please select or create a store.');
      return;
    }
    if (!list) return;

    setSubmitting(true);
    try {
      await listRepo.checkoutList(list, {
        storeId: selectedStoreId,
        userId,
        defaultLocation,
        locationOverrides,
        expiryDateOverrides,
      });

      Alert.alert('Success', 'Items added to inventory!', [
        {
          text: 'OK',
          onPress: () => navigation.getParent()?.navigate('InventoryTab'),
        },
      ]);
    } catch (error) {
      console.error('Checkout failed:', error);
      Alert.alert('Error', 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading checkout..." />;
  }

  if (purchasedItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="titleMedium">No purchased items to checkout</Text>
        <Button mode="text" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Store selection */}
        <Card style={styles.section}>
          <Card.Title title="Select Store" />
          <Card.Content>
            {stores.length > 0 ? (
              <View style={styles.storeList}>
                {stores.map(s => (
                  <Button
                    key={s.id}
                    mode={selectedStoreId === s.id ? 'contained' : 'outlined'}
                    onPress={() => setSelectedStoreId(s.id)}
                    style={styles.storeBtn}
                    compact>
                    {s.name}
                  </Button>
                ))}
              </View>
            ) : (
              <Text variant="bodyMedium" style={{color: colors.textSecondary, fontStyle: 'italic'}}>
                No stores saved yet
              </Text>
            )}
            <Button
              mode="text"
              icon="plus"
              onPress={() => setShowNewStoreDialog(true)}
              style={styles.addStoreBtn}>
              Add New Store
            </Button>
          </Card.Content>
        </Card>

        {/* Default storage location */}
        <Card style={styles.section}>
          <Card.Title title="Default Storage Location" />
          <Card.Content>
            <View style={styles.locationChips}>
              {storageLocations.map(loc => (
                <Button
                  key={loc}
                  mode={defaultLocation === loc ? 'contained' : 'outlined'}
                  onPress={() => setDefaultLocation(loc)}
                  style={styles.storeBtn}
                  compact>
                  {capitaliseLocation(loc)}
                </Button>
              ))}
            </View>
            <Text variant="bodySmall" style={{color: colors.textTertiary, marginTop: 8}}>
              Items will be stored here by default
            </Text>
          </Card.Content>
        </Card>

        {/* Items with per-item overrides */}
        <Card style={styles.section}>
          <Card.Title title="Items" />
          <Card.Content>
            {purchasedItems.map((item, index) => {
              const itemLocation = locationOverrides[item.id] ?? defaultLocation;
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <Divider style={[styles.itemDivider, {backgroundColor: colors.border}]} />}
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text variant="bodyLarge" numberOfLines={1}>
                        {item.itemName}
                      </Text>
                      <Text variant="bodySmall" style={{color: colors.textSecondary}}>
                        Qty: {item.quantity}
                        {item.price != null && ` · $${item.price.toFixed(2)}`}
                      </Text>
                      {expiryDateOverrides[item.id] ? (
                        <View style={styles.expiryRow}>
                          <Text variant="bodySmall" style={{color: colors.success, fontWeight: '500'}}>
                            Expires: {formatDate(expiryDateOverrides[item.id])}
                          </Text>
                          <IconButton
                            icon="close-circle-outline"
                            size={16}
                            onPress={() => handleRemoveExpiryDate(item.id)}
                            style={styles.expiryRemoveBtn}
                          />
                        </View>
                      ) : (
                        <Button
                          mode="text"
                          icon="calendar-plus"
                          compact
                          onPress={() => handleSetExpiryDate(item.id)}
                          labelStyle={styles.setExpiryLabel}>
                          Set Expiry
                        </Button>
                      )}
                    </View>
                    <List.Accordion
                      title={capitaliseLocation(itemLocation)}
                      titleStyle={styles.locationTitle}
                      style={styles.locationAccordion}>
                      {storageLocations.map(loc => (
                        <List.Item
                          key={loc}
                          title={capitaliseLocation(loc)}
                          onPress={() => handleLocationChange(item.id, loc)}
                          left={props =>
                            itemLocation === loc ? (
                              <List.Icon {...props} icon="check" />
                            ) : null
                          }
                        />
                      ))}
                    </List.Accordion>
                  </View>
                </React.Fragment>
              );
            })}
          </Card.Content>
        </Card>

        {/* Total */}
        {totalPrice > 0 && (
          <Card style={styles.section}>
            <Card.Content>
              <View style={styles.totalRow}>
                <Text variant="titleLarge">Total</Text>
                <Text variant="headlineMedium" style={{color: colors.textPrimary, fontWeight: '700'}}>
                  ${totalPrice.toFixed(2)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Checkout button */}
      <View style={[styles.footer, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
        <Button
          mode="contained"
          onPress={handleCheckout}
          loading={submitting}
          disabled={submitting || !selectedStoreId}
          style={{backgroundColor: colors.accent}}
          contentStyle={styles.checkoutBtnContent}>
          Confirm Purchase
        </Button>
      </View>

      {/* Date picker */}
      {datePickerItemId && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleExpiryDateChange}
        />
      )}

      {/* New store dialog */}
      <Portal>
        <Dialog
          visible={showNewStoreDialog}
          onDismiss={() => setShowNewStoreDialog(false)}>
          <Dialog.Title>Add New Store</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Store Name"
              mode="outlined"
              value={newStoreName}
              onChangeText={setNewStoreName}
              placeholder="e.g., Walmart, Costco"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNewStoreDialog(false)}>Cancel</Button>
            <Button onPress={handleCreateStore} disabled={!newStoreName.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollContent: {padding: 12, paddingBottom: 100},
  section: {marginBottom: 12, borderRadius: 12},
  storeList: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  locationChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  storeBtn: {marginBottom: 4},
  addStoreBtn: {marginTop: 8, alignSelf: 'flex-start'},
  itemDivider: {marginVertical: 8},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemInfo: {flex: 1, marginRight: 8},
  locationAccordion: {padding: 0, backgroundColor: 'transparent'},
  locationTitle: {fontSize: 14},
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  checkoutBtnContent: {paddingVertical: 8},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  expiryRow: {flexDirection: 'row', alignItems: 'center', marginTop: 2},
  expiryRemoveBtn: {margin: 0, marginLeft: -4},
  setExpiryLabel: {fontSize: 12},
});
