import React, {memo, useMemo} from 'react';
import {StyleSheet, View, Image} from 'react-native';
import {Text, Card, Badge, Icon} from 'react-native-paper';
import {expiryStatus, daysUntil, formatDate} from '../../utils/dateUtils';
import {getLocationConfig} from '../../utils/locationUtils';
import {useAppTheme} from '../../hooks/useAppTheme';
import {desaturateCategory} from '../../config/theme';
import type {InventoryItemView} from '../../store/inventoryStore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  item: InventoryItemView;
  onPress: () => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Expiry config
// ---------------------------------------------------------------------------

// EXPIRY_COLORS removed — now derived from theme via useAppTheme()

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function InventoryItemCard({
  item,
  onPress,
  compact = false,
}: Props): React.JSX.Element {
  const {colors} = useAppTheme();

  const EXPIRY_COLORS = useMemo(
    () => ({
      fresh: colors.success,
      expiring: colors.warning,
      expired: colors.danger,
      unknown: colors.textTertiary,
    }),
    [colors],
  );

  const status = useMemo(
    () => expiryStatus(item.expiryDate),
    [item.expiryDate],
  );

  const expiryLabel = useMemo(() => {
    if (!item.expiryDate) return null;
    const days = daysUntil(item.expiryDate);
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    if (days <= 7) return `${days}d left`;
    return formatDate(item.expiryDate);
  }, [item.expiryDate]);

  const locConfig = getLocationConfig(item.location);
  const isActive = item.status === 'active';
  const statusLabel =
    item.status === 'consumed'
      ? 'Used Up'
      : item.status === 'expired'
        ? 'Expired'
        : item.status === 'discarded'
          ? 'Discarded'
          : null;

  // -----------------------------------------------------------------------
  // Compact layout (grid mode)
  // -----------------------------------------------------------------------

  if (compact) {
    return (
      <Card style={[styles.compactCard, !isActive && styles.dimmedCard]} onPress={onPress}>
        {item.imageUrl ? (
          <Image source={{uri: item.imageUrl}} style={styles.compactImage} />
        ) : (
          <View style={[styles.compactImage, styles.compactPlaceholder, {backgroundColor: colors.surfaceVariant}]}>
            <Icon source="food-variant" size={32} color="#bdbdbd" />
          </View>
        )}
        <View style={styles.compactBody}>
          <Text variant="labelLarge" numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.compactMeta, {color: colors.textSecondary}]} numberOfLines={1}>
            {item.quantity} {item.unitAbbreviation}
          </Text>
          {expiryLabel && isActive && (
            <Text
              style={[styles.compactExpiry, {color: EXPIRY_COLORS[status]}]}
              numberOfLines={1}>
              {expiryLabel}
            </Text>
          )}
          {!isActive && statusLabel && (
            <Text style={[styles.statusBadgeText, {color: colors.warning}]} numberOfLines={1}>
              {statusLabel}
            </Text>
          )}
        </View>
      </Card>
    );
  }

  // -----------------------------------------------------------------------
  // Full layout (list mode)
  // -----------------------------------------------------------------------

  return (
    <Card style={[styles.card, !isActive && styles.dimmedCard]} onPress={onPress}>
      <View style={styles.row}>
        {/* Left: Image or placeholder */}
        {item.imageUrl ? (
          <Image source={{uri: item.imageUrl}} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder, {backgroundColor: colors.surfaceVariant}]}>
            <Icon source="food-variant" size={28} color="#bdbdbd" />
          </View>
        )}

        {/* Center: text info */}
        <View style={styles.info}>
          <Text variant="titleMedium" numberOfLines={1}>
            {item.name}
          </Text>

          {item.brand ? (
            <Text style={[styles.brand, {color: colors.textTertiary}]} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={[styles.quantity, {color: colors.textSecondary}]}>
              {item.quantity} {item.unitAbbreviation}
            </Text>
            {item.categoryName ? (
              <Badge
                style={[
                  styles.categoryBadge,
                  {backgroundColor: desaturateCategory(item.categoryColor) || '#9E9E9E'},
                ]}
                size={20}>
                {item.categoryName}
              </Badge>
            ) : null}
          </View>

          {/* Expiry line — active items only */}
          {expiryLabel && isActive && (
            <View style={styles.expiryRow}>
              <Icon
                source={
                  status === 'expired'
                    ? 'alert-circle'
                    : status === 'expiring'
                      ? 'clock-alert-outline'
                      : 'calendar-check-outline'
                }
                size={14}
                color={EXPIRY_COLORS[status]}
              />
              <Text
                style={[
                  styles.expiryText,
                  {color: EXPIRY_COLORS[status]},
                ]}>
                {expiryLabel}
              </Text>
            </View>
          )}

          {/* Status badge for non-active items */}
          {!isActive && statusLabel && (
            <View style={styles.statusRow}>
              <Icon
                source={
                  item.status === 'expired'
                    ? 'clock-alert-outline'
                    : item.status === 'consumed'
                      ? 'check-circle-outline'
                      : 'delete-outline'
                }
                size={14}
                color={
                  item.status === 'expired'
                    ? colors.danger
                    : item.status === 'consumed'
                      ? colors.success
                      : colors.warning
                }
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.status === 'expired'
                        ? colors.danger
                        : item.status === 'consumed'
                          ? colors.success
                          : colors.warning,
                  },
                ]}>
                {statusLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Right: location badge */}
        <View style={styles.right}>
          <View style={[styles.locationBadge, {backgroundColor: locConfig.color + '24'}]}>
            <Icon source={locConfig.icon} size={16} color={locConfig.color} />
            <Text style={[styles.locationText, {color: locConfig.color}]}>
              {locConfig.label}
            </Text>
          </View>
        </View>
      </View>

    </Card>
  );
}

export default memo(InventoryItemCard);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // List mode
  card: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  brand: {
    fontSize: 12,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  quantity: {
    fontSize: 13,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    fontSize: 10,
    color: '#fff',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Grid / compact mode
  compactCard: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
  },
  compactImage: {
    width: '100%',
    height: 100,
  },
  compactPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactBody: {
    padding: 8,
  },
  compactMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  compactExpiry: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  // Status badge (non-active items)
  dimmedCard: {
    opacity: 0.75,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});
