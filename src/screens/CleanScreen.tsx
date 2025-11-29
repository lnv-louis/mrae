import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import ScreenLayout from '../components/ScreenLayout';

export default function CleanScreen() {
  return (
    <ScreenLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Smart Cleaner</Text>
          <Text style={styles.subtitle}>Swipe to clean</Text>
        </View>

        <BlurView intensity={20} style={styles.card}>
          <View style={styles.placeholderImage} />
          <Text style={styles.instruction}>
            Swipe Left to Delete, Right to Keep
          </Text>
        </BlurView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  card: {
    width: '100%',
    aspectRatio: 3/4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  placeholderImage: {
    width: '100%',
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 15,
    marginBottom: 20,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
