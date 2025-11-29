import React, { useCallback } from 'react';
import { Dimensions, Image, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedGestureHandler,
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
  onFinish: () => void;
}

const Card = ({ photo, onSwipeComplete, index }: { photo: PhotoMetadata; onSwipeComplete: (direction: 'left' | 'right') => void; index: number }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number; startY: number }>({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
      scale.value = withSpring(1.05);
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
    },
    onEnd: (event) => {
      scale.value = withSpring(1);
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(width * 1.5);
        runOnJS(onSwipeComplete)('right');
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-width * 1.5);
        runOnJS(onSwipeComplete)('left');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
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

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[styles.card, rStyle, { zIndex: -index, top: index * 10, scale: 1 - index * 0.05 }]}>
        <Image source={{ uri: photo.uri }} style={styles.image} />
        
        {/* Overlays for Keep/Delete feedback */}
        <Animated.View style={[styles.overlay, styles.keepOverlay, overlayStyleRight]}>
          <Text style={styles.overlayText}>KEEP</Text>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.deleteOverlay, overlayStyleLeft]}>
          <Text style={styles.overlayText}>DELETE</Text>
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
};

export const CleanupMode = ({ photos, onKeep, onDelete, onFinish }: CleanupModeProps) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const photo = photos[currentIndex];
    if (direction === 'left') {
      onDelete(photo);
    } else {
      onKeep(photo);
    }
    
    if (currentIndex >= photos.length - 1) {
      onFinish();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, photos, onKeep, onDelete, onFinish]);

  if (currentIndex >= photos.length) {
    return (
      <View style={styles.container}>
        <BlurView intensity={30} tint="light" style={styles.finishCard}>
          <Text style={styles.finishTitle}>All caught up! 🎉</Text>
          <TouchableOpacity style={styles.finishButton} onPress={onFinish}>
            <Text style={styles.finishButtonText}>Return to Gallery</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    );
  }

  // Show current card and next few cards
  const visiblePhotos = photos.slice(currentIndex, currentIndex + 3).map((p, i) => ({...p, originalIndex: currentIndex + i}));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cleanup Mode</Text>
        <Text style={styles.subtitle}>Swipe Left to Delete, Right to Keep</Text>
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
  cardContainer: {
    width: width * 0.9,
    height: height * 0.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    borderRadius: 24,
    backgroundColor: '#000',
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
  },
  deleteOverlay: {
    right: 40,
    borderColor: '#FF3B30',
    transform: [{ rotate: '15deg' }],
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
  finishCard: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }
});

