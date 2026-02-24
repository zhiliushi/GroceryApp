import React, {useMemo} from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';
import {Text, Card} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';
import type PriceHistory from '../../database/models/PriceHistory';

interface PriceComparisonChartProps {
  records: PriceHistory[];
  storeName?: string;
}

/**
 * Simple bar chart showing price trends over time.
 * Uses native Views for a lightweight implementation.
 */
export default function PriceComparisonChart({
  records,
  storeName,
}: PriceComparisonChartProps): React.JSX.Element {
  const {colors} = useAppTheme();

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        statLabel: {
          color: colors.textTertiary,
          marginBottom: 2,
        },
        lowPrice: {
          color: colors.success,
        },
        highPrice: {
          color: colors.danger,
        },
        barPrice: {
          fontSize: 10,
          color: colors.textTertiary,
          marginBottom: 4,
        },
        barDate: {
          fontSize: 9,
          color: colors.textTertiary,
          marginTop: 4,
        },
        chartHint: {
          textAlign: 'center',
          color: colors.textTertiary,
          marginTop: 8,
        },
        emptyText: {
          textAlign: 'center',
          color: colors.textTertiary,
          fontStyle: 'italic',
        },
      }),
    [colors],
  );

  if (records.length === 0) {
    return (
      <Card style={staticStyles.card}>
        <Card.Content>
          <Text style={dynamicStyles.emptyText}>No price history available</Text>
        </Card.Content>
      </Card>
    );
  }

  // Get min and max prices for scaling
  const prices = records.map(r => r.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Calculate statistics
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const latestPrice = records[0].price;

  // Take last 10 records for the chart
  const chartRecords = records.slice(0, 10).reverse();

  const screenWidth = Dimensions.get('window').width - 64;
  const barWidth = Math.floor(screenWidth / chartRecords.length) - 4;
  const maxBarHeight = 100;

  return (
    <Card style={staticStyles.card}>
      <Card.Content>
        {storeName && (
          <Text variant="titleMedium" style={staticStyles.storeTitle}>
            {storeName}
          </Text>
        )}

        {/* Statistics */}
        <View style={staticStyles.statsRow}>
          <View style={staticStyles.stat}>
            <Text variant="bodySmall" style={dynamicStyles.statLabel}>
              Latest
            </Text>
            <Text variant="titleMedium" style={staticStyles.statValue}>
              ${latestPrice.toFixed(2)}
            </Text>
          </View>
          <View style={staticStyles.stat}>
            <Text variant="bodySmall" style={dynamicStyles.statLabel}>
              Average
            </Text>
            <Text variant="titleMedium" style={staticStyles.statValue}>
              ${avgPrice.toFixed(2)}
            </Text>
          </View>
          <View style={staticStyles.stat}>
            <Text variant="bodySmall" style={dynamicStyles.statLabel}>
              Low
            </Text>
            <Text variant="titleMedium" style={[staticStyles.statValue, dynamicStyles.lowPrice]}>
              ${minPrice.toFixed(2)}
            </Text>
          </View>
          <View style={staticStyles.stat}>
            <Text variant="bodySmall" style={dynamicStyles.statLabel}>
              High
            </Text>
            <Text variant="titleMedium" style={[staticStyles.statValue, dynamicStyles.highPrice]}>
              ${maxPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={staticStyles.chartContainer}>
          <View style={staticStyles.bars}>
            {chartRecords.map((record, index) => {
              const height =
                ((record.price - minPrice) / priceRange) * maxBarHeight + 10;
              const isLowest = record.price === minPrice;
              const isHighest = record.price === maxPrice;

              return (
                <View key={record.id} style={staticStyles.barContainer}>
                  <Text style={dynamicStyles.barPrice}>${record.price.toFixed(0)}</Text>
                  <View
                    style={[
                      staticStyles.bar,
                      {
                        width: barWidth,
                        height,
                        backgroundColor: isLowest
                          ? colors.success
                          : isHighest
                          ? colors.danger
                          : colors.accent,
                      },
                    ]}
                  />
                  <Text style={dynamicStyles.barDate}>
                    {new Date(record.purchaseDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text variant="bodySmall" style={dynamicStyles.chartHint}>
          Last {chartRecords.length} purchases
        </Text>
      </Card.Content>
    </Card>
  );
}

const staticStyles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  storeTitle: {
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '600',
  },
  chartContainer: {
    marginTop: 8,
  },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
  },
  barContainer: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: 4,
  },
});
