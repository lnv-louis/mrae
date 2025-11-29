import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { PhotoMetadata } from '../types';
import { colors } from '../theme';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 2;
const COLUMN_WIDTH = (width - SPACING * (COLUMNS + 1)) / COLUMNS;

interface PhotoGridProps {
  photos: PhotoMetadata[];
  onPhotoPress?: (photo: PhotoMetadata) => void;
}

interface PhotoWithLayout extends PhotoMetadata {
  displayHeight: number;
  column: number;
}

/**
 * Apple Photos-style grid with:
 * - Fixed column widths (all photos same width)
 * - Variable heights based on aspect ratio
 * - Balanced column layout (shortest column gets next photo)
 * - Dynamic dimension fetching for photos without metadata
 */
export default function PhotoGrid({ photos, onPhotoPress }: PhotoGridProps) {
  const [photosWithLayout, setPhotosWithLayout] = useState<PhotoWithLayout[]>([]);

  const getImageHeight = useCallback(async (photo: PhotoMetadata): Promise<number> => {
    // If we have width and height metadata, use it
    if (photo.width && photo.height) {
      const aspectRatio = photo.width / photo.height;
      const clampedRatio = Math.max(0.5, Math.min(2, aspectRatio));
      return COLUMN_WIDTH / clampedRatio;
    }

    // Otherwise, fetch dimensions dynamically
    return new Promise((resolve) => {
      Image.getSize(
        photo.uri,
        (w, h) => {
          const aspectRatio = w / h;
          const clampedRatio = Math.max(0.5, Math.min(2, aspectRatio));
          resolve(COLUMN_WIDTH / clampedRatio);
        },
        () => {
          // Fallback to square if error
          resolve(COLUMN_WIDTH);
        }
      );
    });
  }, []);

  const calculateLayout = useCallback(async () => {
    // Reset column heights
    const heights = [0, 0, 0];
    const layoutPhotos: PhotoWithLayout[] = [];

    // Process photos sequentially to maintain order
    for (const photo of photos) {
      const displayHeight = await getImageHeight(photo);

      // Find shortest column (balanced layout like Apple Photos)
      const shortestColumnIndex = heights.indexOf(Math.min(...heights));
      
      // Assign photo to shortest column
      layoutPhotos.push({
        ...photo,
        displayHeight,
        column: shortestColumnIndex,
      });

      // Update column height
      heights[shortestColumnIndex] += displayHeight + SPACING;
    }

    setPhotosWithLayout(layoutPhotos);
  }, [photos, getImageHeight]);

  useEffect(() => {
    calculateLayout();
  }, [calculateLayout]);

  // Memoize column grouping
  const columns = useMemo(() => {
    const cols: PhotoWithLayout[][] = [[], [], []];
    photosWithLayout.forEach((photo) => {
      cols[photo.column].push(photo);
    });
    return cols;
  }, [photosWithLayout]);

  const handlePhotoPress = useCallback((photo: PhotoMetadata) => {
    onPhotoPress?.(photo);
  }, [onPhotoPress]);

  return (
    <View style={styles.container}>
      {columns.map((columnPhotos, columnIndex) => (
        <View key={columnIndex} style={styles.column}>
          {columnPhotos.map((photo) => (
        <TouchableOpacity
          key={photo.id}
              style={[
                styles.item,
                { height: photo.displayHeight }
              ]}
          onPress={() => handlePhotoPress(photo)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            resizeMode="cover"
          />
        </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: SPACING,
    gap: SPACING,
  },
  column: {
    flex: 1,
    gap: SPACING,
  },
  item: {
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.warm.tertiary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
