import React, {useState} from 'react';
import {View, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {Text, TextInput, Button, Surface} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAppTheme} from '../../hooks/useAppTheme';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetStarted = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      await AsyncStorage.setItem('@user_name', name.trim());
      if (location.trim()) {
        await AsyncStorage.setItem('@user_location', location.trim());
      }
      navigation.reset({index: 0, routes: [{name: 'Main'}]});
    } catch (err) {
      console.error('[Onboarding] save error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.headerSection}>
            <Surface style={[styles.iconCircle, {backgroundColor: colors.accentContainer}]} elevation={2}>
              <Text style={styles.iconEmoji}>🛒</Text>
            </Surface>
            <Text variant="headlineLarge" style={styles.title}>
              Welcome to GroceryApp
            </Text>
            <Text variant="bodyLarge" style={[styles.subtitle, {color: colors.textSecondary}]}>
              Track your groceries, reduce waste, save money.
            </Text>
          </View>

          <View style={styles.formSection}>
            <TextInput
              label="Your Name"
              mode="outlined"
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoFocus
            />

            <TextInput
              label="Location (city or area)"
              mode="outlined"
              value={location}
              onChangeText={setLocation}
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handleGetStarted}
              loading={loading}
              disabled={loading || !name.trim()}
              style={styles.button}
              contentStyle={styles.buttonContent}
              buttonColor={colors.accent}>
              Get Started
            </Button>
          </View>

          <Text variant="bodySmall" style={[styles.footer, {color: colors.textTertiary}]}>
            Your data is stored locally on your device.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  flex: {flex: 1},
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {fontSize: 36},
  title: {fontWeight: '700', textAlign: 'center'},
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
  },
  formSection: {
    marginBottom: 24,
  },
  input: {marginBottom: 12},
  button: {marginTop: 8, borderRadius: 24},
  buttonContent: {paddingVertical: 6},
  footer: {
    textAlign: 'center',
  },
});
