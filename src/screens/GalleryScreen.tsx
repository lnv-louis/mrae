import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PhotoGrid from '../components/PhotoGrid';
import { CleanupMode } from '../components/CleanupMode';
import photoService from '../services/photoService';
import { PhotoMetadata } from '../types';
import ScreenLayout from '../components/ScreenLayout';
import { StatBlock } from '../components/StatBlock';
import { GallerySheet } from '../components/GallerySheet';
import { colors, typography, spacing, radius, haptics } from '../theme';

export default function GalleryScreen() {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCleanupMode, setIsCleanupMode] = useState(false);

  useEffect(() => {
    checkPermissionsAndLoad();
  }, []);

  const checkPermissionsAndLoad = async () => {
    try {
      const hasPermission = await photoService.requestPermissions();
      
      if (!hasPermission) {
        setLoading(false);
        Alert.alert(
          'Permission Required',
          'MRAE needs access to your gallery to help you clean and organize it.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      await loadPhotos();
    } catch (error) {
      console.error('Error in permissions check:', error);
      setLoading(false);
    }
  };

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const fetchedPhotos = await photoService.getAllPhotos();
      setPhotos(fetchedPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Error', 'Failed to load photos.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  const handlePhotoPress = (photo: PhotoMetadata) => {
    console.log('Photo pressed:', photo.id);
  };

  const handleKeepPhoto = (photo: PhotoMetadata) => {
    console.log('Keep:', photo.id);
  };

  const handleDeletePhoto = (photo: PhotoMetadata) => {
    console.log('Delete request:', photo.id);
  };

  const handleCleanupFinish = () => {
    setIsCleanupMode(false);
    Alert.alert('Cleanup Complete', 'Your gallery is looking fresher! ✨');
  };

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.neutral.white} />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (isCleanupMode && photos.length > 0) {
    return (
      <ScreenLayout>
        <CleanupMode
          photos={photos}
          onKeep={handleKeepPhoto}
          onDelete={handleDeletePhoto}
          onFinish={handleCleanupFinish}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neutral.white} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.greeting}>HELLO, ALEX!</Text>
          <Text style={styles.subtitle}>HOW ARE YOU{'\n'}FEELING TODAY?</Text>
        </View>

        <View style={styles.statsContainer}>
          <StatBlock 
            label="Photos"
            value={photos.length.toString()}
            subtext="Total Memories"
            style={styles.statCardLarge}
            gradient
            icon={
              <View style={styles.audioWaveContainer}>
                 <View style={[styles.bar, { height: 20 }]} />
                 <View style={[styles.bar, { height: 35 }]} />
                 <View style={[styles.bar, { height: 25 }]} />
                 <View style={[styles.bar, { height: 40 }]} />
                 <View style={[styles.bar, { height: 30 }]} />
                 <View style={[styles.bar, { height: 45 }]} />
                 <View style={[styles.bar, { height: 25 }]} />
              </View>
            }
          />

          <View style={styles.rightColumn}>
            <StatBlock 
              label="Videos"
              value="--"
              style={styles.statCardSmall}
            />
            <StatBlock 
              label="Albums"
              value="--"
              style={styles.statCardSmall}
            />
          </View>
        </View>

        <GallerySheet
          title="Your Gallery"
          action={
            <TouchableOpacity onPress={() => setIsCleanupMode(true)}>
              <Text style={styles.actionText}>Clean Up</Text>
            </TouchableOpacity>
          }
        >
          {photos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No photos found</Text>
              <TouchableOpacity onPress={checkPermissionsAndLoad}>
                  <Text style={styles.emptyAction}>Grant Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <PhotoGrid photos={photos} onPhotoPress={handlePhotoPress} />
          )}
        </GallerySheet>

      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.header,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.s,
    color: colors.neutral.white,
    ...typography.body.m,
  },
  headerContainer: {
    paddingHorizontal: spacing.l,
    marginBottom: spacing.l,
  },
  greeting: {
    color: colors.neutral.white,
    opacity: 0.9,
    marginBottom: spacing.s,
    textTransform: 'uppercase',
    ...typography.body.m,
    fontWeight: '600',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.neutral.white,
    ...typography.header.xl,
    fontWeight: '300',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    gap: spacing.m,
    height: 180,
  },
  statCardLarge: {
    flex: 1.5,
  },
  rightColumn: {
    flex: 1,
    gap: spacing.m,
  },
  statCardSmall: {
    flex: 1,
  },
  audioWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    marginVertical: spacing.xs,
  },
  bar: {
    width: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
  },
  actionText: {
    color: colors.sunset.accent,
    ...typography.body.m,
    fontWeight: '600',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.neutral.black,
    ...typography.header.m,
    marginBottom: spacing.m,
  },
  emptyAction: {
    color: colors.sunset.accent,
    ...typography.body.m,
    fontWeight: '600',
  },
});
