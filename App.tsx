import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import GalleryScreen from './src/screens/GalleryScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CreativeScreen from './src/screens/CreativeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NeuralOnboarding from './src/screens/NeuralOnboarding';
import { colors } from './src/theme';
import indexingService from './src/services/indexingService';

const Tab = createBottomTabNavigator();

function AutoIndexOnLaunch() {
  useEffect(() => {
    indexingService.ensureUpToDate();
  }, []);
  return null;
}

export default function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  if (!hasCompletedOnboarding) {
    return (
      <SafeAreaProvider>
        <NeuralOnboarding onComplete={() => setHasCompletedOnboarding(true)} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AutoIndexOnLaunch />
      <NavigationContainer>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: colors.neutral.white,
                tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
                tabBarStyle: {
                  position: 'absolute',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderTopWidth: 0,
                  elevation: 0,
                  height: 85,
                  paddingBottom: 20,
                },
                tabBarIcon: ({ focused, color, size }) => {
                  let iconName: keyof typeof Ionicons.glyphMap;

                  if (route.name === 'Gallery') {
                    iconName = focused ? 'images' : 'images-outline';
                  } else if (route.name === 'Explore') {
                    iconName = focused ? 'compass' : 'compass-outline';
                  } else if (route.name === 'Creative') {
                    iconName = focused ? 'create' : 'create-outline';
                  } else if (route.name === 'Settings') {
                    iconName = focused ? 'settings' : 'settings-outline';
                  } else {
                    iconName = 'help';
                  }

                  return <Ionicons name={iconName} size={size} color={color} />;
                },
              })}
            >
              <Tab.Screen 
                name="Gallery" 
                component={GalleryScreen}
                options={{ title: 'Gallery' }}
              />
              <Tab.Screen 
                name="Explore" 
                component={ExploreScreen}
                options={{ title: 'Explore' }}
              />
              <Tab.Screen 
                name="Creative" 
                component={CreativeScreen}
                options={{ title: 'Creative' }}
              />
              <Tab.Screen 
                name="Settings" 
                component={SettingsScreen}
                options={{ title: 'Settings' }}
              />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
  );
}
