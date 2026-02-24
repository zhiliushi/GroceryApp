import React, {useEffect, useState, useCallback} from 'react';
import {View, FlatList, StyleSheet} from 'react-native';
import {Text, Card, FAB, Portal, Dialog, TextInput, Button} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import {useToast} from '../../components/common/ToastProvider';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import type ShoppingList from '../../database/models/ShoppingList';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ListPicker'>;

export default function ListPickerScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const params = route.params as {
    prefill?: Record<string, any>;
  } | undefined;
  const prefill = params?.prefill;

  const {shoppingList: listRepo} = useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();
  const userId = user?.uid ?? 'local';
  const {showSuccess, showError} = useToast();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');

  const loadLists = useCallback(async () => {
    try {
      setLoading(true);
      const activeLists = await listRepo.getActiveLists();
      setLists(activeLists);
    } catch {
      showError('Failed to load lists');
    } finally {
      setLoading(false);
    }
  }, [listRepo]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleSelect = (list: ShoppingList) => {
    navigation.navigate('AddListItem', {
      listId: list.id,
      ...prefill,
    });
  };

  const handleCreateAndSelect = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const newList = await listRepo.createList(name, userId);
      setShowNewDialog(false);
      setNewName('');
      showSuccess(`"${name}" created`);
      navigation.navigate('AddListItem', {
        listId: newList.id,
        ...prefill,
      });
    } catch {
      showError('Failed to create list');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading lists..." />;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text variant="titleMedium" style={styles.header}>
        Choose a Shopping List
      </Text>

      <FlatList
        data={lists}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <Card style={[styles.card, {backgroundColor: colors.surface}]} onPress={() => handleSelect(item)}>
            <Card.Title
              title={item.name}
              subtitle={`Created ${item.createdDate.toLocaleDateString()}`}
              subtitleStyle={{color: colors.textTertiary}}
            />
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-list-outline"
            title="No Shopping Lists"
            description="Create a new list to get started."
            compact
          />
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, {backgroundColor: colors.accent}]}
        onPress={() => setShowNewDialog(true)}
        label="New List"
      />

      <Portal>
        <Dialog
          visible={showNewDialog}
          onDismiss={() => setShowNewDialog(false)}>
          <Dialog.Title>New Shopping List</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="List Name"
              mode="outlined"
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g., Weekly Groceries"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onPress={handleCreateAndSelect} disabled={!newName.trim()}>
              Create & Add Items
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {padding: 16, paddingBottom: 8},
  listContent: {padding: 12, paddingBottom: 80},
  card: {marginBottom: 8, borderRadius: 12},
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
