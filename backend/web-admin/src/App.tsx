import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';
import { queryClient } from '@/api/queryClient';
import { registerShoppingListIntegrationListener } from '@/api/integrations/addToShoppingList';

// Cross-page integration: any page can dispatch
// `new CustomEvent('grocery:add-to-shopping-list', { detail: {...} })`
// to add an entry to the user's active shopping list. Registered once
// at app load. See docs/pages/shopping-lists.md "Cross-page hook".
registerShoppingListIntegrationListener();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e1e1e',
            color: '#e0e0e0',
            border: '1px solid #333',
          },
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
