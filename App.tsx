import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';

import GalleryScreen from './src/screens/GalleryScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CreativeScreen from './src/screens/CreativeScreen';
import CleanScreen from './src/screens/CleanScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: true,
            tabBarActiveTintColor: '#000',
            tabBarInactiveTintColor: '#666',
            tabBarLabelStyle: {
              fontSize: 12,
            },
          }}
        >
          <Tab.Screen 
            name="Gallery" 
            component={GalleryScreen}
            options={{ 
              title: 'Gallery',
              tabBarIcon: () => <Text>📷</Text>,
            }}
          />
          <Tab.Screen 
            name="Explore" 
            component={ExploreScreen}
            options={{ 
              title: 'Explore',
              tabBarIcon: () => <Text>🔍</Text>,
            }}
          />
          <Tab.Screen 
            name="Creative" 
            component={CreativeScreen}
            options={{ 
              title: 'Creative',
              tabBarIcon: () => <Text>✨</Text>,
            }}
          />
          <Tab.Screen 
            name="Clean" 
            component={CleanScreen}
            options={{ 
              title: 'Clean',
              tabBarIcon: () => <Text>🗑️</Text>,
            }}
          />
          <Tab.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ 
              title: 'Settings',
              tabBarIcon: () => <Text>⚙️</Text>,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

