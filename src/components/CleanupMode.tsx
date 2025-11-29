import React, { useCallback } from 'react';
import { Dimensions, Image, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { PhotoMetadata } from '../types';
import { BlurView } from 'expo-blur';
import { colors, spacing, radius } from '../theme';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

interface CleanupModeProps {
  photos: PhotoMetadata[];
  onKeep: (photo: PhotoMetadata) => void;
  onDelete: (photo: PhotoMetadata) => void;
  onFinish: (photosToDelete: PhotoMetadata[]) => void;
}

const Card = ({ photo, onSwipeComplete, index, isTopCard }: { photo: PhotoMetadata; onSwipeComplete: (direction: 'left' | 'right') => void; index: number; isTopCard: boolean }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(isTopCard) // Only enable gestures on the top card
    .minDistance(10)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      scale.value = withSpring(1.05);
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      scale.value = withSpring(1);
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        if (event.translationX > 0) {
          translateX.value = withSpring(width * 1.5);
          runOnJS(onSwipeComplete)('right');
        } else {
          translateX.value = withSpring(-width * 1.5);
          runOnJS(onSwipeComplete)('left');
        }
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const rStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width / 2, 0, width / 2],
      [-10, 0, 10],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
    };
  });

  const overlayStyleRight = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [0, width / 4], [0, 1]),
    };
  });

  const overlayStyleLeft = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [-width / 4, 0], [1, 0]),
    };
  });

  // Only render top 3 cards for performance
  if (index > 2) return null;

  const cardStyle = {
    zIndex: 100 - index, // Top card (index 0) has highest z-index
    top: index * 10,
    transform: [{ scale: 1 - index * 0.05 }],
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, rStyle, cardStyle]}>
        <Image source={{ uri: photo.uri }} style={styles.image} />
        
        {/* Overlays for Keep/Delete feedback */}
        <Animated.View style={[styles.overlay, styles.keepOverlay, overlayStyleRight]}>
          <Text style={styles.overlayText}>KEEP</Text>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.deleteOverlay, overlayStyleLeft]}>
          <Text style={styles.overlayText}>DELETE</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

export const CleanupMode = ({ photos, onKeep, onDelete, onFinish }: CleanupModeProps) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [photosToDelete, setPhotosToDelete] = React.useState<PhotoMetadata[]>([]);

  // Handle empty photos array
  if (!photos || photos.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.finishCard}>
          <Text style={styles.finishTitle}>No photos to review</Text>
          <TouchableOpacity style={styles.finishButton} onPress={() => onFinish([])}>
            <Text style={styles.finishButtonText}>Return to Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const photo = photos[currentIndex];

    if (!photo) {
      console.warn('No photo at current index:', currentIndex);
      return;
    }

    console.log(`Swiped ${direction} on photo ${currentIndex + 1}/${photos.length}`);

    if (direction === 'left') {
      // Queue for deletion instead of deleting immediately
      setPhotosToDelete(prev => {
        const updated = [...prev, photo];
        // If this is the last photo, call onFinish with updated queue
        if (currentIndex >= photos.length - 1) {
          setTimeout(() => onFinish(updated), 100);
        }
        return updated;
      });
      onDelete(photo);
    } else {
      onKeep(photo);
    }

    if (currentIndex >= photos.length - 1) {
      // Finished all photos, will be handled in setPhotosToDelete callback
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, photos, onKeep, onDelete, onFinish]);
  
  const handleFinish = useCallback(() => {
    // When user clicks close or finishes, pass queued photos
    onFinish(photosToDelete);
  }, [onFinish, photosToDelete]);

  if (currentIndex >= photos.length) {
    return (
      <View style={styles.container}>
        <View style={styles.finishCard}>
          <Text style={styles.finishTitle}>All caught up! 🎉</Text>
          {photosToDelete.length > 0 && (
            <Text style={styles.finishSubtitle}>
              {photosToDelete.length} photo{photosToDelete.length > 1 ? 's' : ''} queued for deletion
            </Text>
          )}
          <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
            <Text style={styles.finishButtonText}>Return to Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show current card and next few cards
  const visiblePhotos = photos.slice(currentIndex, currentIndex + 3);

  return (
    <View style={styles.container}>
      {/* Header with title - always visible at top */}
      <BlurView intensity={80} tint="dark" style={styles.headerBar}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Cleanup Mode</Text>
            {photosToDelete.length > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>
                  {photosToDelete.length} queued
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleFinish}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Swipe Left to Delete, Right to Keep</Text>
      </BlurView>

      <View style={styles.cardContainer}>
        {/* Render cards in reverse order so top card is rendered last (highest z-index) */}
        {[...visiblePhotos].reverse().map((photo, reversedIndex) => {
          const actualIndex = visiblePhotos.length - 1 - reversedIndex;
          return (
            <Card
              key={`${photo.id}-${currentIndex + actualIndex}`}
              photo={photo}
              index={actualIndex}
              isTopCard={actualIndex === 0}
              onSwipeComplete={handleSwipe}
            />
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleSwipe('left')}
          >
            <Ionicons name="close" size={32} color={colors.neutral.white} />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>Delete</Text>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.keepButton]}
            onPress={() => handleSwipe('right')}
          >
            <Ionicons name="heart" size={32} color={colors.neutral.white} />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>Keep</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: spacing.l,
    backgroundColor: 'rgba(93, 64, 55, 0.95)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  queueBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  queueBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  cardContainer: {
    width: width * 0.95,
    height: height * 0.65,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
    marginTop: 100,
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    borderRadius: radius.xl,
    backgroundColor: colors.neutral.white,
    shadowColor: colors.warm.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: 40,
    padding: 15,
    borderRadius: 12,
    borderWidth: 4,
  },
  keepOverlay: {
    left: 40,
    borderColor: colors.warm.accent,
    transform: [{ rotate: '-15deg' }],
    backgroundColor: 'rgba(255, 110, 64, 0.2)',
  },
  deleteOverlay: {
    right: 40,
    borderColor: colors.semantic.error,
    transform: [{ rotate: '15deg' }],
    backgroundColor: 'rgba(239, 83, 80, 0.2)',
  },
  overlayText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: spacing.xl + 20,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  buttonGroup: {
    alignItems: 'center',
    gap: spacing.s,
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.warm.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteButton: {
    backgroundColor: colors.semantic.error,
  },
  keepButton: {
    backgroundColor: colors.warm.accent,
  },
  buttonLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  finishCard: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  finishTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  finishSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 8,
  },
  finishButton: {
    backgroundColor: '#FF6B4A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

