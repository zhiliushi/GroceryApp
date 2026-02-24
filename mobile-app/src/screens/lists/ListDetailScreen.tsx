import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import {
  Text,
  FAB,
  IconButton,
  Checkbox,
  ProgressBar,
  Portal,
  Dialog,
  Button,
  Divider,
  Menu,
  TextInput,
} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import {desaturateCategory} from '../../config/theme';
import Loading from '../../components/common/Loading';
import type ListItem from '../../database/models/ListItem';
import type Category from '../../database/models/Category';
import type Unit from '../../database/models/Unit';
import type ShoppingList from '../../database/models/ShoppingList';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ListDetail'>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SectionData {
  title: string;
  color: string;
  icon: string;
  data: ListItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ListDetailScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const {listId, listName} = route.params as {listId: string; listName?: string};
  const {shoppingList, category: categoryRepo, unit: unitRepo, cart} = useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [units, setUnits] = useState<Map<string, Unit>>(new Map());
  const [loading, setLoading] = useState(true);

  // Rename dialog
  const [renameVisible, setRenameVisible] = useState(false);
  const [editName, setEditName] = useState('');

  // Trip notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [tripNotes, setTripNotes] = useState('');

  // Edit quantity dialog
  const [editItem, setEditItem] = useState<ListItem | null>(null);
  const [editQty, setEditQty] = useState('');

  // More menu
  const [menuVisible, setMenuVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);

    const [fetchedList, fetchedItems, allCategories, allUnits] = await Promise.all([
      shoppingList.getById(listId),
      shoppingList.getListItems(listId),
      categoryRepo.getAll(),
      unitRepo.getAll(),
    ]);

    setList(fetchedList);
    setItems(fetchedItems);

    const catMap = new Map<string, Category>();
    allCategories.forEach(c => catMap.set(c.id, c));
    setCategories(catMap);

    const unitMap = new Map<string, Unit>();
    allUnits.forEach(u => unitMap.set(u.id, u));
    setUnits(unitMap);

    // Set header title
    navigation.setOptions({title: fetchedList.name});

    setLoading(false);
  }, [shoppingList, categoryRepo, unitRepo, listId, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  // Set initial title from navigation params
  useEffect(() => {
    if (listName) {
      navigation.setOptions({title: listName});
    }
  }, [listName, navigation]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const totalItems = items.length;
  const purchasedItems = items.filter(i => i.isPurchased).length;
  const progress = totalItems > 0 ? purchasedItems / totalItems : 0;

  // Group items by category
  const sections: SectionData[] = useMemo(() => {
    if (items.length === 0) return [];

    const grouped: Record<string, ListItem[]> = {};
    for (const item of items) {
      const key = item.categoryId || 'uncategorized';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    return Object.entries(grouped)
      .map(([catId, catItems]) => {
        const cat = categories.get(catId);
        return {
          title: cat?.name ?? 'Other',
          color: cat?.color ?? '#6B7D87',
          icon: cat?.icon ?? 'tag',
          data: catItems.sort((a, b) => {
            // Unpurchased first, then by name
            if (a.isPurchased !== b.isPurchased) return a.isPurchased ? 1 : -1;
            return a.itemName.localeCompare(b.itemName);
          }),
        };
      })
      .sort((a, b) => {
        // Sections with all items purchased go to bottom
        const aAllDone = a.data.every(i => i.isPurchased);
        const bAllDone = b.data.every(i => i.isPurchased);
        if (aAllDone !== bAllDone) return aAllDone ? 1 : -1;
        return a.title.localeCompare(b.title);
      });
  }, [items, categories]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleToggle = async (item: ListItem) => {
    await shoppingList.markPurchased(item);
    load();
  };

  const handleTappedPurchased = (item: ListItem) => {
    // Ticked item → navigate to EditListItem for price/expiry/qty
    navigation.navigate('EditListItem', {itemId: item.id});
  };

  const handleRemove = async (item: ListItem) => {
    Alert.alert('Remove Item', `Remove "${item.itemName}" from the list?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await shoppingList.deleteItem(item);
          load();
        },
      },
    ]);
  };

  const handleEditQuantity = async () => {
    if (!editItem) return;
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) return;
    await shoppingList.updateItem(editItem, {quantity: qty});
    setEditItem(null);
    setEditQty('');
    load();
  };

  const handleRename = async () => {
    const name = editName.trim();
    if (!name || !list) return;
    await shoppingList.renameList(list, name);
    setRenameVisible(false);
    navigation.setOptions({title: name});
    load();
  };

  const handleSaveNotes = async () => {
    if (!list) return;
    const notes = tripNotes.trim() || null;
    await shoppingList.updateListNotes(list, notes);
    setEditingNotes(false);
    load();
  };

  const handleSendToCart = async () => {
    setMenuVisible(false);
    if (!user) return;
    try {
      const result = await shoppingList.sendListToCart(
        listId,
        user.uid ?? 'local',
        cart,
      );
      Alert.alert(
        'Sent to Cart',
        `${result.sent} item${result.sent !== 1 ? 's' : ''} added to cart` +
          (result.skipped > 0 ? `, ${result.skipped} already in cart` : ''),
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send to cart');
    }
  };

  const handleMarkAllPurchased = async () => {
    setMenuVisible(false);
    await shoppingList.markAllPurchased(listId);
    load();
  };

  const handleMarkComplete = async () => {
    setMenuVisible(false);
    if (!list) return;
    await shoppingList.markCompleted(list);
    navigation.goBack();
  };

  const handleCheckout = () => {
    navigation.navigate('ShoppingCheckout', {listId});
  };

  // ---------------------------------------------------------------------------
  // Header menu
  // ---------------------------------------------------------------------------

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
          }>
          <Menu.Item
            leadingIcon="pencil"
            onPress={() => {
              setMenuVisible(false);
              setEditName(list?.name ?? '');
              setRenameVisible(true);
            }}
            title="Rename List"
          />
          <Menu.Item
            leadingIcon="cart-arrow-down"
            onPress={handleSendToCart}
            title="Send to Cart"
          />
          <Menu.Item
            leadingIcon="check-all"
            onPress={handleMarkAllPurchased}
            title="Mark All Purchased"
          />
          <Divider />
          <Menu.Item
            leadingIcon="check-circle-outline"
            onPress={handleMarkComplete}
            title="Complete List"
          />
        </Menu>
      ),
    });
  }, [navigation, menuVisible, list]);

  // ---------------------------------------------------------------------------
  // Render item row
  // ---------------------------------------------------------------------------

  const isCheckedOut = list?.isCheckedOut ?? false;

  const renderItem = ({item}: {item: ListItem}) => {
    const unitObj = units.get(item.unitId);
    const unitLabel = unitObj?.abbreviation ?? '';

    return (
      <View style={[styles.row, {backgroundColor: colors.surface}, item.isPurchased && styles.rowPurchased]}>
        {!isCheckedOut && (
          <Checkbox
            status={item.isPurchased ? 'checked' : 'unchecked'}
            onPress={() => handleToggle(item)}
            color={colors.accent}
          />
        )}

        <Pressable
          style={styles.itemInfo}
          onPress={() => {
            if (isCheckedOut) return;
            if (item.isPurchased) {
              handleTappedPurchased(item);
            } else {
              handleToggle(item);
            }
          }}
          onLongPress={() => {
            if (isCheckedOut) return;
            setEditItem(item);
            setEditQty(String(item.quantity));
          }}>
          <Text
            variant="bodyLarge"
            style={[styles.itemName, item.isPurchased && styles.checkedText]}>
            {item.itemName}
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.itemMeta, {color: colors.textTertiary}, item.isPurchased && styles.checkedText]}>
            {item.quantity} {unitLabel}
            {item.price != null && ` · $${item.price.toFixed(2)}`}
          </Text>
          {item.notes ? (
            <Text
              variant="bodySmall"
              numberOfLines={2}
              style={[styles.itemNotes, {color: colors.accent}]}>
              {item.notes}
            </Text>
          ) : null}
        </Pressable>

        {!isCheckedOut && (
          <IconButton
            icon="close"
            size={18}
            iconColor={colors.textTertiary}
            onPress={() => handleRemove(item)}
          />
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render section header
  // ---------------------------------------------------------------------------

  const renderSectionHeader = ({section}: {section: SectionData}) => {
    const sectionPurchased = section.data.filter(i => i.isPurchased).length;
    const sectionTotal = section.data.length;

    return (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, {backgroundColor: desaturateCategory(section.color)}]} />
        <Text variant="titleSmall" style={styles.sectionTitle}>
          {section.title}
        </Text>
        <Text variant="bodySmall" style={{color: colors.textTertiary}}>
          {sectionPurchased}/{sectionTotal}
        </Text>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  if (loading && items.length === 0) {
    return <Loading message="Loading list..." />;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Progress header */}
      <View style={[styles.progressContainer, {backgroundColor: colors.surface}]}>
        <View style={styles.progressTextRow}>
          <Text variant="bodyMedium" style={{color: colors.textSecondary}}>
            {purchasedItems} of {totalItems} items
          </Text>
          <Text variant="bodyMedium" style={styles.progressPercent}>
            {totalItems > 0 ? Math.round(progress * 100) : 0}%
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          color={progress === 1 ? colors.success : colors.accent}
          style={styles.progressBar}
        />
      </View>

      {/* Trip notes card — editable for active lists, read-only for purchase records */}
      {list && (isCheckedOut ? !!list.notes : true) && (
        <View style={[styles.notesCard, {backgroundColor: colors.surface}]}>
          {isCheckedOut ? (
            <Text variant="bodySmall" style={{color: colors.textSecondary}}>
              {list.notes}
            </Text>
          ) : editingNotes ? (
            <View>
              <TextInput
                mode="outlined"
                placeholder="Trip notes / instructions"
                value={tripNotes}
                onChangeText={setTripNotes}
                multiline
                numberOfLines={3}
                dense
                autoFocus
              />
              <View style={styles.notesActions}>
                <Button
                  compact
                  onPress={() => {
                    setEditingNotes(false);
                    setTripNotes(list.notes ?? '');
                  }}>
                  Cancel
                </Button>
                <Button compact mode="contained" onPress={handleSaveNotes} buttonColor={colors.accent}>
                  Save
                </Button>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setTripNotes(list.notes ?? '');
                setEditingNotes(true);
              }}
              style={styles.notesTappable}>
              {list.notes ? (
                <Text variant="bodySmall" style={{color: colors.textSecondary}}>
                  {list.notes}
                </Text>
              ) : (
                <Text variant="bodySmall" style={{color: colors.textTertiary, fontStyle: 'italic'}}>
                  Tap to add trip notes...
                </Text>
              )}
              <IconButton icon="pencil-outline" size={16} iconColor={colors.textTertiary} style={{margin: 0}} />
            </Pressable>
          )}
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="titleMedium" style={{color: colors.textSecondary}}>
              No items yet
            </Text>
            <Text variant="bodyMedium" style={{color: colors.textTertiary, marginTop: 4}}>
              Tap + to add items to this list
            </Text>
          </View>
        }
      />

      {/* Rename dialog */}
      <Portal>
        <Dialog visible={renameVisible} onDismiss={() => setRenameVisible(false)}>
          <Dialog.Title>Rename List</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={editName}
              onChangeText={setEditName}
              onSubmitEditing={handleRename}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameVisible(false)}>Cancel</Button>
            <Button onPress={handleRename} disabled={!editName.trim()}>
              Rename
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit quantity dialog */}
      <Portal>
        <Dialog visible={!!editItem} onDismiss={() => setEditItem(null)}>
          <Dialog.Title>Edit Quantity</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{marginBottom: 8}}>
              {editItem?.itemName}
            </Text>
            <TextInput
              mode="outlined"
              label="Quantity"
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="numeric"
              onSubmitEditing={handleEditQuantity}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditItem(null)}>Cancel</Button>
            <Button onPress={handleEditQuantity}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Checkout bar — when purchased items exist and not yet checked out */}
      {!isCheckedOut && purchasedItems > 0 && (
        <View style={[styles.checkoutBar, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
          <Text style={[styles.checkoutText, {color: colors.textSecondary}]}>
            {purchasedItems} item{purchasedItems !== 1 ? 's' : ''} ready
          </Text>
          <Button
            mode="contained"
            icon="cart-check"
            onPress={handleCheckout}
            style={{backgroundColor: colors.accent}}>
            Checkout
          </Button>
        </View>
      )}

      {/* Purchase record info */}
      {isCheckedOut && list && (
        <View style={[styles.purchaseInfo, {backgroundColor: colors.successBg}]}>
          <Text style={[styles.purchaseInfoText, {color: colors.success}]}>
            Purchased {list.checkoutDate?.toLocaleDateString() ?? ''}
            {list.totalPrice != null && ` · $${list.totalPrice.toFixed(2)}`}
          </Text>
        </View>
      )}

      {!isCheckedOut && (
        <FAB
          icon="plus"
          style={[styles.fab, {backgroundColor: colors.accent}]}
          onPress={() =>
            navigation.navigate('AddMethod', {context: 'shopping_list', listId})
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1},
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 1,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressPercent: {fontWeight: '600'},
  progressBar: {borderRadius: 4, height: 6},
  list: {paddingHorizontal: 12, paddingBottom: 100, paddingTop: 8},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  sectionTitle: {flex: 1, fontWeight: '600'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    borderRadius: 8,
    paddingRight: 4,
    minHeight: 48,
  },
  rowPurchased: {opacity: 0.6},
  itemInfo: {flex: 1, paddingVertical: 6},
  itemName: {fontSize: 15},
  itemMeta: {fontSize: 12, marginTop: 1},
  itemNotes: {fontSize: 11, marginTop: 2, fontStyle: 'italic'},
  notesCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    padding: 12,
    elevation: 1,
  },
  notesTappable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  checkedText: {textDecorationLine: 'line-through', opacity: 0.5},
  fab: {position: 'absolute', right: 16, bottom: 80},
  emptyContainer: {alignItems: 'center', marginTop: 80},
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  checkoutText: {fontSize: 14, fontWeight: '500'},
  purchaseInfo: {
    padding: 12,
    alignItems: 'center',
  },
  purchaseInfoText: {fontSize: 14, fontWeight: '500'},
});
