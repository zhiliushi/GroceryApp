import {
  isValidBarcode,
  isValidLocation,
  isValidConsumeReason,
  isValidExpiryDate,
  isValidQuantity,
  validateWithSchema,
  inventoryItemSchema,
  loginSchema,
  registerSchema,
  shoppingListSchema,
} from '../validators';

describe('validators', () => {
  // -----------------------------------------------------------------------
  // Simple validators
  // -----------------------------------------------------------------------

  describe('isValidBarcode', () => {
    it('accepts 8-digit barcodes (EAN-8)', () => {
      expect(isValidBarcode('12345678')).toBe(true);
    });

    it('accepts 13-digit barcodes (EAN-13)', () => {
      expect(isValidBarcode('1234567890123')).toBe(true);
    });

    it('accepts 14-digit barcodes', () => {
      expect(isValidBarcode('12345678901234')).toBe(true);
    });

    it('rejects barcodes shorter than 8 digits', () => {
      expect(isValidBarcode('1234567')).toBe(false);
    });

    it('rejects barcodes longer than 14 digits', () => {
      expect(isValidBarcode('123456789012345')).toBe(false);
    });

    it('rejects barcodes with letters', () => {
      expect(isValidBarcode('12345678abc')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidBarcode('')).toBe(false);
    });
  });

  describe('isValidLocation', () => {
    it('accepts "fridge"', () => {
      expect(isValidLocation('fridge')).toBe(true);
    });

    it('accepts "pantry"', () => {
      expect(isValidLocation('pantry')).toBe(true);
    });

    it('accepts "freezer"', () => {
      expect(isValidLocation('freezer')).toBe(true);
    });

    it('rejects unknown locations', () => {
      expect(isValidLocation('garage')).toBe(false);
    });
  });

  describe('isValidConsumeReason', () => {
    it('accepts valid reasons', () => {
      expect(isValidConsumeReason('used_up')).toBe(true);
      expect(isValidConsumeReason('expired')).toBe(true);
      expect(isValidConsumeReason('discarded')).toBe(true);
    });

    it('rejects invalid reasons', () => {
      expect(isValidConsumeReason('donated')).toBe(false);
    });
  });

  describe('isValidExpiryDate', () => {
    it('returns true for future dates', () => {
      const future = new Date(Date.now() + 86400000);
      expect(isValidExpiryDate(future)).toBe(true);
    });

    it('returns false for past dates', () => {
      const past = new Date(Date.now() - 86400000);
      expect(isValidExpiryDate(past)).toBe(false);
    });
  });

  describe('isValidQuantity', () => {
    it('accepts zero', () => {
      expect(isValidQuantity(0)).toBe(true);
    });

    it('accepts positive numbers', () => {
      expect(isValidQuantity(5)).toBe(true);
      expect(isValidQuantity(0.5)).toBe(true);
    });

    it('rejects negative numbers', () => {
      expect(isValidQuantity(-1)).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(isValidQuantity(Infinity)).toBe(false);
    });

    it('rejects NaN', () => {
      expect(isValidQuantity(NaN)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Schema validation with validateWithSchema
  // -----------------------------------------------------------------------

  describe('validateWithSchema', () => {
    describe('loginSchema', () => {
      it('validates correct login data', () => {
        const result = validateWithSchema(loginSchema, {
          email: 'user@example.com',
          password: 'secret123',
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid email', () => {
        const result = validateWithSchema(loginSchema, {
          email: 'not-an-email',
          password: 'secret123',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors).toContain('Invalid email address');
        }
      });

      it('rejects short password', () => {
        const result = validateWithSchema(loginSchema, {
          email: 'user@example.com',
          password: '12345',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0]).toContain('at least 6 characters');
        }
      });
    });

    describe('registerSchema', () => {
      it('validates correct registration data', () => {
        const result = validateWithSchema(registerSchema, {
          email: 'user@example.com',
          displayName: 'John Doe',
          password: 'secret123',
          confirmPassword: 'secret123',
        });
        expect(result.success).toBe(true);
      });

      it('rejects mismatched passwords', () => {
        const result = validateWithSchema(registerSchema, {
          email: 'user@example.com',
          displayName: 'John',
          password: 'secret123',
          confirmPassword: 'different',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors).toContain('Passwords do not match');
        }
      });
    });

    describe('shoppingListSchema', () => {
      it('validates correct list data', () => {
        const result = validateWithSchema(shoppingListSchema, {
          name: 'Weekly Groceries',
          userId: 'user-123',
        });
        expect(result.success).toBe(true);
      });

      it('rejects empty name', () => {
        const result = validateWithSchema(shoppingListSchema, {
          name: '',
          userId: 'user-123',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('inventoryItemSchema', () => {
      const validItem = {
        name: 'Milk',
        categoryId: 'cat-dairy',
        quantity: 2,
        unitId: 'unit-l',
        location: 'fridge' as const,
        userId: 'user-123',
      };

      it('validates a minimal valid item', () => {
        const result = validateWithSchema(inventoryItemSchema, validItem);
        expect(result.success).toBe(true);
      });

      it('rejects empty name', () => {
        const result = validateWithSchema(inventoryItemSchema, {
          ...validItem,
          name: '',
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative quantity', () => {
        const result = validateWithSchema(inventoryItemSchema, {
          ...validItem,
          quantity: -1,
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid location', () => {
        const result = validateWithSchema(inventoryItemSchema, {
          ...validItem,
          location: 'garage',
        });
        expect(result.success).toBe(false);
      });

      it('accepts optional fields', () => {
        const result = validateWithSchema(inventoryItemSchema, {
          ...validItem,
          barcode: '1234567890123',
          brand: 'Test Brand',
          price: 4.99,
          notes: 'Organic',
        });
        expect(result.success).toBe(true);
      });
    });
  });
});
