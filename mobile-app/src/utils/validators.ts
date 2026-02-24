import {z} from 'zod';
import {STORAGE_LOCATIONS} from '../database/models/InventoryItem';
import {CONSUME_REASONS} from '../database/models/InventoryItem';
import {ANALYTICS_EVENT_TYPES} from '../database/models/AnalyticsEvent';

// ---------------------------------------------------------------------------
// Inventory Item schemas
// ---------------------------------------------------------------------------

export const inventoryItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  barcode: z.string().regex(/^\d{8,14}$/, 'Invalid barcode format').optional(),
  brand: z.string().max(200, 'Brand must be 200 characters or less').optional(),
  categoryId: z.string().min(1, 'Category is required'),
  quantity: z
    .number()
    .nonnegative('Quantity must be 0 or greater')
    .finite('Quantity must be a finite number'),
  unitId: z.string().min(1, 'Unit is required'),
  expiryDate: z.date().optional(),
  location: z.enum(['fridge', 'pantry', 'freezer'], {
    errorMap: () => ({message: 'Location must be one of: fridge, pantry, freezer'}),
  }),
  imageUrl: z.string().url('Image URL must be a valid URL').optional(),
  userId: z.string().min(1, 'User ID is required'),
  price: z.number().nonnegative('Price must be 0 or greater').optional(),
  purchaseDate: z.date().optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
  status: z.enum(['active', 'consumed', 'expired', 'discarded']).optional(),
  reason: z.enum(['used_up', 'expired', 'discarded']).optional(),
  quantityRemaining: z.number().nonnegative().optional(),
});

export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

// ---------------------------------------------------------------------------
// Scanned Item schemas
// ---------------------------------------------------------------------------

export const scannedItemSchema = z.object({
  barcode: z
    .string()
    .min(1, 'Barcode is required')
    .regex(/^\d{8,14}$/, 'Invalid barcode format'),
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().optional(),
  brand: z.string().optional(),
  imageUrl: z.string().url('Image URL must be a valid URL').optional(),
});

export type ScannedItemFormData = z.infer<typeof scannedItemSchema>;

// ---------------------------------------------------------------------------
// Consume Item schemas (Stage 2 → 3 transition)
// ---------------------------------------------------------------------------

export const consumeItemSchema = z.object({
  reason: z.enum(['used_up', 'expired', 'discarded'], {
    errorMap: () => ({message: 'Reason must be one of: used_up, expired, discarded'}),
  }),
  quantityRemaining: z.number().nonnegative('Quantity remaining must be 0 or greater').optional(),
});

export type ConsumeItemFormData = z.infer<typeof consumeItemSchema>;

// ---------------------------------------------------------------------------
// Shopping List schemas
// ---------------------------------------------------------------------------

export const shoppingListSchema = z.object({
  name: z
    .string()
    .min(1, 'List name is required')
    .max(100, 'List name must be 100 characters or less'),
  userId: z.string().min(1, 'User ID is required'),
});

export type ShoppingListFormData = z.infer<typeof shoppingListSchema>;

// ---------------------------------------------------------------------------
// List Item schemas
// ---------------------------------------------------------------------------

export const listItemSchema = z.object({
  listId: z.string().min(1, 'List ID is required'),
  itemName: z
    .string()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be 200 characters or less'),
  quantity: z
    .number()
    .positive('Quantity must be greater than 0')
    .finite('Quantity must be a finite number'),
  unitId: z.string().min(1, 'Unit is required'),
  categoryId: z.string().min(1, 'Category is required'),
});

export type ListItemFormData = z.infer<typeof listItemSchema>;

// ---------------------------------------------------------------------------
// Analytics Event schemas
// ---------------------------------------------------------------------------

export const analyticsEventSchema = z.object({
  eventType: z.enum(ANALYTICS_EVENT_TYPES as unknown as [string, ...string[]], {
    errorMap: () => ({message: 'Invalid event type'}),
  }),
  eventData: z.record(z.unknown()),
  userId: z.string().min(1, 'User ID is required'),
});

export type AnalyticsEventFormData = z.infer<typeof analyticsEventSchema>;

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    displayName: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Validation utility functions
// ---------------------------------------------------------------------------

/** Validate a barcode string (8-14 digits). */
export function isValidBarcode(barcode: string): boolean {
  return /^\d{8,14}$/.test(barcode);
}

/** Validate a storage location value (any non-empty string). */
export function isValidLocation(location: string): boolean {
  return typeof location === 'string' && location.trim().length > 0;
}

/** Validate an analytics event type value. */
export function isValidEventType(eventType: string): boolean {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(eventType);
}

/** Validate a consume reason value. */
export function isValidConsumeReason(reason: string): boolean {
  return (CONSUME_REASONS as readonly string[]).includes(reason);
}

/** Validate an expiry date (must be in the future). */
export function isValidExpiryDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

/** Validate a quantity value. */
export function isValidQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity >= 0;
}

/**
 * Run a Zod schema and return either the parsed data or an array of error
 * messages. Useful for imperative validation outside react-hook-form.
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): {success: true; data: T} | {success: false; errors: string[]} {
  const result = schema.safeParse(data);
  if (result.success) {
    return {success: true, data: result.data};
  }
  return {
    success: false,
    errors: result.error.issues.map(issue => issue.message),
  };
}
