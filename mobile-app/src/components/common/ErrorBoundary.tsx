import React, {Component, type ErrorInfo, type ReactNode} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Text, Button, IconButton} from 'react-native-paper';
import crashlytics from '@react-native-firebase/crashlytics';
import {useAppTheme} from '../../hooks/useAppTheme';

interface Props {
  children: ReactNode;
  /** Optional fallback component. If not provided, default error screen is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React error boundary.
 *
 * Catches unhandled JavaScript errors in the component tree,
 * logs them to Firebase Crashlytics, and shows a friendly recovery screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false, error: null};

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to Firebase Crashlytics
    try {
      crashlytics().recordError(error);
      crashlytics().log(
        `ErrorBoundary caught: ${error.message}\n${info.componentStack ?? ''}`,
      );
    } catch {
      // Crashlytics may not be available in dev
    }

    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRestart = () => {
    this.setState({hasError: false, error: null});
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackScreen
          error={this.state.error}
          onRestart={this.handleRestart}
        />
      );
    }

    return this.props.children;
  }
}

/** Functional error screen so we can use the useAppTheme hook. */
function ErrorFallbackScreen({
  error,
  onRestart,
}: {
  error: Error | null;
  onRestart: () => void;
}): React.JSX.Element {
  const {colors} = useAppTheme();

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <IconButton
          icon="bug-outline"
          iconColor={colors.danger}
          size={64}
          style={styles.icon}
        />
        <Text variant="headlineSmall" style={styles.title}>
          Oops! Something went wrong
        </Text>
        <Text variant="bodyMedium" style={[styles.description, {color: colors.textSecondary}]}>
          The app ran into an unexpected error. We've logged this issue and
          will look into it.
        </Text>

        {__DEV__ && error ? (
          <View style={[styles.debugContainer, {backgroundColor: colors.dangerBg}]}>
            <Text variant="labelMedium" style={[styles.debugLabel, {color: colors.danger}]}>
              Debug Info
            </Text>
            <Text variant="bodySmall" style={[styles.debugText, {color: colors.danger}]} selectable>
              {error.message}
            </Text>
          </View>
        ) : null}

        <Button
          mode="contained"
          onPress={onRestart}
          style={styles.button}
          icon="restart">
          Restart App
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    margin: 0,
  },
  title: {
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  description: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  debugContainer: {
    marginTop: 24,
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  debugLabel: {
    fontWeight: '700',
    marginBottom: 6,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: 32,
    minWidth: 180,
  },
});
