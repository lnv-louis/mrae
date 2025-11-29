import React, { useCallback, useMemo } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PhotoMetadata } from '../types';
import { colors } from '../theme';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 2;
const ITEM_SIZE = (width - SPACING * (COLUMNS + 1)) / COLUMNS;

interface PhotoGridProps {
  photos: PhotoMetadata[];
  onPhotoPress?: (photo: PhotoMetadata) => void;
}

/**
 * High-performance photo grid with progressive loading
 * Uses FlashList for:
 * - Progressive rendering as user scrolls
 * - Efficient memory usage
 * - Smooth 60fps scrolling
 * - Automatic viewport optimization
 */
export default function PhotoGrid({ photos, onPhotoPress }: PhotoGridProps) {
  const handlePhotoPress = useCallback(
    (photo: PhotoMetadata) => {
      onPhotoPress?.(photo);
    },
    [onPhotoPress]
  );

  const renderItem = useCallback(
    ({ item: photo }: { item: PhotoMetadata }) => {
      // Calculate height based on aspect ratio if available
      let itemHeight = ITEM_SIZE; // Default to square

      if (photo.width && photo.height) {
        const aspectRatio = photo.width / photo.height;
        const clampedRatio = Math.max(0.5, Math.min(2, aspectRatio));
        itemHeight = ITEM_SIZE / clampedRatio;
      }

      return (
        <TouchableOpacity
          style={[styles.item, { height: itemHeight }]}
          onPress={() => handlePhotoPress(photo)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            resizeMode="cover"
            // Progressive loading for better UX
            progressiveRenderingEnabled={true}
            fadeDuration={100}
          />
        </TouchableOpacity>
      );
    },
    [handlePhotoPress]
  );

  const keyExtractor = useCallback((item: PhotoMetadata) => item.id, []);

  // Memoize estimated item size for FlashList optimization
  const getItemType = useCallback(
    (item: PhotoMetadata) => {
      // Group items by similar aspect ratios for better recycling
      if (!item.width || !item.height) return 'square';
      const ratio = item.width / item.height;
      if (ratio > 1.3) return 'landscape';
      if (ratio < 0.7) return 'portrait';
      return 'square';
    },
    []
  );

  return (
    <FlashList
      data={photos}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={ITEM_SIZE}
      numColumns={COLUMNS}
      // Progressive rendering settings
      drawDistance={400} // Load items 400px ahead
      estimatedFirstItemOffset={0}
      // Performance optimizations
      getItemType={getItemType}
      // Styling
      contentContainerStyle={styles.contentContainer}
      columnWrapperStyle={styles.row}
      showsVerticalScrollIndicator={false}
      // Better scrolling performance
      removeClippedSubviews={true}
      maxToRenderPerBatch={15}
      updateCellsBatchingPeriod={50}
      initialNumToRender={12}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: SPACING,
    paddingTop: SPACING,
  },
  row: {
    gap: SPACING,
    marginBottom: SPACING,
  },
  item: {
    width: ITEM_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.warm.tertiary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
