import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CleanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clean</Text>
      <Text style={styles.subtitle}>Garbage Collection</Text>
      <Text style={styles.placeholder}>
        Swipe through photos to mark them for deletion. Learn from your preferences.
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

