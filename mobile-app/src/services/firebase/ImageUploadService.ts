import storage from '@react-native-firebase/storage';
import {launchCamera, launchImageLibrary, Asset} from 'react-native-image-picker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IMAGE_WIDTH = 800;
const MAX_IMAGE_HEIGHT = 800;
const IMAGE_QUALITY = 0.7;
const UPLOAD_PATH_PREFIX = 'barcode_contributions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapturedImage {
  uri: string;
  fileName: string;
  width: number;
  height: number;
  fileSize: number;
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ImageUploadService {
  // -------------------------------------------------------------------------
  // Image capture
  // -------------------------------------------------------------------------

  /**
   * Launch the device camera to capture a product photo.
   * Returns null if the user cancels.
   */
  async capturePhoto(): Promise<CapturedImage | null> {
    const result = await launchCamera({
      mediaType: 'photo',
      maxWidth: MAX_IMAGE_WIDTH,
      maxHeight: MAX_IMAGE_HEIGHT,
      quality: IMAGE_QUALITY,
      saveToPhotos: false,
    });

    if (result.didCancel || result.errorCode || !result.assets?.length) {
      return null;
    }

    return this.assetToCapturedImage(result.assets[0]);
  }

  /**
   * Let the user pick a photo from their gallery.
   * Returns null if the user cancels.
   */
  async pickFromGallery(): Promise<CapturedImage | null> {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: MAX_IMAGE_WIDTH,
      maxHeight: MAX_IMAGE_HEIGHT,
      quality: IMAGE_QUALITY,
      selectionLimit: 1,
    });

    if (result.didCancel || result.errorCode || !result.assets?.length) {
      return null;
    }

    return this.assetToCapturedImage(result.assets[0]);
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  /**
   * Upload a captured image to Firebase Storage.
   * Path: barcode_contributions/{userId}/{barcode}_{timestamp}.jpg
   *
   * Returns the public download URL.
   */
  async uploadProductImage(
    image: CapturedImage,
    userId: string,
    barcode: string,
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const storagePath = `${UPLOAD_PATH_PREFIX}/${userId}/${barcode}_${timestamp}.jpg`;
    const ref = storage().ref(storagePath);

    await ref.putFile(image.uri, {
      contentType: 'image/jpeg',
      customMetadata: {
        barcode,
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadUrl = await ref.getDownloadURL();

    return {downloadUrl, storagePath};
  }

  /**
   * Delete an uploaded image from Firebase Storage.
   * Safe to call if the path doesn't exist (no-ops).
   */
  async deleteImage(storagePath: string): Promise<void> {
    try {
      await storage().ref(storagePath).delete();
    } catch {
      // Ignore — file may not exist
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private assetToCapturedImage(asset: Asset): CapturedImage | null {
    if (!asset.uri) return null;

    return {
      uri: asset.uri,
      fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      fileSize: asset.fileSize ?? 0,
    };
  }
}

export default new ImageUploadService();
