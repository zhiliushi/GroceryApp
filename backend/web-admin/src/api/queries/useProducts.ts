import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { ProductsResponse, Product } from '@/types/api';

export function useProducts(search?: string) {
  return useQuery({
    queryKey: qk.products.all(search),
    queryFn: () =>
      apiClient
        .get<ProductsResponse>(API.PRODUCTS, { params: { limit: 200, search: search || undefined } })
        .then((r) => r.data),
  });
}

export function useProduct(barcode: string | undefined) {
  return useQuery({
    queryKey: qk.products.detail(barcode!),
    queryFn: () => apiClient.get<Product>(API.PRODUCT(barcode!)).then((r) => r.data),
    enabled: !!barcode,
  });
}
