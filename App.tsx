import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import GalleryScreen from './src/screens/GalleryScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CreativeScreen from './src/screens/CreativeScreen';
import NeuralOnboarding from './src/screens/NeuralOnboarding';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import { colors, radius, spacing } from './src/theme';
import indexingService from './src/services/indexingService';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AutoIndexOnLaunch() {
  useEffect(() => {
    indexingService.ensureUpToDate();
  }, []);
  return null;
}

function TabNavigator() {
  return (
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: false,
        tabBarActiveTintColor: colors.warm.accent,
        tabBarInactiveTintColor: colors.text.tertiary,
                tabBarStyle: {
                  position: 'absolute',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
                  borderTopWidth: 0,
                  elevation: 0,
          height: spacing.bottomTab,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          borderTopLeftRadius: radius.l,
          borderTopRightRadius: radius.l,
          overflow: 'hidden',
          shadowColor: colors.warm.primary,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView 
              intensity={80} 
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : null
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
                },
                tabBarIcon: ({ focused, color, size }) => {
                  let iconName: keyof typeof Ionicons.glyphMap;

                  if (route.name === 'Gallery') {
                    iconName = focused ? 'images' : 'images-outline';
                  } else if (route.name === 'Explore') {
                    iconName = focused ? 'compass' : 'compass-outline';
                  } else if (route.name === 'Creative') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
                  } else {
                    iconName = 'help';
                  }

          return (
            <Ionicons 
              name={iconName} 
              size={focused ? 26 : 24} 
              color={color}
              style={{
                marginTop: 4,
                opacity: focused ? 1 : 0.7,
              }}
            />
          );
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
        options={{ title: 'Create' }}
              />
          </Tab.Navigator>
  );
}

export default function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  if (!hasCompletedOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NeuralOnboarding onComplete={() => setHasCompletedOnboarding(true)} />
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AutoIndexOnLaunch />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen 
              name="PhotoDetail" 
              component={PhotoDetailScreen} 
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
