import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import {
  Text,
  Searchbar,
  IconButton,
  FAB,
  Menu,
  Divider,
  Chip,
  Icon,
  Surface,
} from 'react-native-paper';
import {Swipeable} from 'react-native-gesture-handler';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import {useSettingsStore} from '../../store/settingsStore';
import InventoryItemCard from '../../components/grocery/InventoryItemCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorView from '../../components/common/ErrorView';
import EmptyState from '../../components/common/EmptyState';
import {useToast} from '../../components/common/ToastProvider';
import {getLocationConfig} from '../../utils/locationUtils';
import {
  useInventoryStore,
  type InventoryItemView,
  type SortOption,
  type FilterOption,
} from '../../store/inventoryStore';
import type Category from '../../database/models/Category';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Inventory'>;

// ---------------------------------------------------------------------------
// Sort config
// ---------------------------------------------------------------------------

const SORT_OPTIONS: {value: SortOption; label: string; icon: string}[] = [
  {value: 'date_added', label: 'Date Added', icon: 'sort-calendar-descending'},
  {value: 'expiry_date', label: 'Expiry Date', icon: 'calendar-clock'},
  {value: 'name', label: 'Name', icon: 'sort-alphabetical-ascending'},
  {value: 'category', label: 'Category', icon: 'shape-outline'},
];

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: {value: FilterOption; label: string; icon: string}[] = [
  {value: 'all', label: 'All', icon: 'all-inclusive'},
  {value: 'expiring_soon', label: 'Expiring Soon', icon: 'clock-alert-outline'},
  {value: 'expired', label: 'Expired', icon: 'alert-circle-outline'},
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveItems(
  items: InventoryItemView[],
  searchQuery: string,
  filterBy: FilterOption,
  sortBy: SortOption,
): InventoryItemView[] {
  let result = [...items];

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  switch (filterBy) {
    case 'expiring_soon':
      result = result.filter(
        i => i.expiryDate && i.expiryDate > now && i.expiryDate <= now + sevenDaysMs,
      );
      break;
    case 'expired':
      result = result.filter(i => i.expiryDate && i.expiryDate < now);
      break;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        i.categoryName.toLowerCase().includes(q),
    );
  }

  switch (sortBy) {
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'expiry_date':
      result.sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate - b.expiryDate;
      });
      break;
    case 'category':
      result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
      break;
    case 'date_added':
    default:
      result.sort((a, b) => b.addedDate - a.addedDate);
      break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Location section type
// ---------------------------------------------------------------------------

interface LocationSection {
  location: string;
  label: string;
  icon: string;
  color: string;
  items: InventoryItemView[];
  expiringCount: number;
  expiredCount: number;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function InventoryScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const {inventory, category: categoryRepo} = useDatabase();
  const {storageLocations, expiryAlertDays} = useSettingsStore();

  const {
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    filterBy, setFilterBy,
    viewMode, setViewMode,
  } = useInventoryStore();

  const {showSuccess, showError} = useToast();

