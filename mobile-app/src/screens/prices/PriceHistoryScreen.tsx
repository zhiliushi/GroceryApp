import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {View, ScrollView, StyleSheet} from 'react-native';
import {Text, Card, Chip, Divider} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import Loading from '../../components/common/Loading';
import PriceComparisonChart from '../../components/prices/PriceComparisonChart';
import type PriceHistory from '../../database/models/PriceHistory';
import type Store from '../../database/models/Store';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'PriceHistory'>;

interface StoreComparison {
  store: Store;
  records: PriceHistory[];
  lowestPrice: number;
  averagePrice: number;
  latestPrice: number;
}

export default function PriceHistoryScreen({
  route,
}: Props): React.JSX.Element {
  const {barcode, productName} = route.params as {
    barcode: string;
    productName: string;
  };

  const {priceHistory, store: storeRepo} = useDatabase();
  const {colors} = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PriceHistory[]>([]);
  const [storeComparisons, setStoreComparisons] = useState<StoreComparison[]>(
    [],
  );
  const [bestDeal, setBestDeal] = useState<PriceHistory | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get all price history for this barcode
      const allRecords = await priceHistory.getByBarcode(barcode);
      setRecords(allRecords);

      // Find best deal (recent lowest price)
      const deal = await priceHistory.findBestDeal(barcode);
      setBestDeal(deal);

      // Group by store and calculate stats
      const storeMap = new Map<string, PriceHistory[]>();
      for (const record of allRecords) {
        const existing = storeMap.get(record.storeId) ?? [];
        existing.push(record);
        storeMap.set(record.storeId, existing);
      }

      // Build comparisons with store details
      const comparisons: StoreComparison[] = [];
      for (const [storeId, storeRecords] of storeMap) {
        try {
          const store = await storeRepo.getById(storeId);
          const prices = storeRecords.map(r => r.price);
          comparisons.push({
            store,
            records: storeRecords,
            lowestPrice: Math.min(...prices),
            averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
            latestPrice: storeRecords[0].price,
          });
        } catch (e) {
          // Store may have been deleted
          console.warn(`Store ${storeId} not found`);
        }
      }

      // Sort by lowest price
      comparisons.sort((a, b) => a.lowestPrice - b.lowestPrice);
      setStoreComparisons(comparisons);
    } catch (error) {
      console.error('Failed to load price history:', error);
    } finally {
      setLoading(false);
    }
  }, [barcode, priceHistory, storeRepo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Dynamic styles
  // ---------------------------------------------------------------------------

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        barcode: {
          fontFamily: 'monospace',
          color: colors.textTertiary,
          marginTop: 4,
        },
        recordCount: {
          color: colors.textSecondary,
          marginTop: 8,
        },
        bestDealCard: {
          backgroundColor: colors.successBg,
        },
        bestDealChip: {
          backgroundColor: colors.accent,
        },
        bestDealPrice: {
          color: colors.success,
          fontWeight: '700',
          marginTop: 8,
        },
        bestDealMeta: {
          color: colors.textTertiary,
          marginTop: 4,
        },
        lowestChip: {
          backgroundColor: colors.successBg,
        },
        priceLabel: {
          color: colors.textTertiary,
          marginBottom: 2,
        },
        lowestPrice: {
          color: colors.success,
        },
        emptySubtitle: {
          color: colors.textTertiary,
          marginTop: 8,
          textAlign: 'center',
        },
      }),
    [colors],
  );

  if (loading) {
    return <Loading message="Loading price history..." />;
  }

  if (records.length === 0) {
    return (
      <View style={staticStyles.emptyContainer}>
        <Text style={staticStyles.emptyIcon}>📊</Text>
        <Text variant="titleMedium">No Price History</Text>
        <Text variant="bodyMedium" style={dynamicStyles.emptySubtitle}>
          Purchase this item to start tracking prices
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={staticStyles.content}>
      {/* Product header */}
      <Card style={staticStyles.headerCard}>
        <Card.Content>
          <Text variant="titleLarge">{productName}</Text>
          <Text variant="bodySmall" style={dynamicStyles.barcode}>
            {barcode}
          </Text>
          <Text variant="bodyMedium" style={dynamicStyles.recordCount}>
            {records.length} price {records.length === 1 ? 'record' : 'records'}{' '}
            across {storeComparisons.length}{' '}
            {storeComparisons.length === 1 ? 'store' : 'stores'}
          </Text>
        </Card.Content>
      </Card>

      {/* Best deal highlight */}
      {bestDeal && (
        <Card style={[staticStyles.card, dynamicStyles.bestDealCard]}>
          <Card.Content>
            <View style={staticStyles.bestDealHeader}>
              <Chip mode="flat" style={dynamicStyles.bestDealChip}>
                Best Recent Deal
              </Chip>
            </View>
            <Text variant="headlineMedium" style={dynamicStyles.bestDealPrice}>
              ${bestDeal.price.toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={dynamicStyles.bestDealMeta}>
              {new Date(bestDeal.purchaseDate).toLocaleDateString()}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Store comparisons */}
      <Text variant="titleMedium" style={staticStyles.sectionTitle}>
        Price by Store
      </Text>

      {storeComparisons.map((comparison, index) => (
        <React.Fragment key={comparison.store.id}>
          {index > 0 && <Divider style={staticStyles.divider} />}
          <Card style={staticStyles.storeCard}>
            <Card.Content>
              <View style={staticStyles.storeHeader}>
                <Text variant="titleMedium">{comparison.store.name}</Text>
                {index === 0 && (
                  <Chip compact mode="flat" style={dynamicStyles.lowestChip}>
                    Lowest
                  </Chip>
                )}
              </View>
              <View style={staticStyles.storePrices}>
                <View style={staticStyles.priceItem}>
                  <Text variant="bodySmall" style={dynamicStyles.priceLabel}>
                    Latest
                  </Text>
                  <Text variant="titleMedium">
                    ${comparison.latestPrice.toFixed(2)}
                  </Text>
                </View>
                <View style={staticStyles.priceItem}>
                  <Text variant="bodySmall" style={dynamicStyles.priceLabel}>
                    Average
                  </Text>
                  <Text variant="titleMedium">
                    ${comparison.averagePrice.toFixed(2)}
                  </Text>
                </View>
                <View style={staticStyles.priceItem}>
                  <Text variant="bodySmall" style={dynamicStyles.priceLabel}>
                    Lowest
                  </Text>
                  <Text variant="titleMedium" style={dynamicStyles.lowestPrice}>
                    ${comparison.lowestPrice.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </React.Fragment>
      ))}

      {/* Price trend chart */}
      <Text variant="titleMedium" style={staticStyles.sectionTitle}>
        Price Trend
      </Text>
      <PriceComparisonChart records={records} />
    </ScrollView>
  );
}

const staticStyles = StyleSheet.create({
  content: {
    padding: 12,
    paddingBottom: 32,
  },
  headerCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  bestDealHeader: {
    flexDirection: 'row',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  divider: {
    marginVertical: 8,
  },
  storeCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storePrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceItem: {
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
});
