import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as MediaLibrary from 'expo-media-library';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import PhotoGrid from '../components/PhotoGrid';
import { CleanupMode } from '../components/CleanupMode';
import photoService from '../services/photoService';
import userPreferenceService from '../services/userPreferenceService';
import categorizationService from '../services/categorizationService';
import databaseService from '../services/databaseService';
import storageService from '../utils/storage';
import { PhotoMetadata } from '../types';
import ScreenLayout from '../components/ScreenLayout';
import { GallerySheet } from '../components/GallerySheet';
import { colors, typography, spacing, radius } from '../theme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const ITEM_SIZE = (width - spacing.l * 2 - spacing.m) / COLUMN_COUNT;

export default function GalleryScreen({ navigation }: any) {
  const [viewMode, setViewMode] = useState<'all' | 'categories'>('all');

  // Data
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [categories, setCategories] = useState<{ label: string; count: number }[]>([]);

  // Selection state for drill-down
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filteredPhotos, setFilteredPhotos] = useState<PhotoMetadata[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCleanupMode, setIsCleanupMode] = useState(false);
  const [username, setUsername] = useState('USER');

  // Callback functions
  const loadUsername = useCallback(async () => {
    try {
      const stored = await storageService.get('username');
      if (stored) setUsername(stored);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const fetched = await photoService.getAllPhotos();
      // Sort by date (newest first)
      const sorted = [...fetched].sort((a, b) => {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setPhotos(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPermissionsAndLoad = useCallback(async () => {
    const hasPermission = await photoService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please allow access to photos.');
      return;
    }
    loadPhotos();
  }, [loadPhotos]);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const labels = await databaseService.getAllLabels();
      setCategories(labels);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategoryPhotos = useCallback(async (category: string) => {
    try {
      setLoading(true);
      const photoIds = await databaseService.getPhotosByLabel(category);
      // Get full photo metadata for each photo ID
      const allPhotos = await photoService.getAllPhotos();
      const categorizedPhotos = allPhotos.filter(p => photoIds.includes(p.id));
      setFilteredPhotos(categorizedPhotos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === 'all') await loadPhotos();
    if (viewMode === 'categories') await loadCategories();
    setRefreshing(false);
  }, [viewMode, loadPhotos, loadCategories]);

  const handlePhotoPress = useCallback((photo: PhotoMetadata) => {
    navigation.navigate('PhotoDetail', { photoId: photo.id, uri: photo.uri });
  }, [navigation]);

  const handleAutoCategorize = async () => {
    setLoading(true);
    try {
      console.log('🎨 Starting auto-categorization...');
      const res = await categorizationService.autoCategorizeAllImages();

      // Reload categories from database
      await loadCategories();
      setViewMode('categories');

      Alert.alert(
        '✨ Categorization Complete!',
        res.message + '\n\nYour photos are now organized by mood, color, and aesthetics.',
        [{ text: 'View Categories', onPress: () => setViewMode('categories') }]
      );
    } catch (error: any) {
      console.error('Auto-categorization error:', error);
      Alert.alert(
        'Categorization Failed',
        error?.message || 'Failed to auto-categorize photos. Make sure images are indexed first.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualCategorize = async () => {
    Alert.prompt(
      'Custom Categories',
      'Enter themes (e.g. "nature, city, food, pets")',
      async (text) => {
        if (!text) return;
        setLoading(true);
        try {
          const res = await categorizationService.categorizeAllImagesFromPrompt(text);
          await loadCategories();
          setViewMode('categories');
          Alert.alert('Success', res.message);
        } catch (error: any) {
          console.error('Categorization error:', error);
          Alert.alert('Error', error?.message || 'Failed to categorize');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Effects
  useEffect(() => {
    checkPermissionsAndLoad();
    loadUsername();

    const unsubscribe = navigation.addListener('focus', () => {
      if (viewMode === 'all') loadPhotos();
      if (viewMode === 'categories') loadCategories();
    });
    return unsubscribe;
  }, [navigation, checkPermissionsAndLoad, loadUsername, loadPhotos, loadCategories, viewMode]);

  useEffect(() => {
    if (viewMode === 'categories') loadCategories();
    if (viewMode === 'all') loadPhotos();
  }, [viewMode, loadCategories, loadPhotos]);

  useEffect(() => {
    if (selectedCategory) {
      loadCategoryPhotos(selectedCategory);
    } else {
      setFilteredPhotos(photos);
    }
  }, [selectedCategory, photos, loadCategoryPhotos]);

  // --- Render Helpers ---

  const renderSegmentControl = () => (
    <>
      <View style={styles.segmentContainer}>
        {(['all', 'categories'] as const).map((mode) => {
          const isActive = viewMode === mode;
          const isPrimaryHero = mode === 'categories'; // Categories is THE hero feature
          const isSecondary = mode === 'all';

          return (
            <TouchableOpacity
              key={mode}
              style={[
                styles.segmentButton,
                isActive && styles.segmentButtonActive,
                isPrimaryHero && styles.segmentButtonHero,
                isActive && isPrimaryHero && styles.segmentButtonActiveHero,
                isSecondary && styles.segmentButtonSecondary,
                isActive && isSecondary && styles.segmentButtonActiveSecondary,
              ]}
              onPress={() => {
                setViewMode(mode);
                setSelectedCategory(null);
              }}
            >
              <Text style={[
                styles.segmentText,
                isActive && styles.segmentTextActive,
                isPrimaryHero && styles.segmentTextHero,
                isActive && isPrimaryHero && styles.segmentTextActiveHero,
                isSecondary && styles.segmentTextSecondary,
                isActive && isSecondary && styles.segmentTextActiveSecondary,
              ]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
              {isPrimaryHero && (
                <View style={styles.aiIndicator}>
                  <Ionicons name="sparkles" size={10} color={isActive ? colors.neutral.white : colors.warm.accent} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {viewMode === 'categories' && (
        <Text style={styles.categorySubtitle}>
          AI-powered smart categories based on mood, color, and aesthetics
        </Text>
      )}
    </>
  );

  const renderCategories = () => (
    <View style={styles.gridContainer}>
      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="sparkles-outline" size={48} color={colors.warm.accent} style={{ marginBottom: spacing.m }} />
          <Text style={styles.emptyTitle}>AI Smart Categories</Text>
          <Text style={styles.emptyText}>
            Automatically organize your photos by mood, color, and aesthetics
          </Text>

          {/* Auto-Categorize - Primary CTA */}
          <TouchableOpacity style={styles.createButton} onPress={handleAutoCategorize}>
            <Ionicons name="sparkles" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.createButtonText}>Auto-Categorize Photos</Text>
          </TouchableOpacity>

          {/* Manual Categorize - Secondary option */}
          <TouchableOpacity
            style={[styles.createButton, styles.secondaryButton]}
            onPress={handleManualCategorize}
          >
            <Text style={[styles.createButtonText, styles.secondaryButtonText]}>
              Custom Categories...
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        categories.map((cat, index) => {
          // Cycle through warm gradient colors for visual variety
          const gradientColors = [
            ['#FF6B4A', '#FF8C6B'],  // Warm orange
            ['#FFB199', '#FFCBB0'],  // Soft peach
            ['#FF9E7A', '#FFBFA0'],  // Light coral
            ['#E8765C', '#FF9980'],  // Deep salmon
          ];
          const gradient = gradientColors[index % gradientColors.length];

          return (
            <TouchableOpacity
              key={cat.label}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: gradient[0],
                  shadowColor: gradient[0],
                }
              ]}
              onPress={() => setSelectedCategory(cat.label)}
            >
              <BlurView intensity={30} tint="light" style={styles.categoryBlur}>
                <View style={styles.categoryContent}>
                  <Ionicons name="images" size={24} color={colors.neutral.white} style={{ opacity: 0.9 }} />
                  <Text style={styles.categoryTitle}>{cat.label}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryCount}>{cat.count} photos</Text>
                  </View>
                </View>
              </BlurView>
            </TouchableOpacity>
          );
        })
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

  const isDrillDown = !!selectedCategory;
  const drillDownTitle = selectedCategory;

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
            <TouchableOpacity onPress={() => { setSelectedCategory(null); }}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.drillDownTitle}>{drillDownTitle}</Text>
          </View>
        )}
        
        {/* Actions */}
        {!isDrillDown && viewMode === 'all' && (
          <TouchableOpacity style={styles.headerAction} onPress={() => setIsCleanupMode(true)}>
            <Ionicons name="brush-outline" size={20} color={colors.warm.accent} />
          </TouchableOpacity>
        )}
        {!isDrillDown && viewMode === 'categories' && categories.length > 0 && (
          <TouchableOpacity style={styles.headerAction} onPress={handleAutoCategorize}>
            <Ionicons name="refresh" size={20} color={colors.warm.accent} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff"/>}
        decelerationRate={0.998}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
        bounces={true}
        overScrollMode="never"
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
            {viewMode === 'categories' && renderCategories()}
          </>
          )}
      </ScrollView>

      {/* Cleanup Mode Fullscreen Modal */}
      <Modal
        visible={isCleanupMode}
        animationType="fade"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={() => setIsCleanupMode(false)}
      >
        <StatusBar hidden={true} />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <CleanupMode
            photos={photos}
            onKeep={async (photo) => await userPreferenceService.markPreference(photo.id, 'Like')}
            onDelete={() => {
              // Queue for deletion, don't delete immediately - handled in CleanupMode
            }}
            onFinish={(photosToDelete) => {
              // Delete all queued photos at once
              if (photosToDelete && photosToDelete.length > 0) {
                Alert.alert(
                  'Delete Photos',
                  `Are you sure you want to delete ${photosToDelete.length} photo${photosToDelete.length > 1 ? 's' : ''}?`,
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => setIsCleanupMode(false) },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await MediaLibrary.deleteAssetsAsync(photosToDelete.map(p => p.id));
                          setPhotos(prev => prev.filter(x => !photosToDelete.some(d => d.id === x.id)));
                          setIsCleanupMode(false);
                        } catch (e) {
                          Alert.alert('Error', 'Failed to delete some photos');
                          setIsCleanupMode(false);
                        }
                      }
                    }
                  ]
                );
              } else {
                setIsCleanupMode(false);
              }
            }}
          />
        </GestureHandlerRootView>
      </Modal>
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
    backgroundColor: colors.background.secondary,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.m,
    position: 'relative',
  },
  // Categories is THE hero feature - most prominent
  segmentButtonHero: {
    borderWidth: 1.5,
    borderColor: colors.warm.accent,
  },
  segmentButtonActiveHero: {
    backgroundColor: colors.warm.accent,
    shadowColor: colors.warm.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.02 }],
  },
  // All is secondary importance
  segmentButtonSecondary: {
    borderWidth: 0.5,
    borderColor: colors.warm.tertiary,
  },
  segmentButtonActive: {
    backgroundColor: colors.warm.tertiary,
  },
  segmentButtonActiveSecondary: {
    backgroundColor: colors.warm.tertiary,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Hero text styling (Categories)
  segmentTextHero: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  segmentTextActiveHero: {
    color: colors.neutral.white,
    fontWeight: '800',
  },
  // Secondary text styling (All)
  segmentTextSecondary: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.warm.accent,
  },
  segmentTextActiveSecondary: {
    color: colors.neutral.white,
    fontWeight: '700',
  },
  aiIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categorySubtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.s,
    textAlign: 'center',
    letterSpacing: 0.3,
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
  categoryCard: {
    width: ITEM_SIZE,
    aspectRatio: 1.2,
    borderRadius: radius.l,
    overflow: 'hidden',
    backgroundColor: colors.warm.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
  },
  categoryContent: {
    alignItems: 'center',
    gap: spacing.s,
  },
  categoryTitle: {
    color: colors.neutral.white,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  categoryCount: {
    color: colors.neutral.white,
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyContainer: {
    width: '100%',
    padding: spacing.xl,
    paddingTop: spacing.xxl * 2,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.s,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 15,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  createButton: {
    backgroundColor: colors.warm.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.l,
    shadowColor: colors.warm.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  createButtonText: {
    color: colors.neutral.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.warm.accent,
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryButtonText: {
    color: colors.warm.accent,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    paddingTop: 0,
  },
  closeModal: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
