import React, {useState, useEffect, useCallback} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text, Button, TextInput, Card, Chip, ActivityIndicator} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useGeolocation} from '../../hooks/useGeolocation';
import {useAuthStore} from '../../store/authStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import firestoreService from '../../services/firebase/FirestoreService';
import type Store from '../../database/models/Store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecordPriceCardProps {
  barcode: string;
  productName: string;
  onRecorded?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecordPriceCard({
  barcode,
  productName,
  onRecorded,
}: RecordPriceCardProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const {store: storeRepo, priceHistory} = useDatabase();
  const geo = useGeolocation();
  const user = useAuthStore(s => s.user);
  const {currency} = useSettingsStore();

  const userId = user?.uid ?? 'local';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [useNewStore, setUseNewStore] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Load existing stores
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;

    async function loadStores() {
      try {
        const result = await storeRepo.getByUserId(userId);
        if (!cancelled) {
          setStores(result);
        }
      } catch (err) {
        console.warn('[RecordPriceCard] Failed to load stores:', err);
      }
    }

    loadStores();
    return () => {
      cancelled = true;
    };
  }, [expanded, storeRepo, userId]);

  // ---------------------------------------------------------------------------
  // Pre-fill new store from geolocation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!expanded) return;
    if (geo.placeName && !geo.loading) {
      setNewStoreName(geo.placeName);
      setUseNewStore(true);
      setSelectedStoreId(null);
    }
  }, [expanded, geo.placeName, geo.loading]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleExpand = useCallback(() => {
    setExpanded(true);
  }, []);

  const handleCancel = useCallback(() => {
    setExpanded(false);
    setPrice('');
    setSelectedStoreId(null);
    setNewStoreName('');
    setUseNewStore(false);
  }, []);

  const handleSelectExistingStore = useCallback((storeId: string) => {
    setSelectedStoreId(storeId);
    setUseNewStore(false);
  }, []);

  const handleNewStoreChange = useCallback((text: string) => {
    setNewStoreName(text);
    if (text.trim().length > 0) {
      setUseNewStore(true);
      setSelectedStoreId(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const parsedPrice = parseFloat(price);
  const isPriceValid = !isNaN(parsedPrice) && parsedPrice > 0;
  const hasStore = useNewStore
    ? newStoreName.trim().length > 0
    : selectedStoreId !== null;
  const canSave = isPriceValid && hasStore && !saving;

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    setSaving(true);

    try {
      // 1. Get or create store
      const storeName = useNewStore ? newStoreName.trim() : null;
      let store: Store;

      if (useNewStore && storeName) {
        store = await storeRepo.getOrCreate(storeName, userId);

        // Update store with geo data if available
        if (geo.latitude !== null && geo.longitude !== null) {
          await store.updateDetails({
            address: geo.address ?? undefined,
            latitude: geo.latitude,
            longitude: geo.longitude,
          });
        }
      } else {
        store = await storeRepo.getById(selectedStoreId!);
      }

      // 2. Save locally
      await priceHistory.create({
        barcode,
        name: productName,
        storeId: store.id,
        price: parsedPrice,
        userId,
      });

      // 3. Push to Firebase (non-blocking)
      firestoreService
        .pushPriceRecord(userId, {
          barcode,
          productName,
          price: parsedPrice,
          currency,
          storeName: store.name,
          locationAddress: geo.address,
          latitude: geo.latitude,
          longitude: geo.longitude,
        })
        .catch(err =>
          console.warn('[RecordPriceCard] Firebase push failed:', err),
        );

      // 4. Collapse and notify
      setExpanded(false);
      setPrice('');
      setSelectedStoreId(null);
      setNewStoreName('');
      setUseNewStore(false);
      onRecorded?.();
    } catch (err: any) {
      console.error('[RecordPriceCard] Save failed:', err);
      Alert.alert('Error', err?.message ?? 'Failed to save price record.');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    useNewStore,
    newStoreName,
    selectedStoreId,
    storeRepo,
    userId,
    geo,
    priceHistory,
    barcode,
    productName,
    parsedPrice,
    currency,
    onRecorded,
  ]);

  // ---------------------------------------------------------------------------
  // Render — Collapsed
  // ---------------------------------------------------------------------------

  if (!expanded) {
    return (
      <Card style={[styles.card, {backgroundColor: colors.surface}]}>
        <Card.Content>
          <Button
            mode="text"
            icon="tag"
            onPress={handleExpand}
            contentStyle={styles.collapsedBtnContent}>
            Record Price
          </Button>
        </Card.Content>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — Expanded
  // ---------------------------------------------------------------------------

  return (
    <Card style={[styles.card, {backgroundColor: colors.surface}]}>
      <Card.Content>
        {/* Price input */}
        <TextInput
          label="Price"
          value={price}
          onChangeText={setPrice}
          mode="outlined"
          keyboardType="decimal-pad"
          dense
          style={styles.priceInput}
          left={<TextInput.Icon icon="currency-usd" />}
        />

        {/* Store selector */}
        <Text
          variant="labelMedium"
          style={[styles.sectionLabel, {color: colors.textSecondary}]}>
          Store
        </Text>

        {/* Existing store chips */}
        {stores.length > 0 && (
          <View style={styles.storeChips}>
            {stores.map(s => (
              <Button
                key={s.id}
                mode={
                  !useNewStore && selectedStoreId === s.id
                    ? 'contained'
                    : 'outlined'
                }
                compact
                onPress={() => handleSelectExistingStore(s.id)}
                style={styles.storeChip}>
                {s.name}
              </Button>
            ))}
          </View>
        )}

        {/* New store input */}
        <TextInput
          label="New Store"
          value={newStoreName}
          onChangeText={handleNewStoreChange}
          mode="outlined"
          dense
          style={styles.newStoreInput}
        />

        {/* Auto-location display */}
        {geo.loading && (
          <View style={styles.locationRow}>
            <ActivityIndicator size="small" />
          </View>
        )}
        {!geo.loading && geo.address && (
          <View style={styles.locationRow}>
            <Chip icon="map-marker" compact>
              {geo.address}
            </Chip>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="text"
            onPress={handleCancel}
            disabled={saving}
            style={styles.cancelBtn}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
            buttonColor={colors.accent}
            textColor={colors.textInverse}
            style={styles.saveBtn}>
            Save
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    elevation: 1,
    marginTop: 12,
    alignSelf: 'stretch',
  },
  collapsedBtnContent: {
    justifyContent: 'flex-start',
  },
  priceInput: {
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  storeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  storeChip: {
    marginBottom: 0,
  },
  newStoreInput: {
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtn: {
    marginRight: 8,
  },
  saveBtn: {},
});
