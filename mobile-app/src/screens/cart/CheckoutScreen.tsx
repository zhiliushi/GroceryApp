import React, {useEffect, useState, useCallback, useMemo} from 'react';
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
import Loading from '../../components/common/Loading';
import type CartItem from '../../database/models/CartItem';
import type Store from '../../database/models/Store';
import {useSettingsStore} from '../../store/settingsStore';
import {capitaliseLocation} from '../../utils/locationUtils';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Checkout'>;

export default function CheckoutScreen({navigation}: Props): React.JSX.Element {
  const {cart, store: storeRepo, category: categoryRepo, shoppingList} = useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();
  const userId = user?.uid ?? 'local';
  const {storageLocations, defaultStorageLocation} = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [defaultLocation, setDefaultLocation] = useState(defaultStorageLocation);
  const [locationOverrides, setLocationOverrides] = useState<
    Record<string, string>
  >({});
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(
    null,
  );
  const [totalPrice, setTotalPrice] = useState(0);
  const [showNewStoreDialog, setShowNewStoreDialog] = useState(false);
  const [expiryDateOverrides, setExpiryDateOverrides] = useState<
    Record<string, number>
  >({});
  const [datePickerItemId, setDatePickerItemId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load cart items
      const items = await cart.getAll(userId);
      setCartItems(items);

      // Load total price
      const total = await cart.getTotalPrice(userId);
      setTotalPrice(total);

      // Load stores
      const userStores = await storeRepo.getByUserId(userId);
      setStores(userStores);

      // Load default category (first one or 'Other')
      const categories = await categoryRepo.getAll();
      const otherCat = categories.find(c => c.name === 'Other');
      setDefaultCategoryId(otherCat?.id ?? categories[0]?.id ?? null);

      // Default location comes from settingsStore (already set in state init)
    } catch (error) {
      console.error('Failed to load checkout data:', error);
    } finally {
      setLoading(false);
    }
  }, [cart, storeRepo, categoryRepo, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleCreateStore = async () => {
    const name = newStoreName.trim();
    if (!name) return;

    try {
      const newStore = await storeRepo.create({name, userId});
      setStores(prev => [...prev, newStore]);
      setSelectedStoreId(newStore.id);
      setNewStoreName('');
      setShowNewStoreDialog(false);
    } catch (error) {
      console.error('Failed to create store:', error);
      Alert.alert('Error', 'Failed to create store. Please try again.');
    }
  };

  const handleLocationChange = (itemId: string, location: string) => {
    setLocationOverrides(prev => ({
      ...prev,
      [itemId]: location,
    }));
  };

  const handleDefaultLocationChange = (location: string) => {
    setDefaultLocation(location);
  };

  const handleSetExpiryDate = (itemId: string) => {
    setDatePickerItemId(itemId);
  };

  const handleExpiryDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setDatePickerItemId(null);
    }
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

    if (!defaultCategoryId) {
      Alert.alert('Error', 'No category available. Please restart the app.');
      return;
    }

    setSubmitting(true);
    try {
      // Build item summaries before checkout (cart items get deleted)
      const itemSummaries = cartItems.map(ci => ({
        barcode: ci.barcode,
        name: ci.name,
      }));

      await cart.checkout({
        storeId: selectedStoreId,
        userId,
        categoryId: defaultCategoryId,
        defaultLocation,
        locationOverrides,
        expiryDateOverrides,
      });

      // Cross-reference: auto-tick matching shopping list items
      let tickedCount = 0;
      try {
        tickedCount = await shoppingList.crossReferenceAfterCheckout(
          itemSummaries,
          userId,
        );
      } catch {
        // Non-critical — don't block checkout success
      }

      const msg = tickedCount > 0
        ? `Items added to inventory! ${tickedCount} shopping list item${tickedCount !== 1 ? 's' : ''} auto-ticked.`
        : 'Items added to inventory!';

      Alert.alert('Success', msg, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('InventoryTab'),
        },
      ]);
    } catch (error) {
      console.error('Checkout failed:', error);
      Alert.alert('Error', 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Dynamic styles
  // ---------------------------------------------------------------------------

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        noStores: {
          color: colors.textTertiary,
          fontStyle: 'italic',
        },
        hint: {
          color: colors.textTertiary,
          marginTop: 8,
        },
        itemMeta: {
          color: colors.textTertiary,
        },
        totalPrice: {
          color: colors.success,
          fontWeight: '700',
        },
        footer: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        checkoutBtn: {
          backgroundColor: colors.accent,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        expiryLabel: {
          color: colors.success,
          fontWeight: '500',
        },
      }),
    [colors],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <Loading message="Loading checkout..." />;
  }

  if (cartItems.length === 0) {
    return (
      <View style={dynamicStyles.emptyContainer}>
        <Text style={staticStyles.emptyIcon}>🛒</Text>
        <Text variant="titleMedium">Cart is empty</Text>
        <Button mode="text" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView contentContainerStyle={staticStyles.scrollContent}>
        {/* Store selection */}
        <Card style={staticStyles.section}>
          <Card.Title title="Select Store" />
          <Card.Content>
            {stores.length > 0 ? (
              <View style={staticStyles.storeList}>
                {stores.map(s => (
                  <Button
                    key={s.id}
                    mode={selectedStoreId === s.id ? 'contained' : 'outlined'}
                    onPress={() => setSelectedStoreId(s.id)}
                    style={staticStyles.storeBtn}
                    compact>
                    {s.name}
                  </Button>
                ))}
              </View>
            ) : (
              <Text variant="bodyMedium" style={dynamicStyles.noStores}>
                No stores saved yet
              </Text>
            )}
            <Button
              mode="text"
              icon="plus"
              onPress={() => setShowNewStoreDialog(true)}
              style={staticStyles.addStoreBtn}>
              Add New Store
            </Button>
          </Card.Content>
        </Card>

        {/* Default storage location */}
        <Card style={staticStyles.section}>
          <Card.Title title="Default Storage Location" />
          <Card.Content>
            <View style={staticStyles.locationChips}>
              {storageLocations.map(loc => (
                <Button
                  key={loc}
                  mode={defaultLocation === loc ? 'contained' : 'outlined'}
                  onPress={() => handleDefaultLocationChange(loc)}
                  style={staticStyles.storeBtn}
                  compact>
                  {capitaliseLocation(loc)}
                </Button>
              ))}
            </View>
            <Text variant="bodySmall" style={dynamicStyles.hint}>
              Items will be stored here by default
            </Text>
          </Card.Content>
        </Card>

        {/* Items summary with per-item location override */}
        <Card style={staticStyles.section}>
          <Card.Title title="Items" />
          <Card.Content>
            {cartItems.map((item, index) => {
              const itemLocation =
                locationOverrides[item.id] ?? defaultLocation;
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <Divider style={staticStyles.itemDivider} />}
                  <View style={staticStyles.itemRow}>
                    <View style={staticStyles.itemInfo}>
                      <Text variant="bodyLarge" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text variant="bodySmall" style={dynamicStyles.itemMeta}>
                        Qty: {item.quantity}
                        {item.price !== null && ` • $${item.price.toFixed(2)}`}
                      </Text>
                      {/* Per-item expiry date */}
                      {expiryDateOverrides[item.id] ? (
                        <View style={staticStyles.expiryRow}>
                          <Text variant="bodySmall" style={dynamicStyles.expiryLabel}>
                            Expires: {formatDate(expiryDateOverrides[item.id])}
                          </Text>
                          <IconButton
                            icon="close-circle-outline"
                            size={16}
                            onPress={() => handleRemoveExpiryDate(item.id)}
                            style={staticStyles.expiryRemoveBtn}
                          />
                        </View>
                      ) : (
                        <Button
                          mode="text"
                          icon="calendar-plus"
                          compact
                          onPress={() => handleSetExpiryDate(item.id)}
                          labelStyle={staticStyles.setExpiryLabel}>
                          Set Expiry
                        </Button>
                      )}
                    </View>
                    <List.Accordion
                      title={
                        itemLocation.charAt(0).toUpperCase() +
                        itemLocation.slice(1)
                      }
                      titleStyle={staticStyles.locationTitle}
                      style={staticStyles.locationAccordion}>
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
        <Card style={staticStyles.section}>
          <Card.Content>
            <View style={staticStyles.totalRow}>
              <Text variant="titleLarge">Total</Text>
              <Text variant="headlineMedium" style={dynamicStyles.totalPrice}>
                ${totalPrice.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Checkout button */}
      <View style={dynamicStyles.footer}>
        <Button
          mode="contained"
          onPress={handleCheckout}
          loading={submitting}
          disabled={submitting || !selectedStoreId}
          style={dynamicStyles.checkoutBtn}
          contentStyle={staticStyles.checkoutBtnContent}>
          Confirm Purchase
        </Button>
      </View>

      {/* Date picker for expiry */}
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

const staticStyles = StyleSheet.create({
  scrollContent: {
    padding: 12,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 12,
    borderRadius: 12,
  },
  storeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storeBtn: {
    marginBottom: 4,
  },
  addStoreBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  itemDivider: {
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  locationAccordion: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  locationTitle: {
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkoutBtnContent: {
    paddingVertical: 8,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  expiryRemoveBtn: {
    margin: 0,
    marginLeft: -4,
  },
  setExpiryLabel: {
    fontSize: 12,
  },
});
