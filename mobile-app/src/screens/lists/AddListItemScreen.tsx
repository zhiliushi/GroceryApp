import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {
  View,
  FlatList,
  SectionList,
  StyleSheet,
  Keyboard,
} from 'react-native';
import {
  Text,
  Searchbar,
  Chip,
  IconButton,
  Button,
  Divider,
  TextInput,
  Portal,
  Dialog,
} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import {desaturateCategory} from '../../config/theme';
import Loading from '../../components/common/Loading';
import type Category from '../../database/models/Category';
import type Unit from '../../database/models/Unit';
import type InventoryItem from '../../database/models/InventoryItem';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'AddListItem'>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddListItemScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const params = route.params as {
    listId: string;
    productName?: string;
    barcode?: string;
    brand?: string;
    imageUrl?: string;
  };
  const {listId} = params;
  const {shoppingList, category: categoryRepo, unit: unitRepo, inventory} =
    useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();

  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Suggestions
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [recentItems, setRecentItems] = useState<InventoryItem[]>([]);
  const [pastItems, setPastItems] = useState<InventoryItem[]>([]);

  // Manual add form
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState(params?.productName ?? '');
  const [manualQty, setManualQty] = useState('1');
  const [manualPrice, setManualPrice] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualBarcode] = useState(params?.barcode ?? '');
  const [manualBrand] = useState(params?.brand ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Category + unit maps
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const unitMap = useMemo(() => {
    const m = new Map<string, Unit>();
    units.forEach(u => m.set(u.id, u));
    return m;
  }, [units]);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    const [allCats, allUnits, activeItems, pastInv] = await Promise.all([
      categoryRepo.getAll(),
      unitRepo.getAll(),
      inventory.getActive(),
      inventory.getPastItems(),
    ]);

    setCategories(allCats);
    setUnits(allUnits);

    // Default unit and category
    if (allUnits.length > 0 && !selectedUnitId) {
      const countUnit = allUnits.find(u => u.abbreviation === 'pcs') ?? allUnits[0];
      setSelectedUnitId(countUnit.id);
    }
    if (allCats.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(allCats[0].id);
    }

    // Low stock: items with quantity <= 1
    const lowStock = activeItems
      .filter(i => i.quantity <= 1)
      .slice(0, 10);
    setLowStockItems(lowStock);

    // Recent: last 10 added items
    const recent = [...activeItems]
      .sort((a, b) => b.addedDate.getTime() - a.addedDate.getTime())
      .slice(0, 10);
    setRecentItems(recent);

    // Past items: things to re-buy
    setPastItems(pastInv.slice(0, 15));

    setLoading(false);
  }, [categoryRepo, unitRepo, inventory, selectedUnitId, selectedCategoryId]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Quick-add from suggestion
  // ---------------------------------------------------------------------------

  const handleQuickAdd = async (item: InventoryItem) => {
    try {
      await shoppingList.addItem({
        listId,
        itemName: item.name,
        quantity: 1,
        unitId: item.unitId,
        categoryId: item.categoryId,
        barcode: item.barcode,
        brand: item.brand,
        imageUrl: item.imageUrl,
      });
      // Visual feedback — remove from suggestion lists
      setLowStockItems(prev => prev.filter(i => i.id !== item.id));
      setRecentItems(prev => prev.filter(i => i.id !== item.id));
      setPastItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) {
      console.error('Quick add failed:', e.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Manual add
  // ---------------------------------------------------------------------------

  const handleManualAdd = async () => {
    const name = manualName.trim();
    if (!name || !selectedCategoryId || !selectedUnitId) return;
    const qty = parseFloat(manualQty) || 1;

    const priceVal = manualPrice.trim() ? parseFloat(manualPrice) : null;
    try {
      await shoppingList.addItem({
        listId,
        itemName: name,
        quantity: qty,
        unitId: selectedUnitId,
        categoryId: selectedCategoryId,
        price: priceVal != null && !isNaN(priceVal) ? priceVal : null,
        barcode: manualBarcode || null,
        brand: manualBrand || null,
        notes: manualNotes.trim() || null,
      });
      setManualName('');
      setManualQty('1');
      setManualPrice('');
      setManualNotes('');
      Keyboard.dismiss();
    } catch (e: any) {
      console.error('Manual add failed:', e.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered suggestions based on search
  // ---------------------------------------------------------------------------

  const filteredLowStock = useMemo(() => {
    if (!searchQuery.trim()) return lowStockItems;
    const q = searchQuery.toLowerCase();
    return lowStockItems.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q)),
    );
  }, [lowStockItems, searchQuery]);

  const filteredRecent = useMemo(() => {
    if (!searchQuery.trim()) return recentItems;
    const q = searchQuery.toLowerCase();
    return recentItems.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q)),
    );
  }, [recentItems, searchQuery]);

  const filteredPast = useMemo(() => {
    if (!searchQuery.trim()) return pastItems;
    const q = searchQuery.toLowerCase();
    return pastItems.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q)),
    );
  }, [pastItems, searchQuery]);

  const sections = useMemo(() => {
    const s: {title: string; data: InventoryItem[]}[] = [];
    if (filteredPast.length > 0) {
      s.push({title: 'Re-buy (Past Items)', data: filteredPast});
    }
    if (filteredLowStock.length > 0) {
      s.push({title: 'Low Stock', data: filteredLowStock});
    }
    if (filteredRecent.length > 0) {
      s.push({title: 'Recent Items', data: filteredRecent});
    }
    return s;
  }, [filteredPast, filteredLowStock, filteredRecent]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <Loading message="Loading suggestions..." />;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Search bar */}
      <Searchbar
        placeholder="Search items..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchbar, {backgroundColor: colors.surface}]}
        elevation={0}
      />

      {/* Manual add form — always visible at top */}
      <View style={[styles.manualAddContainer, {backgroundColor: colors.surface}]}>
        <Text variant="titleSmall" style={styles.sectionLabel}>
          Add Custom Item
        </Text>
        <View style={styles.manualAddRow}>
          <TextInput
            mode="outlined"
            placeholder="Item name"
            value={manualName}
            onChangeText={setManualName}
            style={styles.nameInput}
            dense
          />
          <TextInput
            mode="outlined"
            placeholder="Qty"
            value={manualQty}
            onChangeText={setManualQty}
            keyboardType="numeric"
            style={styles.qtyInput}
            dense
          />
          <TextInput
            mode="outlined"
            placeholder="$"
            value={manualPrice}
            onChangeText={setManualPrice}
            keyboardType="decimal-pad"
            style={styles.priceInput}
            dense
          />
          <IconButton
            icon="plus-circle"
            iconColor={colors.accent}
            size={28}
            onPress={handleManualAdd}
            disabled={!manualName.trim()}
          />
        </View>

        {/* Notes */}
        <TextInput
          mode="outlined"
          placeholder="Notes e.g. Lady's Choice preferred"
          value={manualNotes}
          onChangeText={setManualNotes}
          style={styles.notesInput}
          multiline
          numberOfLines={2}
          dense
        />

        {/* Category chips */}
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.chipList}
          renderItem={({item: cat}) => {
            const desatColor = desaturateCategory(cat.color);
            return (
              <Chip
                selected={selectedCategoryId === cat.id}
                onPress={() => setSelectedCategoryId(cat.id)}
                style={[
                  styles.catChip,
                  selectedCategoryId === cat.id && {
                    backgroundColor: desatColor + '30',
                  },
                ]}
                textStyle={
                  selectedCategoryId === cat.id
                    ? {color: desatColor, fontWeight: '600'}
                    : undefined
                }
                showSelectedOverlay>
                {cat.name}
              </Chip>
            );
          }}
        />

        {/* Unit chips */}
        <FlatList
          data={units}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.chipList}
          renderItem={({item: u}) => (
            <Chip
              selected={selectedUnitId === u.id}
              onPress={() => setSelectedUnitId(u.id)}
              style={styles.unitChip}
              showSelectedOverlay>
              {u.abbreviation}
            </Chip>
          )}
        />
      </View>

      <Divider />

      {/* Suggestions */}
      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderSectionHeader={({section}) => (
          <View style={styles.suggestionHeader}>
            <Text variant="titleSmall" style={[styles.suggestionTitle, {color: colors.textSecondary}]}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({item}) => {
          const cat = categoryMap.get(item.categoryId);
          const unitObj = unitMap.get(item.unitId);
          return (
            <View style={[styles.suggestionRow, {backgroundColor: colors.surface}]}>
              <View style={styles.suggestionInfo}>
                {cat && (
                  <View
                    style={[styles.catDot, {backgroundColor: desaturateCategory(cat.color)}]}
                  />
                )}
                <View style={styles.suggestionText}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={{color: colors.textTertiary, marginTop: 1}}>
                    {item.quantity} {unitObj?.abbreviation ?? ''}{' '}
                    {item.brand ? `· ${item.brand}` : ''}
                  </Text>
                </View>
              </View>
              <Button
                mode="text"
                compact
                onPress={() => handleQuickAdd(item)}
                icon="plus">
                Add
              </Button>
            </View>
          );
        }}
        contentContainerStyle={styles.suggestionList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyMedium" style={{color: colors.textSecondary}}>
              {searchQuery.trim()
                ? 'No matching items found'
                : 'No suggestions available'}
            </Text>
            <Text variant="bodySmall" style={{color: colors.textTertiary, marginTop: 4}}>
              Use the form above to add items manually
            </Text>
          </View>
        }
      />

      {/* Done button */}
      <View style={[styles.bottomBar, {backgroundColor: colors.background}]}>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={styles.doneButton}
          buttonColor={colors.accent}>
          Done
        </Button>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1},
  searchbar: {
    margin: 12,
    marginBottom: 4,
    borderRadius: 12,
  },
  manualAddContainer: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    elevation: 1,
  },
  sectionLabel: {marginBottom: 8, fontWeight: '600'},
  manualAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {flex: 1, marginRight: 8},
  qtyInput: {width: 55, marginRight: 4},
  priceInput: {width: 55, marginRight: 4},
  notesInput: {marginTop: 8, marginBottom: 4},
  chipList: {paddingVertical: 6, gap: 6},
  catChip: {marginRight: 4},
  unitChip: {marginRight: 4},
  suggestionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  suggestionTitle: {fontWeight: '600'},
  suggestionList: {paddingBottom: 80},
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 2,
    borderRadius: 8,
    paddingLeft: 12,
    paddingVertical: 6,
    paddingRight: 4,
  },
  suggestionInfo: {flexDirection: 'row', alignItems: 'center', flex: 1},
  catDot: {width: 8, height: 8, borderRadius: 4, marginRight: 10},
  suggestionText: {flex: 1},
  emptyContainer: {alignItems: 'center', marginTop: 40},
  bottomBar: {
    padding: 12,
  },
  doneButton: {borderRadius: 8},
});
