import React, { useMemo } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MasonryFlashList } from '@shopify/flash-list';
import { PhotoMetadata } from '../types';
import { colors, radius, spacing, haptics } from '../theme';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

interface MasonryGalleryProps {
  photos: PhotoMetadata[];
  onPhotoPress: (photo: PhotoMetadata) => void;
  ListHeaderComponent?: React.ReactElement;
}

export const MasonryGallery = ({ photos, onPhotoPress, ListHeaderComponent }: MasonryGalleryProps) => {
  const renderItem = ({ item, index }: { item: PhotoMetadata; index: number }) => {
    // Simulate random heights for demo (in real app use item.height / item.width)
    const aspectRatio = item.width && item.height ? item.width / item.height : 0.7 + Math.random() * 0.6;
    
    return (
      <Animated.View 
        entering={FadeIn.delay(index * 50).springify()} 
        style={[styles.itemContainer, { aspectRatio }]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            haptics.selection();
            onPhotoPress(item);
          }}
          style={styles.touchable}
        >
          <Image source={{ uri: item.uri }} style={styles.image} />
          {/* "Breathing" indicator for indexing status (mocked) */}
          {index < 3 && (
            <Animated.View 
              entering={ZoomIn.delay(1000)}
              style={styles.indexingDot} 
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <MasonryFlashList
        data={photos}
        numColumns={2}
        renderItem={renderItem}
        estimatedItemSize={200}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 2, // Fix FlashList layout issue
  },
  listContent: {
    paddingHorizontal: spacing.s,
    paddingBottom: spacing.bottomTab + spacing.l,
  },
  itemContainer: {
    flex: 1,
    margin: spacing.xs,
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: colors.neutral.gray200,
  },
  touchable: {
    flex: 1,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  indexingDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sunset.accent,
    borderWidth: 1,
    borderColor: colors.neutral.white,
  },
});

