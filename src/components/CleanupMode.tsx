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
import { PhotoMetadata } from '../types';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

interface CleanupModeProps {
  photos: PhotoMetadata[];
  onKeep: (photo: PhotoMetadata) => void;
  onDelete: (photo: PhotoMetadata) => void;
  onFinish: (photosToDelete: PhotoMetadata[]) => void;
}

const Card = ({ photo, onSwipeComplete, index }: { photo: PhotoMetadata; onSwipeComplete: (direction: 'left' | 'right') => void; index: number }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(true)
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
    zIndex: -index,
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

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const photo = photos[currentIndex];
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
  const visiblePhotos = photos.slice(currentIndex, currentIndex + 3).map((p, i) => ({...p, originalIndex: currentIndex + i}));

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={handleFinish}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
      
      <View style={styles.header}>
        <Text style={styles.title}>Cleanup Mode</Text>
        <Text style={styles.subtitle}>Swipe Left to Delete, Right to Keep</Text>
        {photosToDelete.length > 0 && (
          <Text style={styles.queueText}>
            {photosToDelete.length} photo{photosToDelete.length > 1 ? 's' : ''} queued for deletion
          </Text>
        )}
      </View>
      
      <View style={styles.cardContainer}>
        {visiblePhotos.reverse().map((photo, index) => (
           <Card 
             key={photo.id} 
             photo={photo} 
             index={visiblePhotos.length - 1 - index} // Pass index relative to stack (0 is top)
             onSwipeComplete={handleSwipe} 
           />
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleSwipe('left')}
        >
          <Text style={styles.buttonEmoji}>🗑️</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.keepButton]}
          onPress={() => handleSwipe('right')}
        >
          <Text style={styles.buttonEmoji}>❤️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 60,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  cardContainer: {
    width: width * 0.95,
    height: height * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    borderRadius: 24,
    backgroundColor: '#2E1A24',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
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
    borderColor: '#4CD964',
    transform: [{ rotate: '-15deg' }],
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  deleteOverlay: {
    right: 40,
    borderColor: '#FF3B30',
    transform: [{ rotate: '15deg' }],
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    marginTop: 40,
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  deleteButton: {
    borderWidth: 0,
  },
  keepButton: {
    borderWidth: 0,
  },
  buttonEmoji: {
    fontSize: 30,
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
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
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

