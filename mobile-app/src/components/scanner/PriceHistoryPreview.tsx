import React, {useState, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Card, IconButton} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAppTheme} from '../../hooks/useAppTheme';
import {timeAgo} from '../../utils/dateUtils';
import type PriceHistory from '../../database/models/PriceHistory';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PriceHistoryPreviewProps {
  barcode: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PriceRow {
  id: string;
  price: number;
  storeName: string;
  purchaseDate: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PriceHistoryPreview({
  barcode,
}: PriceHistoryPreviewProps): React.JSX.Element | null {
  const {colors} = useAppTheme();
  const {priceHistory, store: storeRepo} = useDatabase();

  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch price history + store names
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const records: PriceHistory[] =
          await priceHistory.getByBarcode(barcode);

        if (cancelled) return;

        if (records.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        // Take the 3 most recent (already sorted by purchase_date desc)
        const recent = records.slice(0, 3);

        // Resolve store names
        const resolved: PriceRow[] = await Promise.all(
          recent.map(async record => {
            let storeName = 'Unknown store';
            try {
              const s = await storeRepo.getById(record.storeId);
              storeName = s.name;
            } catch {
              // Store may have been deleted
            }
            return {
              id: record.id,
              price: record.price,
              storeName,
              purchaseDate: record.purchaseDate.getTime(),
            };
          }),
        );

        if (!cancelled) {
          setRows(resolved);
        }
      } catch (err) {
        console.warn('[PriceHistoryPreview] Failed to load:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [barcode, priceHistory, storeRepo]);

  // ---------------------------------------------------------------------------
  // Render nothing when no data
  // ---------------------------------------------------------------------------

  if (loading || rows.length === 0) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Find the lowest price
  // ---------------------------------------------------------------------------

  const lowestPrice = Math.min(...rows.map(r => r.price));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card style={[styles.card, {backgroundColor: colors.surface}]}>
      <Card.Content>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="chart-line"
            size={18}
            style={styles.headerIcon}
          />
          <Text variant="titleSmall">Price History</Text>
        </View>

        {/* Rows */}
        {rows.map(row => {
          const isLowest = row.price === lowestPrice;
          const priceColor = isLowest ? colors.success : colors.textPrimary;

          return (
            <View key={row.id} style={styles.row}>
              <Text
                variant="bodyMedium"
                style={[styles.price, {color: priceColor}]}>
                ${row.price.toFixed(2)}
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.storeName, {color: colors.textSecondary}]}
                numberOfLines={1}>
                at {row.storeName}
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.timeAgo, {color: colors.textTertiary}]}>
                {' \u00B7  '}
                {timeAgo(row.purchaseDate)}
              </Text>
            </View>
          );
        })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIcon: {
    margin: 0,
    marginRight: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  price: {
    fontWeight: '700',
    marginRight: 6,
  },
  storeName: {
    flexShrink: 1,
  },
  timeAgo: {
    marginLeft: 2,
  },
});
