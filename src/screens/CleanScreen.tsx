import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import ScreenLayout from '../components/ScreenLayout';
import photoService from '../services/photoService';
import { CleanupMode } from '../components/CleanupMode';
import { PhotoMetadata } from '../types';
import * as MediaLibrary from 'expo-media-library';

export default function CleanScreen() {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const hasPermission = await photoService.requestPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Need photo access to use cleaner');
        setLoading(false);
        return;
      }
      const fetchedPhotos = await photoService.getAllPhotos();
      setPhotos(fetchedPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleKeep = (photo: PhotoMetadata) => {
    // Remove from cleanup queue
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
  };

  const handleDelete = async (photo: PhotoMetadata) => {
    try {
      await MediaLibrary.deleteAssetsAsync([photo.id]);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (error) {
      console.error('Error deleting photo:', error);
      Alert.alert('Error', 'Failed to delete photo');
    }
  };

  const handleFinish = () => {
    Alert.alert('Cleanup Complete', 'Your gallery is looking fresher! ✨');
  };

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (photos.length === 0) {
  return (
    <ScreenLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Smart Cleaner</Text>
            <Text style={styles.subtitle}>All clean!</Text>
        </View>
        <BlurView intensity={20} style={styles.card}>
            <Text style={styles.emptyText}>
              No photos to clean 🎉
          </Text>
        </BlurView>
      </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <CleanupMode
        photos={photos}
        onKeep={handleKeep}
        onDelete={handleDelete}
        onFinish={handleFinish}
      />
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
    padding: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#fff',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
