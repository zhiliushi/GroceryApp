import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {View, FlatList, StyleSheet, Alert} from 'react-native';
import {Text, FAB, Button, Divider} from 'react-native-paper';
import {useDatabase} from '../../hooks/useDatabase';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import CartItemCard from '../../components/cart/CartItemCard';
import Loading from '../../components/common/Loading';
import type CartItem from '../../database/models/CartItem';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ShoppingCart'>;

export default function ShoppingCartScreen({
  navigation,
}: Props): React.JSX.Element {
  const {cart} = useDatabase();
  const {user} = useAuthStore();
  const {colors} = useAppTheme();
  const userId = user?.uid ?? 'local';

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPrice, setTotalPrice] = useState(0);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const cartItems = await cart.getAll(userId);
      setItems(cartItems);
      const total = await cart.getTotalPrice(userId);
      setTotalPrice(total);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  }, [cart, userId]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Reload on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadCart);
    return unsubscribe;
  }, [navigation, loadCart]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleIncrement = async (item: CartItem) => {
    await cart.incrementQuantity(item);
    loadCart();
  };

  const handleDecrement = async (item: CartItem) => {
    await cart.decrementQuantity(item);
    loadCart();
  };

  const handleRemove = (item: CartItem) => {
    Alert.alert('Remove Item', `Remove "${item.name}" from cart?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await cart.remove(item);
          loadCart();
        },
      },
    ]);
  };

  const handleEdit = (item: CartItem) => {
    navigation.navigate('EditCartItem', {itemId: item.id});
  };

  const handleClearCart = () => {
    if (items.length === 0) return;

    Alert.alert('Clear Cart', 'Remove all items from cart?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await cart.clear(userId);
          loadCart();
        },
      },
    ]);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Cart Empty', 'Add items to your cart before checkout.');
      return;
    }
    navigation.navigate('Checkout');
  };

  const handleAddManually = () => {
    navigation.navigate('AddMethod', {context: 'cart'});
  };

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
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        itemCount: {
          color: colors.textSecondary,
        },
        emptyTitle: {
          color: colors.textSecondary,
        },
        emptySubtitle: {
          color: colors.textTertiary,
          marginTop: 4,
          textAlign: 'center',
        },
        footer: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        totalPrice: {
          color: colors.success,
          fontWeight: '700',
        },
        checkoutBtn: {
          backgroundColor: colors.accent,
        },
        fab: {
          position: 'absolute',
          right: 16,
          bottom: 180,
          backgroundColor: colors.accent,
        },
      }),
    [colors],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && items.length === 0) {
    return <Loading message="Loading cart..." />;
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={dynamicStyles.container}>
      {items.length > 0 && (
        <View style={dynamicStyles.header}>
          <Text variant="bodyMedium" style={dynamicStyles.itemCount}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} in cart
          </Text>
          <Button
            mode="text"
            onPress={handleClearCart}
            textColor={colors.danger}
            compact>
            Clear All
          </Button>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <CartItemCard
            item={item}
            onIncrement={() => handleIncrement(item)}
            onDecrement={() => handleDecrement(item)}
            onRemove={() => handleRemove(item)}
            onEdit={() => handleEdit(item)}
          />
        )}
        contentContainerStyle={staticStyles.list}
        ListEmptyComponent={
          <View style={staticStyles.emptyContainer}>
            <Text style={staticStyles.emptyIcon}>🛒</Text>
            <Text variant="titleMedium" style={dynamicStyles.emptyTitle}>
              Your cart is empty
            </Text>
            <Text variant="bodyMedium" style={dynamicStyles.emptySubtitle}>
              Scan items or add them manually
            </Text>
            <Button
              mode="contained"
              onPress={handleAddManually}
              style={staticStyles.addButton}>
              Add Item Manually
            </Button>
          </View>
        }
      />

      {items.length > 0 && (
        <View style={dynamicStyles.footer}>
          <Divider />
          <View style={staticStyles.totalRow}>
            <Text variant="titleLarge">Total:</Text>
            <Text variant="headlineSmall" style={dynamicStyles.totalPrice}>
              ${totalPrice.toFixed(2)}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={handleCheckout}
            style={dynamicStyles.checkoutBtn}
            contentStyle={staticStyles.checkoutBtnContent}>
            Proceed to Checkout
          </Button>
        </View>
      )}

      <FAB
        icon="plus"
        style={dynamicStyles.fab}
        onPress={handleAddManually}
        visible={items.length > 0}
      />
    </View>
  );
}

const staticStyles = StyleSheet.create({
  list: {
    padding: 12,
    paddingBottom: 200,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  addButton: {
    marginTop: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  checkoutBtnContent: {
    paddingVertical: 8,
  },
});
