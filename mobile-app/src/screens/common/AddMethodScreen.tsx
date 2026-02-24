import React from 'react';
import {View, StyleSheet, Pressable} from 'react-native';
import {Text, Icon, Surface} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../../hooks/useAppTheme';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type AddMethodContext = 'inventory' | 'shopping_list';

type Props = NativeStackScreenProps<any, 'AddMethod'>;

export default function AddMethodScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const params = route.params as {
    context: AddMethodContext;
    listId?: string;
  };
  const {context, listId} = params;

  const handleScan = () => {
    navigation.navigate('ContextScanner', {context, listId});
  };

  const handleManual = () => {
    switch (context) {
      case 'inventory':
        navigation.navigate('AddItem');
        break;
      case 'shopping_list':
        navigation.navigate('AddListItem', {listId});
        break;
    }
  };

  const contextLabel =
    context === 'inventory'
      ? 'Inventory'
      : 'Shopping List';

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]} edges={['bottom']}>
      <View style={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          Add to {contextLabel}
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, {color: colors.textSecondary}]}>
          How would you like to add items?
        </Text>

        <View style={styles.cards}>
          <Pressable onPress={handleScan} style={styles.cardWrapper}>
            <Surface style={[styles.card, {backgroundColor: colors.surface}]} elevation={2}>
              <View style={[styles.iconBg, {backgroundColor: colors.accentContainer}]}>
                <Icon source="barcode-scan" size={48} color={colors.accent} />
              </View>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Scan Barcode
              </Text>
              <Text variant="bodySmall" style={[styles.cardDesc, {color: colors.textTertiary}]}>
                Use your camera to scan a product barcode
              </Text>
            </Surface>
          </Pressable>

          <Pressable onPress={handleManual} style={styles.cardWrapper}>
            <Surface style={[styles.card, {backgroundColor: colors.surface}]} elevation={2}>
              <View style={[styles.iconBg, {backgroundColor: colors.accentContainer}]}>
                <Icon source="pencil" size={48} color={colors.accent} />
              </View>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Manual Entry
              </Text>
              <Text variant="bodySmall" style={[styles.cardDesc, {color: colors.textTertiary}]}>
                Type in the product details yourself
              </Text>
            </Surface>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  cards: {
    gap: 16,
  },
  cardWrapper: {
    borderRadius: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDesc: {
    textAlign: 'center',
  },
});
