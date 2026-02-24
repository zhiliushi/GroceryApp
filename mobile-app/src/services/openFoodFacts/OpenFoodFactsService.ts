import axios from 'axios';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2';

export interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  image_front_url?: string;
  quantity?: string;
  nutriments?: Record<string, number>;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
}

/**
 * Direct client-side access to Open Food Facts.
 * Used as a fallback when the Render backend is unreachable (offline-first).
 */
class OpenFoodFactsService {
  /** Look up a product by barcode. */
  async getProduct(barcode: string): Promise<OFFProduct | null> {
    try {
      const response = await axios.get(`${OFF_BASE}/product/${barcode}`, {
        params: {fields: 'code,product_name,brands,categories,image_url,image_front_url,quantity,nutriments,nutriscore_grade,ecoscore_grade'},
        timeout: 8_000,
      });

      if (response.data?.status === 1 && response.data.product) {
        return response.data.product as OFFProduct;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Search products by name. */
  async searchByName(
    query: string,
    page = 1,
    pageSize = 10,
  ): Promise<OFFProduct[]> {
    try {
      const response = await axios.get(`${OFF_BASE}/search`, {
        params: {
          search_terms: query,
          page,
          page_size: pageSize,
          json: 1,
          fields: 'code,product_name,brands,image_front_url',
        },
        timeout: 8_000,
      });

      return (response.data?.products ?? []) as OFFProduct[];
    } catch {
      return [];
    }
  }
}

export default new OpenFoodFactsService();
