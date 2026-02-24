/**
 * Test utilities — render helpers, mock factories, and test data builders.
 */

import React, {type ReactElement} from 'react';
import {render, type RenderOptions} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {InventoryItemView} from '../store/inventoryStore';

// ---------------------------------------------------------------------------
// Custom render with providers
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
});

function AllProviders({children}: {children: React.ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider>{children}</PaperProvider>
    </QueryClientProvider>
  );
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {wrapper: AllProviders, ...options});
}

// Re-export everything from testing-library
export * from '@testing-library/react-native';
export {customRender as render};

// ---------------------------------------------------------------------------
// Mock data builders
// ---------------------------------------------------------------------------

let idCounter = 0;

export function buildInventoryItem(
  overrides: Partial<InventoryItemView> = {},
): InventoryItemView {
  idCounter += 1;
  return {
    id: `item-${idCounter}`,
    name: `Test Item ${idCounter}`,
    barcode: '1234567890123',
    brand: 'Test Brand',
    categoryId: 'cat-produce',
    categoryName: 'Produce',
    categoryColor: '#5A9E5E',
    quantity: 2,
    unitId: 'unit-pcs',
    unitAbbreviation: 'pcs',
    expiryDate: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days from now
    location: 'fridge',
    imageUrl: null,
    addedDate: Date.now() - 2 * 24 * 60 * 60 * 1000,
    price: 3.99,
    purchaseDate: Date.now() - 2 * 24 * 60 * 60 * 1000,
    notes: null,
    status: 'active',
    userId: 'test-user-id',
    syncedToCloud: false,
    ...overrides,
  };
}

export function buildExpiringSoonItem(
  overrides: Partial<InventoryItemView> = {},
): InventoryItemView {
  return buildInventoryItem({
    name: 'Expiring Yogurt',
    expiryDate: Date.now() + 1 * 24 * 60 * 60 * 1000, // 1 day
    categoryName: 'Dairy',
    categoryColor: '#D4A843',
    ...overrides,
  });
}

export function buildExpiredItem(
  overrides: Partial<InventoryItemView> = {},
): InventoryItemView {
  return buildInventoryItem({
    name: 'Expired Milk',
    expiryDate: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    categoryName: 'Dairy',
    categoryColor: '#D4A843',
    ...overrides,
  });
}

export function buildBarcodeProduct(overrides = {}) {
  return {
    barcode: '1234567890123',
    productName: 'Test Product',
    brands: 'Test Brand',
    categories: 'Produce',
    imageUrl: 'https://example.com/image.jpg',
    nutritionData: {energy_100g: 250},
    found: true,
    ...overrides,
  };
}

export function buildAnalyticsEvent(overrides = {}) {
  return {
    id: `evt-${++idCounter}`,
    eventType: 'item_added' as const,
    eventData: {name: 'Milk', price: 3.99},
    timestamp: new Date(),
    synced: false,
    userId: 'test-user-id',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

export function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export function waitForMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
