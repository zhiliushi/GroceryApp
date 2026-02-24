import React, {useState} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text, TextInput, Button, IconButton} from 'react-native-paper';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {SafeAreaView} from 'react-native-safe-area-context';
import AuthService from '../../services/firebase/AuthService';
import FirestoreService from '../../services/firebase/FirestoreService';
import {useAppTheme} from '../../hooks/useAppTheme';
import {registerSchema, RegisterFormData} from '../../utils/validators';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const [loading, setLoading] = useState(false);
  const {control, handleSubmit, formState: {errors}} = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      const credential = await AuthService.signUp(data.email, data.password);
      await AuthService.updateDisplayName(data.displayName);

      // Create initial Firestore profile
      await FirestoreService.saveUserProfile(credential.user.uid, {
        email: data.email,
        displayName: data.displayName,
        tier: 'free',
      });

      // Close the modal after successful registration
      navigation.navigate('Main');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigation.navigate('Main');
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
        <IconButton icon="close" size={24} onPress={handleClose} />
        <Text variant="titleMedium">Create Account</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.container}>
        <Text variant="headlineLarge" style={styles.title}>
          Create Account
        </Text>

        <Controller
          control={control}
          name="displayName"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Full Name"
              mode="outlined"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.displayName}
              style={styles.input}
            />
          )}
        />
        {errors.displayName && (
          <Text style={[styles.error, {color: colors.danger}]}>{errors.displayName.message}</Text>
        )}

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

        <Controller
          control={control}
          name="confirmPassword"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Confirm Password"
              mode="outlined"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.confirmPassword}
              style={styles.input}
            />
          )}
        />
        {errors.confirmPassword && (
          <Text style={[styles.error, {color: colors.danger}]}>{errors.confirmPassword.message}</Text>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          disabled={loading}
          style={styles.button}>
          Create Account
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.navigate('Login')}
          style={styles.link}>
          Already have an account? Sign In
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
  title: {textAlign: 'center', marginBottom: 32},
  input: {marginBottom: 4},
  error: {fontSize: 12, marginBottom: 8, marginLeft: 4},
  button: {marginTop: 16},
  link: {marginTop: 8},
});
