/**
 * GroceryApp — Root component
 *
 * @format
 */

import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PaperProvider} from 'react-native-paper';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import ToastProvider from './src/components/common/ToastProvider';
import OfflineIndicator from './src/components/common/OfflineIndicator';
import RootNavigator from './src/navigation/RootNavigator';
import {useAppTheme} from './src/hooks/useAppTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

function App(): React.JSX.Element {
  const {theme, navTheme, isDark} = useAppTheme();

  return (
    <GestureHandlerRootView style={styles.container}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <StatusBar
                  barStyle={isDark ? 'light-content' : 'dark-content'}
                  backgroundColor={theme.custom.background}
                />
                <View style={styles.container}>
                  <OfflineIndicator />
                  <RootNavigator navTheme={navTheme} />
                </View>
              </ToastProvider>
            </QueryClientProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
