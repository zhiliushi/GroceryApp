import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import InventoryItemCard from '../InventoryItemCard';
import {buildInventoryItem, buildExpiredItem, buildExpiringSoonItem} from '../../../__tests__/testUtils';

// Mock react-native-paper
jest.mock('react-native-paper', () => {
  const React = require('react');
  const {View, Text, TouchableOpacity, Image} = require('react-native');
  return {
    Text: ({children, ...props}: any) => React.createElement(Text, props, children),
    Card: ({children, onPress, style}: any) =>
      React.createElement(TouchableOpacity, {onPress, style, testID: 'card'}, children),
    Badge: ({children, style}: any) =>
      React.createElement(View, {style}, React.createElement(Text, null, children)),
    Icon: ({source}: any) =>
      React.createElement(Text, {testID: `icon-${source}`}, source),
  };
});

describe('InventoryItemCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list mode (default)', () => {
    it('renders item name', () => {
      const item = buildInventoryItem({name: 'Organic Milk'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('Organic Milk')).toBeTruthy();
    });

    it('renders brand when present', () => {
      const item = buildInventoryItem({brand: 'Happy Farms'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('Happy Farms')).toBeTruthy();
    });

    it('renders quantity and unit', () => {
      const item = buildInventoryItem({quantity: 3, unitAbbreviation: 'L'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('3 L')).toBeTruthy();
    });

    it('renders category badge', () => {
      const item = buildInventoryItem({categoryName: 'Dairy'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('Dairy')).toBeTruthy();
    });

    it('calls onPress when card is tapped', () => {
      const item = buildInventoryItem();
      const {getByTestId} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      fireEvent.press(getByTestId('card'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('shows "Expired" for expired items', () => {
      const item = buildExpiredItem();
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('Expired')).toBeTruthy();
    });

    it('shows days left for expiring items', () => {
      const item = buildExpiringSoonItem({
        expiryDate: Date.now() + 1 * 24 * 60 * 60 * 1000,
      });
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('Expires tomorrow')).toBeTruthy();
    });

    it('shows location badge', () => {
      const item = buildInventoryItem({location: 'freezer'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(getByText('Freezer')).toBeTruthy();
    });
  });

  describe('compact mode (grid)', () => {
    it('renders in compact layout', () => {
      const item = buildInventoryItem({name: 'Cheese'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} compact />,
      );
      expect(getByText('Cheese')).toBeTruthy();
    });

    it('renders quantity in compact mode', () => {
      const item = buildInventoryItem({quantity: 5, unitAbbreviation: 'pcs'});
      const {getByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} compact />,
      );
      expect(getByText('5 pcs')).toBeTruthy();
    });
  });

  describe('no expiry date', () => {
    it('does not render expiry text when no date', () => {
      const item = buildInventoryItem({expiryDate: null});
      const {queryByText} = render(
        <InventoryItemCard item={item} onPress={mockOnPress} />,
      );
      expect(queryByText('Expired')).toBeNull();
      expect(queryByText(/left/)).toBeNull();
    });
  });
});
