import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  Animated as RNAnimated,
} from 'react-native';
import {
  Text,
  FAB,
  Card,
  IconButton,
  Portal,
  Dialog,
  Button,
  ProgressBar,
  Menu,
  Divider,
  Chip,
  TextInput as PaperInput,
} from 'react-native-paper';
import {Swipeable} from 'react-native-gesture-handler';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import {isFeatureAvailable} from '../../utils/helpers';
import Loading from '../../components/common/Loading';
import Input from '../../components/common/Input';
import type ShoppingList from '../../database/models/ShoppingList';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ShoppingLists'>;

// ---------------------------------------------------------------------------
// List item count cache (avoids per-render async)
// ---------------------------------------------------------------------------

interface ListMeta {
  totalItems: number;
  purchasedItems: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShoppingListsScreen({
  navigation,
}: Props): React.JSX.Element {
  const {shoppingList} = useDatabase();
  const {user, tier} = useAuthStore();
  const {colors} = useAppTheme();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [meta, setMeta] = useState<Record<string, ListMeta>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'history'>('active');

  // Create dialog
  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Context menu
  const [menuListId, setMenuListId] = useState<string | null>(null);

  // Swipeable refs for closing
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    const fetched = filter === 'history'
      ? await shoppingList.getPurchaseHistory()
      : await shoppingList.getActiveLists();
    setLists(fetched);

    // Fetch counts for each list
    const metaMap: Record<string, ListMeta> = {};
    await Promise.all(
      fetched.map(async l => {
        const [total, purchased] = await Promise.all([
          shoppingList.getListItemCount(l.id),
          shoppingList.getPurchasedItemCount(l.id),
        ]);
        metaMap[l.id] = {totalItems: total, purchasedItems: purchased};
      }),
    );
    setMeta(metaMap);
    setLoading(false);
  }, [shoppingList, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload on focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      load();
    });
    return unsub;
  }, [navigation, load]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await shoppingList.createList(name, user?.uid ?? 'local', newNotes.trim() || null);
    setNewName('');
    setNewNotes('');
    setCreateVisible(false);
    load();
  };

  const handleDelete = (list: ShoppingList) => {
    Alert.alert('Delete List', `Delete "${list.name}" and all its items?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await shoppingList.deleteList(list);
          load();
        },
      },
    ]);
  };

  const handleDuplicate = async (list: ShoppingList) => {
    setMenuListId(null);
    await shoppingList.duplicateList(list, user?.uid ?? 'local');
    load();
  };

  const handleToggleComplete = async (list: ShoppingList) => {
    setMenuListId(null);
    if (list.isCompleted) {
      await shoppingList.reopenList(list);
    } else {
      await shoppingList.markCompleted(list);
    }
    load();
  };

  const handleShare = (list: ShoppingList) => {
    setMenuListId(null);
    if (!isFeatureAvailable('cloud_sync', tier)) {
      Alert.alert(
        'Premium Feature',
        'Sharing lists requires a paid subscription.',
        [{text: 'OK'}],
      );
      return;
    }
    // TODO: implement sharing via deep link or cloud
    Alert.alert('Share', `Sharing "${list.name}" coming soon!`);
  };

  // ---------------------------------------------------------------------------
  // Swipe actions
  // ---------------------------------------------------------------------------

  const renderRightActions = (
    list: ShoppingList,
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.swipeActions, {backgroundColor: colors.danger}]}>
        <RNAnimated.View style={{transform: [{scale}]}}>
          <IconButton
            icon="content-copy"
            iconColor={colors.textInverse}
            size={22}
            onPress={() => handleDuplicate(list)}
          />
        </RNAnimated.View>
        <RNAnimated.View style={{transform: [{scale}]}}>
          <IconButton
            icon="delete"
            iconColor={colors.textInverse}
            size={22}
            onPress={() => {
              swipeableRefs.current[list.id]?.close();
              handleDelete(list);
            }}
          />
        </RNAnimated.View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render list card
  // ---------------------------------------------------------------------------

  const renderListCard = ({item: list}: {item: ShoppingList}) => {
    const m = meta[list.id];
    const total = m?.totalItems ?? 0;
    const purchased = m?.purchasedItems ?? 0;
    const progress = total > 0 ? purchased / total : 0;
    const isComplete = list.isCompleted || (total > 0 && purchased === total);

    return (
      <Swipeable
        ref={ref => {
          swipeableRefs.current[list.id] = ref;
        }}
        renderRightActions={(prog, dragX) =>
          renderRightActions(list, prog, dragX)
        }
        overshootRight={false}>
        <Card
          style={[styles.card, {backgroundColor: colors.surface}, isComplete && styles.cardCompleted]}
          onPress={() =>
            navigation.navigate('ListDetail', {listId: list.id, listName: list.name})
          }>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                {isComplete && (
                  <IconButton
                    icon="check-circle"
                    iconColor={colors.success}
                    size={20}
                    style={styles.checkIcon}
                  />
                )}
                <Text
                  variant="titleMedium"
                  style={[styles.listName, isComplete && styles.completedName]}
                  numberOfLines={1}>
                  {list.name}
                </Text>
              </View>

              <Menu
                visible={menuListId === list.id}
                onDismiss={() => setMenuListId(null)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    size={20}
                    onPress={() => setMenuListId(list.id)}
                  />
                }>
                <Menu.Item
                  leadingIcon={list.isCompleted ? 'refresh' : 'check'}
                  onPress={() => handleToggleComplete(list)}
                  title={list.isCompleted ? 'Reopen' : 'Mark Complete'}
                />
                <Menu.Item
                  leadingIcon="content-copy"
                  onPress={() => handleDuplicate(list)}
                  title="Duplicate"
                />
                <Menu.Item
                  leadingIcon="share-variant"
                  onPress={() => handleShare(list)}
                  title="Share"
                />
                <Divider />
                <Menu.Item
                  leadingIcon="delete-outline"
                  onPress={() => {
                    setMenuListId(null);
                    handleDelete(list);
                  }}
                  title="Delete"
                />
              </Menu>
            </View>

            {/* Item count + progress */}
            <View style={styles.metaRow}>
              <Text variant="bodySmall" style={{color: colors.textSecondary}}>
                {total === 0
                  ? 'No items'
                  : `${purchased}/${total} items`}
              </Text>
              <Text variant="bodySmall" style={{color: colors.textTertiary}}>
                {list.isPurchaseRecord && list.checkoutDate
                  ? `Purchased ${new Date(list.checkoutDate).toLocaleDateString()}`
                  : list.createdDate
                    ? new Date(list.createdDate).toLocaleDateString()
                    : ''}
              </Text>
            </View>

            {/* Notes preview */}
            {list.notes ? (
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={[styles.notesPreview, {color: colors.textTertiary}]}>
                {list.notes}
              </Text>
            ) : null}

            {/* Purchase record total price */}
            {list.isPurchaseRecord && list.totalPrice != null && (
              <Text variant="bodySmall" style={[styles.totalPriceText, {color: colors.success}]}>
                Total: ${list.totalPrice.toFixed(2)}
              </Text>
            )}

            {total > 0 && (
              <ProgressBar
                progress={progress}
                color={isComplete ? colors.success : colors.accent}
                style={styles.progressBar}
              />
            )}
          </Card.Content>
        </Card>
      </Swipeable>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  if (loading && lists.length === 0) {
    return <Loading message="Loading lists..." />;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Filter chips */}
      <View style={styles.chipRow}>
        <Chip
          selected={filter === 'active'}
          onPress={() => setFilter('active')}
          showSelectedCheck={false}
          style={[styles.chip, filter === 'active' ? {backgroundColor: colors.accent} : {backgroundColor: colors.surfaceVariant}]}
          textStyle={filter === 'active' ? {color: colors.textInverse} : undefined}>
          Active
        </Chip>
        <Chip
          selected={filter === 'history'}
          onPress={() => setFilter('history')}
          showSelectedCheck={false}
          style={[styles.chip, filter === 'history' ? {backgroundColor: colors.accent} : {backgroundColor: colors.surfaceVariant}]}
          textStyle={filter === 'history' ? {color: colors.textInverse} : undefined}>
          Purchase History
        </Chip>
      </View>

      <FlatList
        data={lists}
        keyExtractor={l => l.id}
        renderItem={renderListCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="headlineSmall" style={styles.emptyIcon}>
              📝
            </Text>
            <Text variant="titleMedium" style={{color: colors.textSecondary}}>
              No shopping lists
            </Text>
            <Text variant="bodyMedium" style={{color: colors.textTertiary, marginTop: 4}}>
              Tap + to create your first list
            </Text>
          </View>
        }
      />

      {/* Create dialog */}
      <Portal>
        <Dialog visible={createVisible} onDismiss={() => { setCreateVisible(false); setNewNotes(''); }}>
          <Dialog.Title>New Shopping List</Dialog.Title>
          <Dialog.Content>
            <Input
              placeholder="List name (e.g. Weekly Groceries)"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={handleCreate}
              autoFocus
            />
            <PaperInput
              mode="outlined"
              placeholder="Trip notes (optional)"
              value={newNotes}
              onChangeText={setNewNotes}
              multiline
              numberOfLines={2}
              dense
              style={{marginTop: 12}}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setCreateVisible(false); setNewNotes(''); }}>Cancel</Button>
            <Button
              onPress={handleCreate}
              disabled={!newName.trim()}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={[styles.fab, {backgroundColor: colors.accent}]}
        onPress={() => setCreateVisible(true)}
        label="New List"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1},
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chip: {marginRight: 8},
  list: {padding: 12, paddingBottom: 100},
  card: {marginBottom: 10, borderRadius: 12, elevation: 2},
  cardCompleted: {opacity: 0.7},
  cardContent: {paddingVertical: 8},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {flexDirection: 'row', alignItems: 'center', flex: 1},
  checkIcon: {margin: 0, marginRight: -4},
  listName: {flex: 1},
  completedName: {textDecorationLine: 'line-through', opacity: 0.6},
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  progressBar: {marginTop: 8, borderRadius: 4, height: 4},
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  fab: {position: 'absolute', right: 16, bottom: 16},
  emptyContainer: {alignItems: 'center', marginTop: 80},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  notesPreview: {fontSize: 11, fontStyle: 'italic', marginTop: 2, paddingHorizontal: 2},
  totalPriceText: {fontWeight: '600', marginTop: 4, paddingHorizontal: 2},
});
