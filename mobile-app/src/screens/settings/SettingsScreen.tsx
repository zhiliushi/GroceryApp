import React, {useState} from 'react';
import {View, ScrollView, StyleSheet, Alert} from 'react-native';
import {
  Text,
  List,
  Switch,
  Divider,
  Button,
  Chip,
  IconButton,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {useAuthStore} from '../../store/authStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useSync} from '../../hooks/useSync';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import AuthService from '../../services/firebase/AuthService';
import {timeAgo} from '../../utils/dateUtils';
import {getLocationConfig, capitaliseLocation} from '../../utils/locationUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen(): React.JSX.Element {
  const {colors} = useAppTheme();
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated, tier} = useAuthStore();
  const {
    theme, notificationsEnabled, expiryAlertDays, quickActions,
    storageLocations, defaultStorageLocation, shoppingItemExpiryDays,
    autoLocationEnabled,
    setTheme, setNotificationsEnabled, setExpiryAlertDays, setQuickActions,
    addStorageLocation, removeStorageLocation, setDefaultStorageLocation,
    setShoppingItemExpiryDays, setAutoLocationEnabled,
  } = useSettingsStore();
  const {status: syncStatus, lastSyncAt, syncNow} = useSync();
  const {inventory} = useDatabase();

  // Dialog states
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [showShoppingExpiryDialog, setShowShoppingExpiryDialog] = useState(false);

  const SHOPPING_EXPIRY_OPTIONS = [
    {label: '3 days', value: 3},
    {label: '7 days', value: 7},
    {label: '14 days', value: 14},
    {label: '30 days', value: 30},
    {label: 'Never', value: 0},
  ];

  const QUICK_ACTION_OPTIONS = [
    {key: 'add_inventory', label: 'Add to Inventory'},
    {key: 'add_shopping_list', label: 'Add Shopping List'},
    {key: 'restock_settings', label: 'Restock Settings'},
    {key: 'scan_barcode', label: 'Scan Barcode'},
    {key: 'past_items', label: 'Past Items'},
  ];

  const toggleQuickAction = (key: string) => {
    if (quickActions.includes(key)) {
      if (quickActions.length <= 1) return;
      setQuickActions(quickActions.filter(a => a !== key));
    } else {
      setQuickActions([...quickActions, key]);
    }
  };

  const handleRemoveLocation = async (location: string) => {
    if (storageLocations.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one storage location.');
      return;
    }
    try {
      const activeItems = await inventory.getActive();
      const itemsInLocation = activeItems.filter(i => i.location === location);
      if (itemsInLocation.length > 0) {
        Alert.alert(
          'Location Has Items',
          `There are ${itemsInLocation.length} item(s) in "${capitaliseLocation(location)}". Please move them first.`,
          [{text: 'OK'}],
        );
        return;
      }
    } catch {
      // If we can't check, allow removal with confirmation
    }
    Alert.alert(
      'Remove Location',
      `Remove "${capitaliseLocation(location)}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Remove', style: 'destructive', onPress: () => removeStorageLocation(location)},
      ],
    );
  };

  const handleAddLocation = () => {
    const name = newLocationName.trim().toLowerCase();
    if (!name) return;
    if (storageLocations.includes(name)) {
      Alert.alert('Duplicate', 'This location already exists.');
      return;
    }
    addStorageLocation(name);
    setNewLocationName('');
    setShowAddLocationDialog(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign Out', onPress: () => AuthService.signOut()},
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Account */}
      <List.Section title="Account">
        {isAuthenticated && user ? (
          <>
            <List.Item
              title={user.displayName ?? 'User'}
              description={user.email ?? ''}
              left={props => <List.Icon {...props} icon="account" />}
            />
            <List.Item
              title="Subscription"
              description={tier === 'paid' ? 'Premium' : 'Free'}
              left={props => <List.Icon {...props} icon="star" />}
            />
          </>
        ) : (
          <>
            <List.Item
              title="Not signed in"
              description="Sign in to sync data across devices"
              left={props => <List.Icon {...props} icon="account-outline" />}
            />
            <View style={styles.signInBtn}>
              <Button
                mode="contained"
                icon="login"
                onPress={() => navigation.navigate('Login')}>
                Sign In
              </Button>
            </View>
          </>
        )}
      </List.Section>

      <Divider />

      {/* Appearance */}
      <List.Section title="Appearance">
        <List.Item
          title="Theme"
          description={theme}
          left={props => <List.Icon {...props} icon="brightness-6" />}
          onPress={() => {
            const next =
              theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
            setTheme(next);
          }}
        />
      </List.Section>

      <Divider />

      {/* Storage Locations */}
      <List.Section title="Storage Locations">
        {storageLocations.map(loc => {
          const config = getLocationConfig(loc);
          const isDefault = defaultStorageLocation === loc;
          return (
            <List.Item
              key={loc}
              title={capitaliseLocation(loc)}
              left={props => <List.Icon {...props} icon={config.icon} />}
              right={() => (
                <View style={styles.locationRight}>
                  {isDefault && (
                    <Chip compact style={[styles.defaultChip, {backgroundColor: colors.accentContainer}]} textStyle={[styles.defaultChipText, {color: colors.accent}]}>
                      Default
                    </Chip>
                  )}
                  {storageLocations.length > 1 && (
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      onPress={() => handleRemoveLocation(loc)}
                    />
                  )}
                </View>
              )}
              onPress={() => setDefaultStorageLocation(loc)}
              description={isDefault ? undefined : 'Tap to set as default'}
            />
          );
        })}
        <View style={styles.addLocationBtn}>
          <Button
            mode="text"
            icon="plus"
            onPress={() => setShowAddLocationDialog(true)}>
            Add Location
          </Button>
        </View>
      </List.Section>

      <Divider />

      {/* Quick Actions */}
      <List.Section title="Quick Actions">
        {QUICK_ACTION_OPTIONS.map(opt => (
          <List.Item
            key={opt.key}
            title={opt.label}
            left={props => <List.Icon {...props} icon="flash" />}
            right={() => (
              <Switch
                value={quickActions.includes(opt.key)}
                onValueChange={() => toggleQuickAction(opt.key)}
                color={colors.accent}
              />
            )}
          />
        ))}
      </List.Section>

      <Divider />

      {/* Price Tracking */}
      <List.Section title="Price Tracking">
        <List.Item
          title="Auto-detect Location"
          description="Use GPS to record purchase location"
          left={props => <List.Icon {...props} icon="map-marker" />}
          right={() => (
            <Switch
              value={autoLocationEnabled}
              onValueChange={setAutoLocationEnabled}
              color={colors.accent}
            />
          )}
        />
      </List.Section>

      <Divider />

      {/* Shopping */}
      <List.Section title="Shopping">
        <List.Item
          title="Unticked Item Expiry"
          description={shoppingItemExpiryDays === 0
            ? 'Never auto-remove'
            : `Remove after ${shoppingItemExpiryDays} days`}
          left={props => <List.Icon {...props} icon="timer-sand" />}
          onPress={() => setShowShoppingExpiryDialog(true)}
        />
      </List.Section>

      <Divider />

      {/* Notifications */}
      <List.Section title="Notifications">
        <List.Item
          title="Enable Notifications"
          left={props => <List.Icon {...props} icon="bell" />}
          right={() => (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              color={colors.accent}
            />
          )}
        />
        <List.Item
          title="Expiry Alert Days"
          description={`${expiryAlertDays} days before expiry`}
          left={props => <List.Icon {...props} icon="clock-alert" />}
          onPress={() => setShowExpiryDialog(true)}
        />
      </List.Section>

      <Divider />

      {/* Sync */}
      {tier === 'paid' && (
        <>
          <List.Section title="Data & Sync">
            <List.Item
              title="Last Synced"
              description={lastSyncAt ? timeAgo(lastSyncAt) : 'Never'}
              left={props => <List.Icon {...props} icon="cloud-sync" />}
            />
            <View style={styles.syncBtn}>
              <Button
                mode="outlined"
                onPress={syncNow}
                loading={syncStatus === 'syncing'}
                disabled={syncStatus === 'syncing'}>
                Sync Now
              </Button>
            </View>
          </List.Section>
          <Divider />
        </>
      )}

      {/* About */}
      <List.Section title="About">
        <List.Item
          title="Version"
          description="0.0.1"
          left={props => <List.Icon {...props} icon="information" />}
        />
      </List.Section>

      {isAuthenticated && (
        <View style={styles.signOut}>
          <Button mode="outlined" textColor={colors.danger} onPress={handleSignOut}>
            Sign Out
          </Button>
        </View>
      )}

      {/* Expiry Alert Days Dialog */}
      <Portal>
        <Dialog visible={showExpiryDialog} onDismiss={() => setShowExpiryDialog(false)}>
          <Dialog.Title>Expiry Alert Days</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogHint}>
              Get notified this many days before items expire
            </Text>
            <View style={styles.stepperRow}>
              <IconButton
                icon="minus"
                mode="contained"
                onPress={() => {
                  if (expiryAlertDays > 1) setExpiryAlertDays(expiryAlertDays - 1);
                }}
                disabled={expiryAlertDays <= 1}
              />
              <Text variant="headlineLarge" style={styles.stepperValue}>
                {expiryAlertDays}
              </Text>
              <IconButton
                icon="plus"
                mode="contained"
                onPress={() => {
                  if (expiryAlertDays < 14) setExpiryAlertDays(expiryAlertDays + 1);
                }}
                disabled={expiryAlertDays >= 14}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowExpiryDialog(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Shopping Item Expiry Dialog */}
      <Portal>
        <Dialog visible={showShoppingExpiryDialog} onDismiss={() => setShowShoppingExpiryDialog(false)}>
          <Dialog.Title>Unticked Item Expiry</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogHint}>
              Auto-remove unticked shopping list items after this period
            </Text>
            <View style={styles.expiryChips}>
              {SHOPPING_EXPIRY_OPTIONS.map(opt => (
                <Chip
                  key={opt.value}
                  selected={shoppingItemExpiryDays === opt.value}
                  onPress={() => {
                    setShoppingItemExpiryDays(opt.value);
                    setShowShoppingExpiryDialog(false);
                  }}
                  showSelectedCheck
                  style={styles.expiryChip}>
                  {opt.label}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShoppingExpiryDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Location Dialog */}
      <Portal>
        <Dialog visible={showAddLocationDialog} onDismiss={() => setShowAddLocationDialog(false)}>
          <Dialog.Title>Add Storage Location</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Location Name"
              mode="outlined"
              value={newLocationName}
              onChangeText={setNewLocationName}
              placeholder="e.g., Garage, Basement"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setShowAddLocationDialog(false); setNewLocationName(''); }}>
              Cancel
            </Button>
            <Button onPress={handleAddLocation} disabled={!newLocationName.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  signInBtn: {paddingHorizontal: 16, paddingBottom: 8},
  syncBtn: {paddingHorizontal: 16, paddingBottom: 8},
  signOut: {padding: 16, marginBottom: 32},
  locationRight: {flexDirection: 'row', alignItems: 'center'},
  defaultChip: {marginRight: 4},
  defaultChipText: {fontSize: 11},
  addLocationBtn: {paddingHorizontal: 8},
  dialogHint: {textAlign: 'center', marginBottom: 16},
  stepperRow: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16},
  stepperValue: {minWidth: 48, textAlign: 'center'},
  expiryChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center'},
  expiryChip: {marginVertical: 2},
});
