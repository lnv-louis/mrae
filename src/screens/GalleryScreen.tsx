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
  Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as MediaLibrary from 'expo-media-library';

import PhotoGrid from '../components/PhotoGrid';
import { CleanupMode } from '../components/CleanupMode';
import photoService from '../services/photoService';
import userPreferenceService from '../services/userPreferenceService';
import categorizationService from '../services/categorizationService';
import storageService from '../utils/storage';
import { PhotoMetadata } from '../types';
import ScreenLayout from '../components/ScreenLayout';
import { GallerySheet } from '../components/GallerySheet';
import { colors, typography, spacing, radius } from '../theme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const ITEM_SIZE = (width - spacing.l * 2 - spacing.m) / COLUMN_COUNT;

export default function GalleryScreen({ navigation }: any) {
  const [viewMode, setViewMode] = useState<'all' | 'folders' | 'categories'>('all');
  
  // Data
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [categories, setCategories] = useState<{ label: string; count: number }[]>([]);
  
  // Selection state for drill-down
  const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filteredPhotos, setFilteredPhotos] = useState<PhotoMetadata[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCleanupMode, setIsCleanupMode] = useState(false);
  const [username, setUsername] = useState('USER');

  useEffect(() => {
    checkPermissionsAndLoad();
    loadUsername();
    
    const unsubscribe = navigation.addListener('focus', () => {
      if (viewMode === 'all') loadPhotos();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (viewMode === 'folders') loadAlbums();
    // Categories are loaded via manual action or pre-loaded if we had them stored
  }, [viewMode]);

  useEffect(() => {
    if (selectedAlbum) {
      loadAlbumPhotos(selectedAlbum);
    } else if (selectedCategory) {
      // Mock filtering for category since we don't have backend query yet
      // in a real app this would query DB
      setFilteredPhotos(photos); // Placeholder
    } else {
      setFilteredPhotos(photos);
    }
  }, [selectedAlbum, selectedCategory, photos]);

  const loadUsername = async () => {
    try {
      const stored = await storageService.get('username');
      if (stored) setUsername(stored);
    } catch (error) {
      console.error(error);
    }
  };

  const checkPermissionsAndLoad = async () => {
    const hasPermission = await photoService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please allow access to photos.');
      return;
    }
    loadPhotos();
  };

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const fetched = await photoService.getAllPhotos();
      setPhotos(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const fetched = await photoService.getAlbums();
      setAlbums(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAlbumPhotos = async (album: MediaLibrary.Album) => {
    try {
      setLoading(true);
      const fetched = await photoService.getPhotosInAlbum(album);
      setFilteredPhotos(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'all') await loadPhotos();
    if (viewMode === 'folders') await loadAlbums();
    setRefreshing(false);
  };

  const handlePhotoPress = (photo: PhotoMetadata) => {
    navigation.navigate('PhotoDetail', { photoId: photo.id, uri: photo.uri });
  };

  const handleCategorize = async () => {
    Alert.prompt(
      'Smart Categorize',
      'Enter a theme (e.g. "nature", "city", "people")',
      async (text) => {
        if (!text) return;
        setLoading(true);
        try {
          const res = await categorizationService.categorizeAllImagesFromPrompt(text);
          setCategories(res.counts.map(c => ({ label: c.label, count: c.count })));
          setViewMode('categories');
          Alert.alert('Success', res.message);
        } catch {
          Alert.alert('Error', 'Failed to categorize');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // --- Render Helpers ---

  const renderSegmentControl = () => (
    <View style={styles.segmentContainer}>
      {(['all', 'folders', 'categories'] as const).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.segmentButton, viewMode === mode && styles.segmentButtonActive]}
          onPress={() => {
            setViewMode(mode);
            setSelectedAlbum(null);
            setSelectedCategory(null);
          }}
        >
          <Text style={[styles.segmentText, viewMode === mode && styles.segmentTextActive]}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderAlbums = () => (
    <View style={styles.gridContainer}>
      {albums.map((album) => (
        <TouchableOpacity 
          key={album.id} 
          style={styles.folderCard}
          onPress={() => setSelectedAlbum(album)}
        >
          <View style={styles.folderIcon}>
            <Ionicons name="folder" size={40} color={colors.warm.accent} />
          </View>
          <Text style={styles.folderTitle} numberOfLines={1}>{album.title}</Text>
          <Text style={styles.folderCount}>{album.assetCount} items</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCategories = () => (
    <View style={styles.gridContainer}>
      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No categories yet.</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCategorize}>
            <Text style={styles.createButtonText}>Create Categories</Text>
          </TouchableOpacity>
        </View>
      ) : (
        categories.map((cat) => (
          <TouchableOpacity 
            key={cat.label} 
            style={styles.categoryCard}
            onPress={() => setSelectedCategory(cat.label)}
          >
            <BlurView intensity={20} style={styles.categoryBlur}>
              <Text style={styles.categoryTitle}>{cat.label}</Text>
              <Text style={styles.categoryCount}>{cat.count}</Text>
            </BlurView>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  // --- Main Render ---

  if (loading && !refreshing) {
    return (
      <ScreenLayout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.neutral.white} />
        </View>
      </ScreenLayout>
    );
  }

  const isDrillDown = !!selectedAlbum || !!selectedCategory;
  const drillDownTitle = selectedAlbum?.title || selectedCategory;

  return (
    <ScreenLayout>
      <View style={styles.header}>
        {!isDrillDown ? (
          <>
            <Text style={styles.headerTitle}>Library</Text>
            {renderSegmentControl()}
          </>
        ) : (
          <View style={styles.drillDownHeader}>
            <TouchableOpacity onPress={() => { setSelectedAlbum(null); setSelectedCategory(null); }}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.drillDownTitle}>{drillDownTitle}</Text>
          </View>
        )}
        
        {/* Actions */}
        {!isDrillDown && viewMode === 'all' && (
          <TouchableOpacity style={styles.headerAction} onPress={() => setIsCleanupMode(true)}>
            <Ionicons name="sparkles-outline" size={20} color={colors.warm.accent} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff"/>}
      >
        {isDrillDown ? (
          <PhotoGrid photos={filteredPhotos} onPhotoPress={handlePhotoPress} />
        ) : (
          <>
            {viewMode === 'all' && (
              photos.length === 0 ? (
                <Text style={styles.emptyText}>No photos found</Text>
              ) : (
                <PhotoGrid photos={photos} onPhotoPress={handlePhotoPress} />
              )
            )}
            {viewMode === 'folders' && renderAlbums()}
            {viewMode === 'categories' && renderCategories()}
          </>
        )}
      </ScrollView>

      {/* Cleanup Mode Modal Overlay would go here or navigation */}
      {isCleanupMode && (
        <View style={styles.modalOverlay}>
          <CleanupMode 
            photos={photos}
            onKeep={async (p) => await userPreferenceService.markPreference(p.id, 'Like')}
            onDelete={async (p) => {
              await MediaLibrary.deleteAssetsAsync([p.id]);
              setPhotos(prev => prev.filter(x => x.id !== p.id));
            }}
            onFinish={() => setIsCleanupMode(false)}
          />
          <TouchableOpacity style={styles.closeModal} onPress={() => setIsCleanupMode(false)}>
            <Ionicons name="close" size={24} color={colors.neutral.white} />
          </TouchableOpacity>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: spacing.header - 20,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
    backgroundColor: 'rgba(255, 138, 101, 0.1)',
  },
  headerTitle: {
    ...typography.header.l,
    color: colors.text.primary,
    marginBottom: spacing.m,
    fontWeight: '300',
    letterSpacing: 2,
  },
  drillDownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    height: 44,
  },
  drillDownTitle: {
    ...typography.header.m,
    color: colors.text.primary,
    fontWeight: '400',
  },
  headerAction: {
    position: 'absolute',
    right: spacing.l,
    top: spacing.header,
    padding: 8,
    backgroundColor: colors.neutral.white,
    borderRadius: 20,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: radius.l,
    padding: 4,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.m,
  },
  segmentButtonActive: {
    backgroundColor: colors.warm.tertiary,
  },
  segmentText: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.warm.accent,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.m,
    gap: spacing.m,
  },
  folderCard: {
    width: ITEM_SIZE,
    aspectRatio: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: radius.m,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  folderIcon: {
    marginBottom: spacing.s,
  },
  folderTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  folderCount: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 4,
  },
  categoryCard: {
    width: ITEM_SIZE,
    aspectRatio: 1.5,
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: colors.warm.secondary,
  },
  categoryBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowRadius: 4,
  },
  categoryCount: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  emptyContainer: {
    width: '100%',
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: 16,
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: colors.warm.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.l,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(93, 64, 55, 0.95)',
  },
  closeModal: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 12,
    backgroundColor: colors.warm.primary,
    borderRadius: 20,
  },
});
