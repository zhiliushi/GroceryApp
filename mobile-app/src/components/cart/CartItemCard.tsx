import React, {useMemo} from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {Card, Text, IconButton, Chip} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';
import type CartItem from '../../database/models/CartItem';

interface CartItemCardProps {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onEdit: () => void;
}

export default function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onEdit,
}: CartItemCardProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const totalPrice = item.totalPrice;

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        imagePlaceholder: {
          width: 60,
          height: 60,
          borderRadius: 8,
          marginRight: 12,
          backgroundColor: colors.surfaceVariant,
          justifyContent: 'center',
          alignItems: 'center',
        },
        imagePlaceholderText: {
          fontSize: 10,
          color: colors.textTertiary,
        },
        brand: {
          color: colors.textTertiary,
          marginBottom: 4,
        },
        priceChip: {
          backgroundColor: colors.successBg,
        },
        weightText: {
          color: colors.textTertiary,
        },
        quantityRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        total: {
          color: colors.success,
          fontWeight: '600',
        },
      }),
    [colors],
  );

  return (
    <Card style={staticStyles.card} onPress={onEdit}>
      <Card.Content style={staticStyles.content}>
        <View style={staticStyles.row}>
          {/* Product image */}
          {item.imageUrl ? (
            <Image source={{uri: item.imageUrl}} style={staticStyles.image} />
          ) : (
            <View style={dynamicStyles.imagePlaceholder}>
              <Text style={dynamicStyles.imagePlaceholderText}>No img</Text>
            </View>
          )}

          {/* Product info */}
          <View style={staticStyles.info}>
            <Text variant="titleMedium" numberOfLines={2} style={staticStyles.name}>
              {item.name}
            </Text>
            {item.brand && (
              <Text variant="bodySmall" style={dynamicStyles.brand}>
                {item.brand}
              </Text>
            )}

            {/* Price and weight info */}
            <View style={staticStyles.priceRow}>
              {item.hasPrice && (
                <Chip compact style={dynamicStyles.priceChip}>
                  ${item.price?.toFixed(2)}
                </Chip>
              )}
              {item.hasWeight && (
                <Text variant="bodySmall" style={dynamicStyles.weightText}>
                  {item.weight} {item.weightUnit}
                </Text>
              )}
            </View>
          </View>

          {/* Remove button */}
          <IconButton
            icon="close"
            size={20}
            onPress={onRemove}
            style={staticStyles.removeBtn}
          />
        </View>

        {/* Quantity controls + total */}
        <View style={dynamicStyles.quantityRow}>
          <View style={staticStyles.quantityControls}>
            <IconButton
              icon="minus"
              mode="outlined"
              size={16}
              onPress={onDecrement}
              disabled={item.quantity <= 1}
            />
            <Text variant="titleMedium" style={staticStyles.quantity}>
              {item.quantity}
            </Text>
            <IconButton
              icon="plus"
              mode="outlined"
              size={16}
              onPress={onIncrement}
            />
          </View>

          {totalPrice !== null && (
            <Text variant="titleMedium" style={dynamicStyles.total}>
              Total: ${totalPrice.toFixed(2)}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const staticStyles = StyleSheet.create({
  card: {
    marginBottom: 10,
    borderRadius: 12,
    elevation: 2,
  },
  content: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeBtn: {
    margin: 0,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantity: {
    marginHorizontal: 16,
    minWidth: 30,
    textAlign: 'center',
  },
});
