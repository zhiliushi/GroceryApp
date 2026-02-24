import React, {useEffect, useCallback, useState, useRef} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Text,
  IconButton,
  Chip,
  Surface,
  List,
} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import Loading from '../../components/common/Loading';
import SyncStatusBar from '../../components/common/SyncStatusBar';
import {useSync} from '../../hooks/useSync';
import {useNotifications} from '../../hooks/useNotifications';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Home'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

// ---------------------------------------------------------------------------
// Quick action definitions
// ---------------------------------------------------------------------------

interface QuickActionDef {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const ALL_QUICK_ACTIONS: QuickActionDef[] = [
  {key: 'add_inventory', label: 'Add to Inventory', icon: 'plus-circle-outline', color: '#6B7280'},
  {key: 'add_shopping_list', label: 'Add Shopping List', icon: 'clipboard-list-outline', color: '#6B7280'},
  {key: 'restock_settings', label: 'Restock Settings', icon: 'alert-circle-outline', color: '#6B7280'},
  {key: 'scan_barcode', label: 'Scan Barcode', icon: 'barcode-scan', color: '#6B7280'},
  {key: 'past_items', label: 'Past Items', icon: 'history', color: '#6B7280'},
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HomeScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const {inventory, shoppingList} = useDatabase();
  const {user, tier} = useAuthStore();
  const {quickActions} = useSettingsStore();
  const {syncNow} = useSync();
  useNotifications();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [totalItems, setTotalItems] = useState(0);
  const [expiringThisWeek, setExpiringThisWeek] = useState(0);
  const [activeListsCount, setActiveListsCount] = useState(0);
  const [restockCount, setRestockCount] = useState(0);

  // Local user name (from onboarding, for free users)
  const [localName, setLocalName] = useState<string | null>(null);

  // Fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load local user name from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('@user_name').then(name => {
      if (name) setLocalName(name.split(' ')[0]);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadDashboard = useCallback(async () => {
    try {
      const [activeItems, expiringWeek, activeLists, needRestock] =
        await Promise.all([
          inventory.getActive(),
          inventory.getExpiring(7),
          shoppingList.getAll(),
          inventory.getNeedingRestockCount(),
        ]);

      setTotalItems(activeItems.length);
      setExpiringThisWeek(expiringWeek.length);
      setActiveListsCount(activeLists.length);
      setRestockCount(needRestock);
    } catch (e) {
      console.error('[HomeScreen] load error:', e);
    }
  }, [inventory, shoppingList]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDashboard();
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    })();
  }, [loadDashboard, fadeAnim]);

  // Reload on focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadDashboard();
    });
    return unsub;
  }, [navigation, loadDashboard]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const isPaid = tier === 'paid';
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Stats with navigation targets
  const stats = [
    {
      label: 'Shopping Lists',
      value: activeListsCount,
      icon: 'format-list-checks',
      onPress: () => navigation.getParent()?.navigate('ShoppingTab'),
    },
    {
      label: 'Almost Expired',
      value: expiringThisWeek,
      icon: 'clock-alert-outline',
      onPress: () => navigation.getParent()?.navigate('InventoryTab'),
    },
    {
      label: 'Total Items',
      value: totalItems,
      icon: 'package-variant',
      onPress: () => navigation.getParent()?.navigate('InventoryTab'),
    },
    {
      label: 'Need Restock',
      value: restockCount,
      icon: 'alert-circle-outline',
      onPress: () => navigation.navigate('Restock'),
    },
  ];

  // Quick actions navigation
  const handleQuickAction = (key: string) => {
    switch (key) {
      case 'add_inventory':
        navigation.navigate('AddMethod', {context: 'inventory'});
        break;
      case 'add_shopping_list':
        navigation.getParent()?.navigate('ShoppingTab');
        break;
      case 'restock_settings':
        navigation.navigate('Restock');
        break;
      case 'scan_barcode':
        navigation.getParent()?.navigate('ScanTab');
        break;
      case 'past_items':
        navigation.navigate('PastItems');
        break;
    }
  };

  // Filter quick actions based on settings
  const visibleActions = ALL_QUICK_ACTIONS.filter(a =>
    quickActions.includes(a.key),
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <Loading message="Loading dashboard..." />;
  }

  return (
    <Animated.View style={[styles.container, {opacity: fadeAnim, backgroundColor: colors.background}]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {/* ================================================================= */}
        {/* HEADER                                                            */}
        {/* ================================================================= */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text variant="headlineSmall" style={styles.greeting}>
              {greeting}, {user?.displayName?.split(' ')[0] ?? localName ?? 'there'}
            </Text>
            <Text variant="bodyMedium" style={[styles.dateText, {color: colors.textSecondary}]}>
              {today}
            </Text>
          </View>
          <Chip
            icon={isPaid ? 'crown' : 'account'}
            style={[
              styles.tierBadge,
              {backgroundColor: isPaid ? colors.accentContainer : colors.surfaceVariant},
            ]}
            textStyle={[
              styles.tierText,
              {color: isPaid ? colors.accent : colors.textSecondary},
            ]}>
            {isPaid ? 'Premium' : 'Free'}
          </Chip>
        </View>

        {/* Sync status */}
        <SyncStatusBar onSyncPress={syncNow} />

        {/* ================================================================= */}
        {/* QUICK STATS (2x2, clickable)                                      */}
        {/* ================================================================= */}
        <View style={styles.statsGrid}>
          {stats.map(stat => (
            <Pressable key={stat.label} onPress={stat.onPress}>
              <Surface style={[styles.statCard, {backgroundColor: colors.surface}]} elevation={2}>
                <View style={[styles.statIconBg, {backgroundColor: colors.accentContainer}]}>
                  <IconButton
                    icon={stat.icon}
                    iconColor={colors.textSecondary}
                    size={22}
                    style={styles.statIcon}
                  />
                </View>
                <Text
                  variant="headlineMedium"
                  style={[styles.statValue, {color: colors.textPrimary}]}>
                  {stat.value}
                </Text>
                <Text variant="bodySmall" style={[styles.statLabel, {color: colors.textSecondary}]}>
                  {stat.label}
                </Text>
              </Surface>
            </Pressable>
          ))}
        </View>

        {/* ================================================================= */}
        {/* QUICK ACTIONS (vertical list)                                     */}
        {/* ================================================================= */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitlePlain}>
            Quick Actions
          </Text>

          <Surface style={[styles.actionsCard, {backgroundColor: colors.surface}]} elevation={1}>
            {visibleActions.map((action, idx) => (
              <React.Fragment key={action.key}>
                {idx > 0 && <View style={[styles.actionDivider, {backgroundColor: colors.borderSubtle}]} />}
                <List.Item
                  title={action.label}
                  titleStyle={styles.actionTitle}
                  left={() => (
                    <IconButton
                      icon={action.icon}
                      iconColor={colors.textSecondary}
                      size={24}
                      style={styles.actionIcon}
                    />
                  )}
                  right={() => (
                    <IconButton
                      icon="chevron-right"
                      iconColor={colors.textTertiary}
                      size={20}
                      style={styles.actionChevron}
                    />
                  )}
                  onPress={() => handleQuickAction(action.key)}
                  style={styles.actionItem}
                />
              </React.Fragment>
            ))}
          </Surface>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {paddingBottom: 24},

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTextContainer: {flex: 1},
  greeting: {fontWeight: '700'},
  dateText: {marginTop: 2},
  tierBadge: {borderRadius: 20},
  tierText: {fontSize: 12, fontWeight: '600'},

  // Quick stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: 12,
    gap: 10,
  },
  statCard: {
    width: (SCREEN_WIDTH - 34) / 2,
    borderRadius: CARD_RADIUS,
    padding: 14,
    alignItems: 'center',
  },
  statIconBg: {borderRadius: 12, marginBottom: 6},
  statIcon: {margin: 0},
  statValue: {fontWeight: '700', fontSize: 28},
  statLabel: {marginTop: 2, textAlign: 'center'},

  // Section
  section: {marginTop: 20},
  sectionTitlePlain: {
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  // Quick actions (vertical list)
  actionsCard: {
    marginHorizontal: 12,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  actionItem: {
    paddingVertical: 4,
  },
  actionTitle: {
    fontWeight: '500',
  },
  actionIcon: {
    margin: 0,
    marginLeft: 4,
  },
  actionChevron: {
    margin: 0,
  },
  actionDivider: {
    height: 1,
    marginHorizontal: 16,
  },

  bottomSpacer: {height: 20},
});
