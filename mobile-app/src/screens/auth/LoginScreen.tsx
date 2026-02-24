import React, {useState} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text, TextInput, Button, IconButton} from 'react-native-paper';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {SafeAreaView} from 'react-native-safe-area-context';
import AuthService from '../../services/firebase/AuthService';
import {useAppTheme} from '../../hooks/useAppTheme';
import {loginSchema, LoginFormData} from '../../utils/validators';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const [loading, setLoading] = useState(false);
  const {control, handleSubmit, formState: {errors}} = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      await AuthService.signIn(data.email, data.password);
      // Close the modal after successful login
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Login Failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
        <IconButton icon="close" size={24} onPress={handleClose} />
        <Text variant="titleMedium">Sign In</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.container}>
        <Text variant="headlineLarge" style={styles.title}>
          GroceryApp
        </Text>
      <Text variant="bodyLarge" style={[styles.subtitle, {color: colors.textSecondary}]}>
        Sign in to your account
      </Text>

      <Controller
        control={control}
        name="email"
        render={({field: {onChange, onBlur, value}}) => (
          <TextInput
            label="Email"
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.email}
            style={styles.input}
          />
        )}
      />
      {errors.email && (
        <Text style={[styles.error, {color: colors.danger}]}>{errors.email.message}</Text>
      )}

      <Controller
        control={control}
        name="password"
        render={({field: {onChange, onBlur, value}}) => (
          <TextInput
            label="Password"
            mode="outlined"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={!!errors.password}
            style={styles.input}
          />
        )}
      />
      {errors.password && (
        <Text style={[styles.error, {color: colors.danger}]}>{errors.password.message}</Text>
      )}

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        disabled={loading}
        style={styles.button}>
        Sign In
      </Button>

      <Button
        mode="text"
        onPress={() => navigation.navigate('Register')}
        style={styles.link}>
        Don't have an account? Sign Up
      </Button>

      <Button
        mode="text"
        onPress={() => {
          // TODO: Forgot password flow
        }}>
        Forgot Password?
      </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  placeholder: {width: 48},
  container: {flex: 1, padding: 24, justifyContent: 'center'},
  title: {textAlign: 'center', marginBottom: 8},
  subtitle: {textAlign: 'center', marginBottom: 32},
  input: {marginBottom: 4},
  error: {fontSize: 12, marginBottom: 8, marginLeft: 4},
  button: {marginTop: 16},
  link: {marginTop: 8},
});
