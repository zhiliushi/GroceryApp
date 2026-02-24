import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {View, FlatList, StyleSheet, RefreshControl} from 'react-native';
import {Text, Searchbar, Chip, Divider} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import InventoryItemCard from '../../components/grocery/InventoryItemCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorView from '../../components/common/ErrorView';
import EmptyState from '../../components/common/EmptyState';
import type {InventoryItemView} from '../../store/inventoryStore';
import type Category from '../../database/models/Category';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'PastItems'>;

type StatusFilter = 'all' | 'consumed' | 'expired' | 'discarded';

const STATUS_FILTERS: {value: StatusFilter; label: string; icon: string}[] = [
  {value: 'all', label: 'All', icon: 'all-inclusive'},
  {value: 'consumed', label: 'Used Up', icon: 'check-circle-outline'},
  {value: 'expired', label: 'Expired', icon: 'clock-alert-outline'},
  {value: 'discarded', label: 'Discarded', icon: 'delete-outline'},
];

export default function PastItemsScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const {inventory, category: categoryRepo} = useDatabase();

  const [allItems, setAllItems] = useState<InventoryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const [rawItems, rawCategories] = await Promise.all([
        inventory.getPastItems(),
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
      console.error('[PastItems] Failed to load:', err);
      setLoadError('Could not load past items. Please try again.');
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
  // Filtered + searched items
  // ---------------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    let result = [...allItems];

    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
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

    result.sort((a, b) => b.addedDate - a.addedDate);
    return result;
  }, [allItems, statusFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && allItems.length === 0) {
    return <LoadingSpinner message="Loading past items..." />;
  }

  if (loadError && allItems.length === 0) {
    return (
      <ErrorView
        title="Could not load past items"
        message={loadError}
        onRetry={loadData}
      />
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Searchbar
        placeholder="Search past items..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchBar, {backgroundColor: colors.surfaceVariant}]}
      />

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <Chip
            key={f.value}
            icon={f.icon}
            selected={statusFilter === f.value}
            onPress={() => setStatusFilter(f.value)}
            style={[styles.filterChip, {backgroundColor: colors.surfaceVariant}, statusFilter === f.value && {backgroundColor: colors.accent}]}
            textStyle={statusFilter === f.value ? {color: colors.textInverse} : undefined}
            showSelectedCheck={false}
            compact>
            {f.label}
          </Chip>
        ))}
      </View>

      <View style={styles.countBar}>
        <Text style={[styles.countText, {color: colors.textSecondary}]}>
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <Divider />

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <InventoryItemCard
            item={item}
            onPress={() => navigation.navigate('InventoryDetail', {itemId: item.id})}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="history"
            title="No Past Items"
            description={
              searchQuery.trim() || statusFilter !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'Items you use up, expire, or discard will appear here.'
            }
            compact
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  searchBar: {
    marginHorizontal: 12,
    marginTop: 8,
    elevation: 0,
    borderRadius: 12,
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterChip: {
    height: 32,
  },
  countBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
