import React, {useEffect, useState, useCallback} from 'react';
import {View, ScrollView, StyleSheet, Alert} from 'react-native';
import {
  Text,
  Button,
  Divider,
  Portal,
  Dialog,
  TextInput,
  IconButton,
  Chip,
  ProgressBar,
} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import {useNotifications} from '../../hooks/useNotifications';
import {useToast} from '../../components/common/ToastProvider';
import {useSettingsStore} from '../../store/settingsStore';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorView from '../../components/common/ErrorView';
import {formatDate, expiryStatus} from '../../utils/dateUtils';
import {formatPrice} from '../../utils/helpers';
import {capitaliseLocation, getLocationConfig} from '../../utils/locationUtils';
import type InventoryItem from '../../database/models/InventoryItem';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'InventoryDetail'>;

export default function InventoryDetailScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const {itemId} = route.params as {itemId: string};
  const {colors} = useAppTheme();
  const {inventory} = useDatabase();
  const {cancelItemNotifications} = useNotifications();
  const {showSuccess, showError} = useToast();
  const {storageLocations} = useSettingsStore();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [unitAbbreviation, setUnitAbbreviation] = useState('');
  const [initialQty, setInitialQty] = useState<number | null>(null);

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Transfer dialog
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // ---------------------------------------------------------------------------
  // Load item
  // ---------------------------------------------------------------------------

  const loadItem = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const found = await inventory.getById(itemId);
      setItem(found);
      setInitialQty(prev => (prev === null ? found.quantity : prev));
      try {
        const cat = await found.category.fetch();
        setCategoryName(cat.name);
      } catch {
        /* ignored */
      }
      try {
        const u = await found.unit.fetch();
        setUnitAbbreviation(u.abbreviation);
      } catch {
        /* ignored */
      }
    } catch {
      setItem(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [inventory, itemId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  const handleOpenEdit = () => {
    if (!item) return;
    setEditName(item.name);
    setEditNotes(item.notes ?? '');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!item || !editName.trim()) return;
    try {
      await inventory.update(item, {
        name: editName.trim(),
        notes: editNotes.trim() || null,
      });
      showSuccess('Item updated');
      setShowEditDialog(false);
      await loadItem();
    } catch {
      showError('Failed to update item');
    }
  };

  // ---------------------------------------------------------------------------
  // Transfer handler
  // ---------------------------------------------------------------------------

  const handleTransfer = async (newLocation: string) => {
    if (!item) return;
    try {
      await inventory.update(item, {location: newLocation});
      showSuccess(`Moved to ${capitaliseLocation(newLocation)}`);
      setShowTransferDialog(false);
      await loadItem();
    } catch {
      showError('Failed to move item');
    }
  };

  // ---------------------------------------------------------------------------
  // Quantity adjustment — stepper (+/-)
  // ---------------------------------------------------------------------------

  const adjustAndCheck = async (newQty: number) => {
    if (!item) return;
    const clamped = Math.max(0, Math.round(newQty * 100) / 100);
    try {
      await inventory.update(item, {quantity: clamped});
      await loadItem();
      if (clamped === 0) {
        showTransferToPastPopup();
      }
    } catch {
      showError('Failed to update quantity');
    }
  };

  const handleAdjustQuantity = (delta: number) => {
    if (!item) return;
    adjustAndCheck(item.quantity + delta);
  };

  // ---------------------------------------------------------------------------
  // Quick buttons — Used Quarter, Used Half, Revert
  // ---------------------------------------------------------------------------

  const handleUseQuarter = () => {
    if (!item || initialQty === null) return;
    const subtract = +(initialQty * 0.25).toFixed(2);
    adjustAndCheck(item.quantity - subtract);
  };

  const handleUseHalf = () => {
    if (!item || initialQty === null) return;
    const subtract = +(initialQty * 0.5).toFixed(2);
    adjustAndCheck(item.quantity - subtract);
  };

  const handleRevert = async () => {
    if (!item || initialQty === null) return;
    try {
      await inventory.update(item, {quantity: initialQty});
      await loadItem();
    } catch {
      showError('Failed to revert quantity');
    }
  };

  // ---------------------------------------------------------------------------
  // Zero-qty popup → transfer to Past Items
  // ---------------------------------------------------------------------------

  const showTransferToPastPopup = () => {
    if (!item) return;
    Alert.alert(
      'Item Finished',
      'Transfer to Past Items?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Transfer',
          onPress: async () => {
            try {
              await cancelItemNotifications(item.id);
              await inventory.markConsumed(item, 'used_up');
              showSuccess(`"${item.name}" moved to Past Items`);
              navigation.goBack();
            } catch {
              showError('Failed to transfer item');
            }
          },
        },
      ],
    );
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (item) {
            try {
              await cancelItemNotifications(item.id);
              await inventory.delete(item);
              showSuccess(`"${item.name}" deleted`);
              navigation.goBack();
            } catch {
              showError('Failed to delete item');
            }
          }
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Mark consumed — stay on screen, reload to show new buttons
  // ---------------------------------------------------------------------------

  const handleMarkConsumed = () => {
    Alert.alert('Mark as Consumed', 'How was this item used?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Used Up',
        onPress: async () => {
          if (item) {
            try {
              await cancelItemNotifications(item.id);
              await inventory.markConsumed(item, 'used_up');
              showSuccess(`"${item.name}" marked as used up`);
              await loadItem();
            } catch {
              showError('Failed to update item');
            }
          }
        },
      },
      {
        text: 'Expired',
        onPress: async () => {
          if (item) {
            try {
              await cancelItemNotifications(item.id);
              await inventory.markConsumed(item, 'expired');
              showSuccess(`"${item.name}" marked as expired`);
              await loadItem();
            } catch {
              showError('Failed to update item');
            }
          }
        },
      },
      {
        text: 'Discarded',
        onPress: async () => {
          if (item) {
            try {
              await cancelItemNotifications(item.id);
              await inventory.markConsumed(item, 'discarded');
              showSuccess(`"${item.name}" discarded`);
              await loadItem();
            } catch {
              showError('Failed to update item');
            }
          }
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Restore to active inventory (for consumed/expired/discarded items)
  // ---------------------------------------------------------------------------

  const handleRestoreToActive = async () => {
    if (!item) return;
    try {
      await inventory.restoreToActive(item);
      showSuccess(`"${item.name}" restored to inventory`);
      await loadItem();
    } catch {
      showError('Failed to restore item');
    }
  };

  // ---------------------------------------------------------------------------
  // Move to Past Items (mark as discarded for consumed/expired items)
  // ---------------------------------------------------------------------------

  const handleMoveToPast = () => {
    if (!item) return;
    Alert.alert(
      'Move to Past Items',
      `Move "${item.name}" to Past Items?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Move',
          onPress: async () => {
            try {
              await inventory.markConsumed(item, 'discarded');
              showSuccess(`"${item.name}" moved to Past Items`);
              navigation.goBack();
            } catch {
              showError('Failed to move item');
            }
          },
        },
      ],
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <LoadingSpinner message="Loading item..." />;
  }

  if (loadFailed || !item) {
    return (
      <ErrorView
        title="Item not found"
        message="This item may have been deleted."
        icon="package-variant-remove"
        onRetry={() => navigation.goBack()}
        retryLabel="Go Back"
      />
    );
  }

  const expStatus = expiryStatus(item.expiryDate);
  const qtyRatio =
    initialQty !== null && initialQty > 0
      ? item.quantity / initialQty
      : 0;
  const isActive = item.status === 'active';
  const statusLabel =
    item.status === 'consumed'
      ? 'Used Up'
      : item.status === 'expired'
        ? 'Expired'
        : item.status === 'discarded'
          ? 'Discarded'
          : 'Active';

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}>
        {/* Status badge for non-active items */}
        {!isActive && (
          <View style={styles.statusBadge}>
            <Chip
              icon={
                item.status === 'expired'
                  ? 'clock-alert-outline'
                  : item.status === 'consumed'
                    ? 'check-circle-outline'
                    : 'delete-outline'
              }
              textStyle={styles.statusBadgeText}
              style={[
                styles.statusChip,
                {backgroundColor: colors.surfaceVariant},
                item.status === 'expired' && {backgroundColor: colors.dangerBg},
                item.status === 'consumed' && {backgroundColor: colors.successBg},
                item.status === 'discarded' && {backgroundColor: colors.warningBg},
              ]}>
              {statusLabel}
            </Chip>
          </View>
        )}

        <Text variant="headlineSmall">{item.name}</Text>
        {item.brand && <Text style={[styles.brand, {color: colors.textSecondary}]}>{item.brand}</Text>}

        <Divider style={styles.divider} />

        <Row label="Category" value={categoryName} />

        {/* Quantity with +/- stepper — only for active items */}
        {isActive ? (
          <View style={styles.row}>
            <Text style={styles.label}>Quantity</Text>
            <View style={styles.qtyControls}>
              <IconButton
                icon="minus-circle-outline"
                size={22}
                onPress={() => handleAdjustQuantity(-1)}
                disabled={item.quantity <= 0}
                style={styles.qtyBtn}
              />
              <Text style={styles.qtyText}>
                {item.quantity} {unitAbbreviation}
              </Text>
              <IconButton
                icon="plus-circle-outline"
                size={22}
                onPress={() => handleAdjustQuantity(1)}
                style={styles.qtyBtn}
              />
            </View>
          </View>
        ) : (
          <Row
            label="Quantity"
            value={`${item.quantity} ${unitAbbreviation}`}
          />
        )}

        {/* Remaining progress bar + Used Quarter / Used Half / Revert */}
        {isActive && initialQty !== null && initialQty > 0 && (
          <View style={[styles.remainingSection, {backgroundColor: colors.surfaceVariant}]}>
            <View style={styles.remainingHeader}>
              <Text variant="labelSmall" style={[styles.remainingLabel, {color: colors.textSecondary}]}>
                Remaining
              </Text>
              <Text variant="labelSmall" style={styles.remainingPct}>
                {Math.round(Math.min(qtyRatio, 1) * 100)}%
              </Text>
            </View>
            <ProgressBar
              progress={Math.min(qtyRatio, 1)}
              color={
                qtyRatio > 0.5
                  ? colors.success
                  : qtyRatio > 0.25
                    ? colors.warning
                    : colors.danger
              }
              style={styles.progressBar}
            />
            <View style={styles.quickBtns}>
              <Button
                mode="outlined"
                compact
                onPress={handleUseQuarter}
                disabled={item.quantity <= 0}
                style={styles.quickBtn}
                labelStyle={styles.quickBtnLabel}>
                Used Quarter
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={handleUseHalf}
                disabled={item.quantity <= 0}
                style={styles.quickBtn}
                labelStyle={styles.quickBtnLabel}>
                Used Half
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={handleRevert}
                disabled={item.quantity === initialQty}
                style={styles.quickBtn}
                labelStyle={styles.quickBtnLabel}>
                Revert
              </Button>
            </View>
          </View>
        )}

        <Row label="Price" value={formatPrice(item.price)} />
        {item.barcode && <Row label="Barcode" value={item.barcode} />}
        {item.location && (
          <Row label="Location" value={capitaliseLocation(item.location)} />
        )}
        {item.purchaseDate && (
          <Row label="Purchased" value={formatDate(item.purchaseDate)} />
        )}
        {item.expiryDate && (
          <Row
            label="Expires"
            value={formatDate(item.expiryDate)}
            valueStyle={
              expStatus === 'expired'
                ? {color: colors.danger}
                : expStatus === 'expiring'
                  ? {color: colors.warning}
                  : undefined
            }
          />
        )}
        {item.notes && <Row label="Notes" value={item.notes} />}
        {!isActive && item.consumedDate && (
          <Row label="Date" value={formatDate(item.consumedDate)} />
        )}
        <Row label="Status" value={statusLabel} />

        {/* ----------------------------------------------------------------- */}
        {/* Action buttons — conditional by status                            */}
        {/* ----------------------------------------------------------------- */}

        {isActive ? (
          <>
            {/* Active: Edit, Transfer, Mark Used */}
            <View style={styles.actions}>
              <Button
                mode="contained"
                icon="pencil"
                onPress={handleOpenEdit}
                style={styles.actionBtn}>
                Edit
              </Button>
              <Button
                mode="contained-tonal"
                icon="swap-horizontal"
                onPress={() => setShowTransferDialog(true)}
                style={styles.actionBtn}>
                Transfer
              </Button>
              <Button
                mode="contained-tonal"
                icon="check-circle-outline"
                onPress={handleMarkConsumed}
                style={styles.actionBtn}>
                Mark Used
              </Button>
            </View>
            <Button
              mode="outlined"
              icon="delete-outline"
              onPress={handleDelete}
              textColor={colors.danger}
              style={styles.deleteBtn}>
              Delete
            </Button>
          </>
        ) : item.status === 'discarded' ? (
          <>
            {/* Discarded: Restore, Edit, Delete */}
            <View style={styles.actions}>
              <Button
                mode="contained"
                icon="restore"
                onPress={handleRestoreToActive}
                style={styles.actionBtn}>
                Restore to Inventory
              </Button>
              <Button
                mode="contained-tonal"
                icon="pencil"
                onPress={handleOpenEdit}
                style={styles.actionBtn}>
                Edit
              </Button>
            </View>
            <Button
              mode="outlined"
              icon="delete-outline"
              onPress={handleDelete}
              textColor={colors.danger}
              style={styles.deleteBtn}>
              Delete
            </Button>
          </>
        ) : (
          <>
            {/* Consumed / Expired: Restore, Move to Past Items, Edit, Delete */}
            <View style={styles.actions}>
              <Button
                mode="contained"
                icon="restore"
                onPress={handleRestoreToActive}
                style={styles.actionBtn}>
                Restore to Inventory
              </Button>
              <Button
                mode="contained-tonal"
                icon="archive-outline"
                onPress={handleMoveToPast}
                style={styles.actionBtn}>
                Move to Past Items
              </Button>
            </View>
            <View style={styles.actions}>
              <Button
                mode="contained-tonal"
                icon="pencil"
                onPress={handleOpenEdit}
                style={styles.actionBtn}>
                Edit
              </Button>
            </View>
            <Button
              mode="outlined"
              icon="delete-outline"
              onPress={handleDelete}
              textColor={colors.danger}
              style={styles.deleteBtn}>
              Delete
            </Button>
          </>
        )}
      </ScrollView>

      {/* Edit Dialog */}
      <Portal>
        <Dialog
          visible={showEditDialog}
          onDismiss={() => setShowEditDialog(false)}>
          <Dialog.Title>Edit Item</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              mode="outlined"
              value={editName}
              onChangeText={setEditName}
              style={styles.dialogInput}
            />
            <TextInput
              label="Notes"
              mode="outlined"
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onPress={handleSaveEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Transfer Dialog */}
      <Portal>
        <Dialog
          visible={showTransferDialog}
          onDismiss={() => setShowTransferDialog(false)}>
          <Dialog.Title>Move to Location</Dialog.Title>
          <Dialog.Content>
            <View style={styles.transferChips}>
              {storageLocations.map(loc => {
                const config = getLocationConfig(loc);
                const isCurrent = item.location === loc;
                return (
                  <Chip
                    key={loc}
                    icon={config.icon}
                    selected={isCurrent}
                    disabled={isCurrent}
                    onPress={() => handleTransfer(loc)}
                    style={[
                      styles.transferChip,
                      isCurrent && {backgroundColor: colors.accentContainer},
                    ]}
                    textStyle={
                      isCurrent ? styles.transferChipTextCurrent : undefined
                    }>
                    {capitaliseLocation(loc)}
                  </Chip>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowTransferDialog(false)}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Row helper
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  const {colors: rowColors} = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, {color: rowColors.textSecondary}]}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 20, paddingBottom: 40},
  brand: {marginTop: 2},
  divider: {marginVertical: 16},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {fontWeight: '600'},
  value: {maxWidth: '60%', textAlign: 'right'},
  // Status badge
  statusBadge: {marginBottom: 12, flexDirection: 'row'},
  statusBadgeText: {fontWeight: '600'},
  statusChip: {},

  // Quantity stepper
  qtyControls: {flexDirection: 'row', alignItems: 'center'},
  qtyBtn: {margin: 0},
  qtyText: {fontWeight: '600', fontSize: 16, minWidth: 50, textAlign: 'center'},

  // Remaining section
  remainingSection: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  remainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  remainingLabel: {},
  remainingPct: {fontWeight: '600'},
  progressBar: {height: 8, borderRadius: 4},
  quickBtns: {flexDirection: 'row', gap: 8, marginTop: 10},
  quickBtn: {flex: 1, borderRadius: 8},
  quickBtnLabel: {fontSize: 11},

  // Action buttons
  actions: {flexDirection: 'row', gap: 8, marginTop: 32, flexWrap: 'wrap'},
  actionBtn: {flex: 1, minWidth: 100},
  deleteBtn: {marginTop: 12},

  // Dialogs
  dialogInput: {marginBottom: 12},
  transferChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  transferChip: {},
  transferChipTextCurrent: {fontWeight: '600'},
});