  const [allItems, setAllItems] = useState<InventoryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(storageLocations),
  );

  const toggleSection = useCallback((location: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(location)) next.delete(location);
      else next.add(location);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const [rawItems, rawCategories] = await Promise.all([
        inventory.getActive(),
        categoryRepo.getAll(),
      ]);

      const catMap = new Map<string, Category>();
      for (const c of rawCategories) {
        catMap.set(c.id, c);
      }

      const views: InventoryItemView[] = await Promise.all(
        rawItems.map(async i => {
          const cat = catMap.get(i.categoryId);
          let unitAbbreviation = '';
          try {
            const u = await i.unit.fetch();
            unitAbbreviation = u.abbreviation;
          } catch { /* ignored */ }

          return {
            id: i.id,
            name: i.name,
            categoryId: i.categoryId,
            categoryName: cat?.name ?? '',
            categoryColor: cat?.color ?? '#9E9E9E',
            quantity: i.quantity,
            unitId: i.unitId,
            unitAbbreviation,
            price: i.price ?? undefined,
            expiryDate: i.expiryDate?.getTime() ?? undefined,
            addedDate: i.addedDate?.getTime() ?? Date.now(),
            brand: i.brand ?? undefined,
            imageUrl: i.imageUrl ?? undefined,
            status: i.status,
            location: i.location,
          };
        }),
      );

      setAllItems(views);
      setLoadError(null);
    } catch (err) {
      console.error('[Inventory] Failed to load:', err);
      setLoadError('Could not load inventory. Please try again.');
    }
  }, [inventory, categoryRepo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadData();
    });
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredItems = useMemo(
    () => resolveItems(allItems, searchQuery, filterBy, sortBy),
    [allItems, searchQuery, filterBy, sortBy],
  );

  const groupedSections = useMemo((): LocationSection[] => {
    const now = Date.now();
    const alertMs = expiryAlertDays * 24 * 60 * 60 * 1000;

    const allLocations = new Set(storageLocations);
    for (const item of filteredItems) {
      allLocations.add(item.location);
    }

    return Array.from(allLocations).map(loc => {
      const items = filteredItems.filter(i => i.location === loc);
      const config = getLocationConfig(loc);
      return {
        location: loc,
        label: config.label,
        icon: config.icon,
        color: config.color,
        items,
        expiringCount: items.filter(
          i => i.expiryDate && i.expiryDate > now && i.expiryDate <= now + alertMs,
        ).length,
        expiredCount: items.filter(
          i => i.expiryDate && i.expiryDate < now,
        ).length,
      };
    }).filter(s => s.items.length > 0 || !searchQuery.trim());
  }, [filteredItems, storageLocations, expiryAlertDays, searchQuery]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Sort';

  // ---------------------------------------------------------------------------
  // Swipe actions
  // ---------------------------------------------------------------------------

  const handleEdit = useCallback(
    (itemId: string) => {
      navigation.navigate('EditItem', {itemId});
    },
    [navigation],
  );

  const handleDelete = useCallback(
    async (item: InventoryItemView) => {
      Alert.alert(
        'Delete Item',
        `Are you sure you want to delete "${item.name}"?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const dbItem = await inventory.getById(item.id);
                await inventory.delete(dbItem);
                setAllItems(prev => prev.filter(i => i.id !== item.id));
                showSuccess(`"${item.name}" deleted`);
              } catch (err) {
                console.error('[Inventory] Delete failed:', err);
                showError('Failed to delete item');
              }
            },
          },
        ],
      );
    },
    [inventory],
  );

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      _dragX: Animated.AnimatedInterpolation<number>,
      item: InventoryItemView,
    ) => (
      <View style={styles.swipeActions}>
        <IconButton
          icon="pencil"
          iconColor="#fff"
          containerColor={colors.accent}
          size={22}
          onPress={() => handleEdit(item.id)}
          style={styles.swipeBtn}
        />
        <IconButton
          icon="delete"
          iconColor="#fff"
          containerColor={colors.danger}
          size={22}
          onPress={() => handleDelete(item)}
          style={styles.swipeBtn}
        />
      </View>
    ),
    [handleEdit, handleDelete],
  );

  // ---------------------------------------------------------------------------
  // Render item (grid mode only)
  // ---------------------------------------------------------------------------

  const renderGridItem = useCallback(
    ({item}: {item: InventoryItemView}) => (
      <InventoryItemCard
        item={item}
        compact
        onPress={() => navigation.navigate('InventoryDetail', {itemId: item.id})}
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback((item: InventoryItemView) => item.id, []);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  const ListEmptyComponent = useMemo(() => {
    const hasActiveFilters =
      searchQuery.trim() !== '' ||
      filterBy !== 'all';

    if (hasActiveFilters) {
      return (
        <EmptyState
          icon="filter-off-outline"
          title="No Matching Items"
          description="Try adjusting your filters or search query."
          compact
        />
      );
    }

    return (
      <EmptyState
        icon="fridge-outline"
        title="Your Inventory is Empty"
        description="Scan a barcode or tap the + button to add your first grocery item."
        actionLabel="Add Item"
        onAction={() => navigation.navigate('AddMethod', {context: 'inventory'})}
        compact
      />
    );
  }, [searchQuery, filterBy, navigation]);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading && allItems.length === 0) {
    return <LoadingSpinner message="Loading inventory..." />;
  }

  if (loadError && allItems.length === 0) {
    return (
      <ErrorView
        title="Could not load inventory"
        message={loadError}
        onRetry={loadData}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Search bar + view toggle */}
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchBar, {backgroundColor: colors.surfaceVariant}]}
        />
        <IconButton
          icon={viewMode === 'list' ? 'view-grid-outline' : 'view-list-outline'}
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          size={24}
        />
      </View>

      {/* Filter + sort bar */}
      <View style={styles.controlBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}>
          {FILTER_OPTIONS.map(f => (
            <Chip
              key={f.value}
              icon={f.icon}
              selected={filterBy === f.value}
              onPress={() => setFilterBy(f.value)}
              style={[styles.filterChip, {backgroundColor: colors.surfaceVariant}, filterBy === f.value && {backgroundColor: colors.accent}]}
              textStyle={filterBy === f.value ? {color: colors.textInverse} : undefined}
              showSelectedCheck={false}
              compact>
              {f.label}
            </Chip>
          ))}
          <Chip
            icon="history"
            onPress={() => navigation.navigate('PastItems')}
            style={[styles.pastItemsChip, {backgroundColor: colors.surfaceVariant}]}
            compact>
            Past Items
          </Chip>
        </ScrollView>

        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={
            <IconButton
              icon="sort"
              size={22}
              onPress={() => setSortMenuVisible(true)}
            />
          }>
          {SORT_OPTIONS.map(opt => (
            <Menu.Item
              key={opt.value}
              leadingIcon={opt.icon}
              title={opt.label}
              onPress={() => {
                setSortBy(opt.value);
                setSortMenuVisible(false);
              }}
              titleStyle={sortBy === opt.value ? {color: colors.accent, fontWeight: '700'} : undefined}
            />
          ))}
        </Menu>
      </View>

      {/* Item count */}
      <View style={styles.countBar}>
        <Text style={[styles.countText, {color: colors.textSecondary}]}>
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </Text>
        {currentSortLabel && (
          <Text style={[styles.sortLabel, {color: colors.textTertiary}]}>Sorted by {currentSortLabel}</Text>
        )}
      </View>

      <Divider />

      {/* Item list */}
      {viewMode === 'grid' ? (
        <FlatList
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderGridItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={ListEmptyComponent}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={5}
          initialNumToRender={10}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {groupedSections.length === 0 ||
          groupedSections.every(s => s.items.length === 0) ? (
            ListEmptyComponent
          ) : (
            groupedSections.map(section => (
              <View key={section.location} style={styles.sectionContainer}>
                <Pressable onPress={() => toggleSection(section.location)}>
                  <Surface style={[styles.sectionHeader, {backgroundColor: colors.surface}]} elevation={1}>
                    <View style={styles.sectionHeaderLeft}>
                      <Icon source={section.icon} size={24} color={section.color} />
                      <View style={styles.sectionHeaderText}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                          {section.label}
                        </Text>
                        <Text variant="bodySmall" style={[styles.sectionMeta, {color: colors.textSecondary}]}>
                          {section.items.length} item{section.items.length !== 1 ? 's' : ''}
                          {section.expiringCount > 0 && (
                            <Text style={{color: colors.warning}}>
                              {' '}| {section.expiringCount} expiring
                            </Text>
                          )}
                          {section.expiredCount > 0 && (
                            <Text style={{color: colors.danger}}>
                              {' '}| {section.expiredCount} expired
                            </Text>
                          )}
                        </Text>
                      </View>
                    </View>
                    <Icon
                      source={expandedSections.has(section.location) ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#666"
                    />
                  </Surface>
                </Pressable>

                {expandedSections.has(section.location) && (
                  <View style={styles.sectionItems}>
                    {section.items.length === 0 ? (
                      <Text style={[styles.emptySection, {color: colors.textTertiary}]}>No items</Text>
                    ) : (
                      section.items.map(item => (
                        <Swipeable
                          key={item.id}
                          renderRightActions={(progress, dragX) =>
                            renderRightActions(progress, dragX, item)
                          }
                          overshootRight={false}>
                          <InventoryItemCard
                            item={item}
                            onPress={() =>
                              navigation.navigate('InventoryDetail', {itemId: item.id})
                            }
                          />
                        </Swipeable>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, {backgroundColor: colors.accent}]}
        onPress={() => navigation.navigate('AddMethod', {context: 'inventory'})}
        label="Add Item"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    paddingTop: 8,
  },
  searchBar: {
    flex: 1,
    elevation: 0,
    borderRadius: 12,
    height: 44,
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterList: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
    flex: 1,
  },
  filterChip: {
    height: 32,
  },
  pastItemsChip: {
    height: 32,
  },
  countBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 13,
  },
  sortLabel: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 80,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
    gap: 4,
  },
  swipeBtn: {
    borderRadius: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionMeta: {
    marginTop: 2,
  },
  sectionItems: {
    paddingTop: 8,
  },
  emptySection: {
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
});
