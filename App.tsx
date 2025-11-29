import React from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import GalleryScreen from './src/screens/GalleryScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CreativeScreen from './src/screens/CreativeScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: true,
            headerTransparent: true,
            headerBackground: () => (
              <BlurView tint="light" intensity={80} style={StyleSheet.absoluteFill} />
            ),
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarStyle: {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
              height: 85,
              paddingBottom: 20,
            },
            tabBarBackground: () => (
              <BlurView tint="light" intensity={85} style={StyleSheet.absoluteFill} />
            ),
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
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}


