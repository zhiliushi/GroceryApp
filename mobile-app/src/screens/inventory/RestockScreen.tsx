import React, {useEffect, useState, useCallback} from 'react';
import {View, FlatList, StyleSheet, Alert} from 'react-native';
import {
  Text,
  Switch,
  TextInput,
  IconButton,
  Surface,
  Divider,
  Button,
} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import Loading from '../../components/common/Loading';
import type InventoryItem from '../../database/models/InventoryItem';

export default function RestockScreen(): React.JSX.Element {
  const {colors} = useAppTheme();
  const {inventory} = useDatabase();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');

  const loadItems = useCallback(async () => {
    try {
      const active = await inventory.getActive();
      // Sort: important items first, then needing restock first, then alphabetical
      active.sort((a, b) => {
        if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
        if (a.isImportant && b.isImportant) {
          const aNeedsRestock = a.quantity <= a.restockThreshold;
          const bNeedsRestock = b.quantity <= b.restockThreshold;
          if (aNeedsRestock !== bNeedsRestock) return aNeedsRestock ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      setItems(active);
    } catch (error) {
      console.error('Failed to load restock items:', error);
    } finally {
      setLoading(false);
    }
  }, [inventory]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleToggleImportant = async (item: InventoryItem) => {
    try {
      await item.toggleImportant(!item.isImportant);
      loadItems();
    } catch (error) {
      console.error('Failed to toggle important:', error);
    }
  };

  const handleStartEditThreshold = (item: InventoryItem) => {
    setEditingId(item.id);
    setThresholdInput(String(item.restockThreshold));
  };

  const handleSaveThreshold = async (item: InventoryItem) => {
    const threshold = parseInt(thresholdInput, 10);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Invalid', 'Please enter a valid number (0 or more).');
      return;
    }
    try {
      await item.setRestockThreshold(threshold);
      setEditingId(null);
      loadItems();
    } catch (error) {
      console.error('Failed to set threshold:', error);
    }
  };

  const renderItem = ({item}: {item: InventoryItem}) => {
    const needsRestock = item.isImportant && item.quantity <= item.restockThreshold;
    const statusColor = !item.isImportant
      ? colors.textTertiary
      : needsRestock
        ? colors.danger
        : colors.success;

    return (
      <Surface style={[styles.itemCard, {backgroundColor: colors.surface}]} elevation={1}>
        <View style={styles.itemHeader}>
          <View
            style={[styles.statusDot, {backgroundColor: statusColor}]}
          />
          <View style={styles.itemNameCol}>
            <Text variant="bodyLarge" numberOfLines={1} style={styles.itemName}>
              {item.name}
            </Text>
            <Text variant="bodySmall" style={[styles.itemMeta, {color: colors.textSecondary}]}>
              {item.location} · Qty: {item.quantity}
            </Text>
          </View>
          <View style={styles.importantToggle}>
            <Text variant="bodySmall" style={[styles.importantLabel, {color: colors.textTertiary}]}>
              Track
            </Text>
            <Switch
              value={item.isImportant}
              onValueChange={() => handleToggleImportant(item)}
              color={colors.accent}
            />
          </View>
        </View>

        {item.isImportant && (
          <View style={[styles.thresholdRow, {borderTopColor: colors.border}]}>
            <Text variant="bodySmall" style={[styles.thresholdLabel, {color: colors.textSecondary}]}>
              Restock when qty ≤
            </Text>
            {editingId === item.id ? (
              <View style={styles.thresholdEditRow}>
                <TextInput
                  mode="outlined"
                  value={thresholdInput}
                  onChangeText={setThresholdInput}
                  keyboardType="numeric"
                  style={styles.thresholdInput}
                  dense
                />
                <IconButton
                  icon="check"
                  iconColor={colors.success}
                  size={20}
                  onPress={() => handleSaveThreshold(item)}
                />
                <IconButton
                  icon="close"
                  iconColor={colors.textTertiary}
                  size={20}
                  onPress={() => setEditingId(null)}
                />
              </View>
            ) : (
              <Button
                mode="text"
                compact
                onPress={() => handleStartEditThreshold(item)}>
                {item.restockThreshold}
              </Button>
            )}
            {needsRestock && (
              <View style={[styles.restockBadge, {backgroundColor: colors.dangerBg}]}>
                <Text style={[styles.restockBadgeText, {color: colors.danger}]}>RESTOCK</Text>
              </View>
            )}
          </View>
        )}
      </Surface>
    );
  };

  if (loading) {
    return <Loading message="Loading items..." />;
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text variant="titleMedium">No inventory items</Text>
        <Text variant="bodySmall" style={[styles.emptyHint, {color: colors.textTertiary}]}>
          Add items to your inventory first
        </Text>
      </View>
    );
  }

  const importantCount = items.filter(i => i.isImportant).length;
  const restockCount = items.filter(
    i => i.isImportant && i.quantity <= i.restockThreshold,
  ).length;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Summary header */}
      <View style={[styles.summaryRow, {backgroundColor: colors.surface}]}>
        <View style={styles.summaryItem}>
          <Text variant="headlineSmall" style={styles.summaryValue}>
            {importantCount}
          </Text>
          <Text variant="bodySmall" style={[styles.summaryLabel, {color: colors.textSecondary}]}>
            Tracked
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text
            variant="headlineSmall"
            style={[styles.summaryValue, restockCount > 0 && {color: colors.danger}]}>
            {restockCount}
          </Text>
          <Text variant="bodySmall" style={[styles.summaryLabel, {color: colors.textSecondary}]}>
            Need Restock
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text variant="headlineSmall" style={styles.summaryValue}>
            {items.length}
          </Text>
          <Text variant="bodySmall" style={[styles.summaryLabel, {color: colors.textSecondary}]}>
            Total Items
          </Text>
        </View>
      </View>

      <Divider />

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontWeight: '700',
  },
  summaryLabel: {
    marginTop: 2,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  separator: {
    height: 8,
  },
  itemCard: {
    borderRadius: 12,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  itemNameCol: {
    flex: 1,
  },
  itemName: {
    fontWeight: '500',
  },
  itemMeta: {
    marginTop: 1,
  },
  importantToggle: {
    alignItems: 'center',
  },
  importantLabel: {
    fontSize: 10,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  thresholdLabel: {},
  thresholdEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  thresholdInput: {
    width: 60,
    height: 32,
    fontSize: 14,
  },
  restockBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  restockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyHint: {
    marginTop: 4,
  },
});
