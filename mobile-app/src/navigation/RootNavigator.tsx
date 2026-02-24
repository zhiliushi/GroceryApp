import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import type {Theme as NavigationTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import MainNavigator from './MainNavigator';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
};

interface RootNavigatorProps {
  navTheme: NavigationTheme;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator({navTheme}: RootNavigatorProps): React.JSX.Element {
  const {isLoading} = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@user_name').then(name => {
      setHasOnboarded(!!name);
    });
  }, []);

  if (isLoading || hasOnboarded === null) {
    return <LoadingSpinner message="Starting up..." />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {!hasOnboarded && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}

        <Stack.Screen name="Main" component={MainNavigator} />

        <Stack.Group screenOptions={{presentation: 'modal'}}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
