import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import ScreenLayout from '../components/ScreenLayout';

export default function CreativeScreen() {
  return (
    <ScreenLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Creative Suite</Text>
          <Text style={styles.subtitle}>Powered by NanoBanana Engine</Text>
        </View>

        <BlurView intensity={20} style={styles.glassCard}>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>✨</Text>
          </View>
          <Text style={styles.cardTitle}>AI Enhancements</Text>
          <Text style={styles.cardDescription}>
            Apply advanced AI filters and corrections to your photos instantly.
          </Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Start Creating</Text>
          </TouchableOpacity>
        </BlurView>

        <View style={styles.toolsContainer}>
          <BlurView intensity={20} style={styles.toolCard}>
            <Text style={styles.toolIcon}>🎨</Text>
            <Text style={styles.toolName}>Edit</Text>
          </BlurView>
          <BlurView intensity={20} style={styles.toolCard}>
            <Text style={styles.toolIcon}>🪄</Text>
            <Text style={styles.toolName}>Magic</Text>
          </BlurView>
          <BlurView intensity={20} style={styles.toolCard}>
            <Text style={styles.toolIcon}>✂️</Text>
            <Text style={styles.toolName}>Crop</Text>
          </BlurView>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
    textAlign: 'center',
  },
  glassCard: {
    padding: 30,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconText: {
    fontSize: 30,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  buttonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  toolCard: {
    width: 90,
    height: 90,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  toolIcon: {
    fontSize: 30,
    marginBottom: 5,
  },
  toolName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
