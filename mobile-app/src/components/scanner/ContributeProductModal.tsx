import React, {useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  IconButton,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import {CONTRIBUTE_CATEGORIES} from '../../types/api';
import ImageUploadService, {
  CapturedImage,
} from '../../services/firebase/ImageUploadService';
import BarcodeApiService from '../../services/barcode/BarcodeApiService';
import AnalyticsService from '../../services/firebase/AnalyticsService';
import {useAuthStore} from '../../store/authStore';
import {useAppTheme} from '../../hooks/useAppTheme';
import type {ContributeRequest} from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContributeProductModalProps {
  visible: boolean;
  barcode: string;
  onDismiss: () => void;
  /** Called after successful submission so the parent can navigate to AddItem. */
  onContributed: (data: {
    barcode: string;
    productName: string;
    brand: string | undefined;
    category: string;
    imageUrl: string | undefined;
  }) => void;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type FormStep = 'form' | 'submitting' | 'success';

interface FormErrors {
  productName?: string;
  categoryId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContributeProductModal({
  visible,
  barcode,
  onDismiss,
  onContributed,
}: ContributeProductModalProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const user = useAuthStore(s => s.user);

  // Form fields
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);

  // State
  const [step, setStep] = useState<FormStep>('form');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!productName.trim()) {
      newErrors.productName = 'Product name is required';
    } else if (productName.trim().length < 2) {
      newErrors.productName = 'Product name must be at least 2 characters';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [productName, categoryId]);

  // ---------------------------------------------------------------------------
  // Photo capture
  // ---------------------------------------------------------------------------

  const handleTakePhoto = useCallback(async () => {
    const image = await ImageUploadService.capturePhoto();
    if (image) setCapturedImage(image);
  }, []);

  const handlePickPhoto = useCallback(async () => {
    const image = await ImageUploadService.pickFromGallery();
    if (image) setCapturedImage(image);
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const showPhotoOptions = useCallback(() => {
    Alert.alert('Add Product Photo', 'Choose how to add a photo', [
      {text: 'Take Photo', onPress: handleTakePhoto},
      {text: 'Choose from Gallery', onPress: handlePickPhoto},
      {text: 'Cancel', style: 'cancel'},
    ]);
  }, [handleTakePhoto, handlePickPhoto]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setStep('submitting');
    setSubmitError(null);

    try {
      // 1. Upload image if captured
      let imageUrl: string | undefined;
      if (capturedImage && user?.uid) {
        try {
          const uploadResult = await ImageUploadService.uploadProductImage(
            capturedImage,
            user.uid,
            barcode,
          );
          imageUrl = uploadResult.downloadUrl;
        } catch (uploadErr) {
          console.warn('[Contribute] Image upload failed:', uploadErr);
          // Non-blocking — continue without image
        }
      }

      // 2. Find the category label
      const selectedCategory = CONTRIBUTE_CATEGORIES.find(c => c.id === categoryId);
      const categoryLabel = selectedCategory?.label ?? 'Other';

      // 3. Submit to backend
      const request: ContributeRequest = {
        barcode,
        productName: productName.trim(),
        brands: brand.trim() || undefined,
        categories: categoryLabel,
        imageUrl,
      };

      await BarcodeApiService.contributeProduct(request);

      // 4. Log analytics
      await AnalyticsService.logEvent('barcode_contributed', {
        barcode,
        category: categoryLabel,
        has_image: imageUrl ? 1 : 0,
      });

      // 5. Show success
      setStep('success');

      // Pass data back so parent can navigate to AddItem
      onContributed({
        barcode,
        productName: productName.trim(),
        brand: brand.trim() || undefined,
        category: categoryLabel,
        imageUrl,
      });
    } catch (err: any) {
      console.error('[Contribute] Submit failed:', err);
      setSubmitError(err?.message ?? 'Failed to submit. Please try again.');
      setStep('form');
    }
  }, [validate, capturedImage, user, barcode, productName, brand, categoryId, onContributed]);

  // ---------------------------------------------------------------------------
  // Reset on close
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    setProductName('');
    setBrand('');
    setCategoryId(null);
    setCapturedImage(null);
    setStep('form');
    setErrors({});
    setSubmitError(null);
    onDismiss();
  }, [onDismiss]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.container, {backgroundColor: colors.surface}]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, {borderBottomColor: colors.border}]}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            {step === 'success' ? 'Thank You!' : 'Contribute Product'}
          </Text>
          <IconButton icon="close" onPress={handleClose} />
        </View>

        {/* Submitting */}
        {step === 'submitting' && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" />
            <Text style={[styles.submittingText, {color: colors.textSecondary}]}>
              Submitting your contribution...
            </Text>
          </View>
        )}

        {/* Success */}
        {step === 'success' && (
          <View style={styles.centerContent}>
            <IconButton icon="check-circle" size={64} iconColor={colors.success} />
            <Text variant="titleMedium" style={styles.successTitle}>
              Product Submitted
            </Text>
            <Text style={[styles.successBody, {color: colors.textSecondary}]}>
              Thanks for helping build the product database! Your contribution
              will help other users identify this product.
            </Text>
            <Button
              mode="contained"
              onPress={handleClose}
              style={styles.successBtn}>
              Done
            </Button>
          </View>
        )}

        {/* Form */}
        {step === 'form' && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {/* Barcode */}
            <View style={[styles.barcodeRow, {backgroundColor: colors.surfaceVariant}]}>
              <IconButton icon="barcode" size={20} />
              <Text style={[styles.barcodeText, {color: colors.textSecondary}]}>{barcode}</Text>
            </View>

            {/* Submit error */}
            {submitError && (
              <Text style={[styles.submitError, {color: colors.danger}]}>{submitError}</Text>
            )}

            {/* Photo */}
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Product Photo (Optional)
            </Text>
            {capturedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{uri: capturedImage.uri}}
                  style={styles.imagePreview}
                />
                <IconButton
                  icon="close-circle"
                  size={24}
                  iconColor={colors.danger}
                  onPress={handleRemovePhoto}
                  style={[styles.removeImageBtn, {backgroundColor: colors.surface}]}
                />
              </View>
            ) : (
              <Button
                mode="outlined"
                icon="camera"
                onPress={showPhotoOptions}
                style={styles.photoBtn}>
                Add Photo
              </Button>
            )}

            {/* Product name */}
            <TextInput
              label="Product Name *"
              value={productName}
              onChangeText={text => {
                setProductName(text);
                if (errors.productName) setErrors(e => ({...e, productName: undefined}));
              }}
              mode="outlined"
              style={styles.input}
              error={!!errors.productName}
              autoCapitalize="words"
            />
            {errors.productName && (
              <Text style={[styles.fieldError, {color: colors.danger}]}>{errors.productName}</Text>
            )}

            {/* Brand */}
            <TextInput
              label="Brand (Optional)"
              value={brand}
              onChangeText={setBrand}
              mode="outlined"
              style={styles.input}
              autoCapitalize="words"
            />

            {/* Category */}
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Category *
            </Text>
            {errors.categoryId && (
              <Text style={[styles.fieldError, {color: colors.danger}]}>{errors.categoryId}</Text>
            )}
            <View style={styles.categoryGrid}>
              {CONTRIBUTE_CATEGORIES.map(cat => (
                <Chip
                  key={cat.id}
                  selected={categoryId === cat.id}
                  onPress={() => {
                    setCategoryId(cat.id);
                    if (errors.categoryId) setErrors(e => ({...e, categoryId: undefined}));
                  }}
                  style={[
                    styles.categoryChip,
                    {backgroundColor: colors.surfaceVariant},
                    categoryId === cat.id && {backgroundColor: colors.accent},
                  ]}
                  textStyle={
                    categoryId === cat.id ? {color: colors.textInverse} : undefined
                  }
                  showSelectedCheck={false}>
                  {cat.label}
                </Chip>
              ))}
            </View>

            {/* Submit */}
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitBtn}>
              Submit Contribution
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {fontWeight: '600'},
  // Scroll form
  scrollView: {flex: 1},
  scrollContent: {padding: 16, paddingBottom: 40},
  // Barcode
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingRight: 12,
    marginBottom: 16,
  },
  barcodeText: {fontFamily: 'monospace', fontSize: 16},
  // Errors
  submitError: {
    marginBottom: 12,
    textAlign: 'center',
  },
  fieldError: {fontSize: 12, marginTop: -4, marginBottom: 8, marginLeft: 4},
  // Photo
  sectionLabel: {marginTop: 8, marginBottom: 8},
  photoBtn: {marginBottom: 16},
  imagePreviewContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },
  imagePreview: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  // Inputs
  input: {marginBottom: 12},
  // Category chips
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  categoryChip: {},
  // Submit
  submitBtn: {marginTop: 8},
  // Center states (submitting / success)
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  submittingText: {marginTop: 16},
  successTitle: {marginTop: 8},
  successBody: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  successBtn: {marginTop: 32, width: '100%'},
});
