import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CreativeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Creative</Text>
      <Text style={styles.subtitle}>AI Photo Editing</Text>
      <Text style={styles.placeholder}>
        This feature will be implemented for AI-powered photo editing and creative tools.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

