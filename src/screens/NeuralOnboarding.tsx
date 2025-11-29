import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import photoService from '../services/photoService';
import indexingService from '../services/indexingService';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSpring,
  Easing,
  FadeInDown,
  interpolate,
  useDerivedValue,
  withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const PARTICLE_COUNT = 40;

interface OnboardingProps {
  onComplete: () => void;
}

// Pulsing status dot
const PulsingDot = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulsingDot, animatedStyle]} />;
};

// 3D Particle component
interface ParticleProps {
  index: number;
  progress: Animated.SharedValue<number>;
}

const Particle = ({ index, progress }: ParticleProps) => {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const radius = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 50;
    
    // Spiral outward animation
    radius.value = withDelay(
      delay,
      withRepeat(
        withTiming(120, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );

    // Rotation animation
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1,
        false
      )
    );

    // Scale pulse
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );

    // Fade in/out
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const currentRadius = interpolate(
      progress.value,
      [0, 1],
      [0, radius.value]
    );

    const rotationRad = (rotation.value * Math.PI) / 180;
    const x = Math.cos(angle + rotationRad) * currentRadius;
    const y = Math.sin(angle + rotationRad) * currentRadius * 0.6; // Flatten for 3D perspective
    const z = Math.sin(angle + rotationRad) * currentRadius * 0.4;

    const size = interpolate(
      z,
      [-120, 120],
      [3, 12]
    );

    const particleOpacity = interpolate(
      z,
      [-120, 0, 120],
      [0.2, 0.6, 1]
    ) * opacity.value;

    return {
      position: 'absolute',
      width: size * scale.value,
      height: size * scale.value,
      borderRadius: (size * scale.value) / 2,
      backgroundColor: colors.warm.accent,
      opacity: particleOpacity,
      transform: [
        { translateX: x },
        { translateY: y },
      ],
      shadowColor: colors.warm.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: size,
      elevation: z > 0 ? 5 : 1,
    };
  });

  return <Animated.View style={animatedStyle} />;
};

// 3D Particle Field
interface ParticleFieldProps {
  progress: number;
}

const ParticleField = ({ progress }: ParticleFieldProps) => {
  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withSpring(progress, {
      damping: 15,
      stiffness: 50,
    });
  }, [progress]);

  const centerGlowStyle = useAnimatedStyle(() => {
    const glowScale = interpolate(
      progressValue.value,
      [0, 0.5, 1],
      [0.5, 1.2, 0.8]
    );

    return {
      transform: [{ scale: glowScale }],
      opacity: interpolate(progressValue.value, [0, 1], [0.3, 0.6]),
    };
  });

  return (
    <View style={styles.particleContainer}>
      {/* Central glow */}
      <Animated.View style={[styles.centerGlow, centerGlowStyle]} />
      
      {/* Particles */}
      <View style={styles.particlesWrapper}>
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle key={i} index={i} progress={progressValue} />
        ))}
      </View>
    </View>
  );
};

export default function NeuralOnboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'connect' | 'indexing'>('welcome');
  const [indexingStats, setIndexingStats] = useState({ processed: 0, total: 0 });
  const [currentPhoto, setCurrentPhoto] = useState<string>('');

  // Real indexing with actual photo processing
  useEffect(() => {
    if (step === 'indexing') {
      startRealIndexing();
    }
  }, [step]);

  const startRealIndexing = async () => {
    try {
      await indexingService.startIndexing((progress) => {
        setIndexingStats({
          processed: progress.processed,
          total: progress.total,
        });
        if (progress.current) {
          setCurrentPhoto(progress.current);
        }
        
        // Complete when done
        if (progress.processed >= progress.total) {
          setTimeout(onComplete, 1500);
        }
      });
    } catch (error) {
      console.error('Indexing error:', error);
      // Still complete onboarding even if indexing fails
      setTimeout(onComplete, 1500);
    }
  };

  const handleConnectLocal = async () => {
    const granted = await photoService.requestPermissions();
    if (granted) {
      setStep('indexing');
    }
  };

  const progressPercentage = indexingStats.total > 0 
    ? indexingStats.processed / indexingStats.total 
    : 0;

  const renderContent = () => {
    if (step === 'welcome') {
      return (
        <View style={styles.content}>
          <Animated.Text entering={FadeInDown.duration(1000).springify()} style={styles.title}>
            MRAE
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300).duration(1000).springify()} style={styles.subtitle}>
            Your external memory,{'\n'}reimagined.
          </Animated.Text>
          
          <View style={styles.spacer} />

          <Animated.View entering={FadeInDown.delay(600).duration(1000)}>
            <TouchableOpacity style={styles.minimalButton} onPress={() => setStep('connect')}>
              <Text style={styles.minimalButtonText}>Enter</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.warm.accent} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      );
    }

    if (step === 'connect') {
      return (
        <View style={styles.content}>
          <Animated.Text entering={FadeInDown.duration(800)} style={styles.sectionTitle}>
            Connect
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).duration(800)} style={styles.sectionSubtitle}>
            Link your visual history to begin.
          </Animated.Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.minimalOptionCard} onPress={handleConnectLocal}>
              <View style={styles.optionIconCircle}>
                <Ionicons name="images-outline" size={24} color={colors.warm.accent} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Photos</Text>
                <Text style={styles.optionDesc}>Local Gallery</Text>
              </View>
              <Ionicons name="add" size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return ( // Indexing step with 3D particles
      <View style={styles.contentCenter}>
        <ParticleField progress={progressPercentage} />
        
        <View style={styles.statsContainer}>
          {/* Large Percentage Display */}
          <Animated.View 
            style={styles.percentageContainer}
            key={`percentage-${Math.round(progressPercentage * 100)}`}
            entering={FadeInDown.duration(400).springify()}
          >
            <Text style={styles.percentageNumber}>
              {Math.round(progressPercentage * 100)}
            </Text>
            <Text style={styles.percentageSymbol}>%</Text>
          </Animated.View>
          
          {/* Photo Count */}
          <Text style={styles.statLabel}>
            {indexingStats.total > 0 
              ? `${indexingStats.processed} of ${indexingStats.total} photos` 
              : 'initializing neural pathways...'}
          </Text>
          
          {/* Status Message */}
          {indexingStats.total > 0 && (
            <View style={styles.statusBadge}>
              <PulsingDot />
              <Text style={styles.statusText}>
                {progressPercentage < 0.3 
                  ? 'Analyzing images...' 
                  : progressPercentage < 0.7 
                  ? 'Building connections...' 
                  : progressPercentage < 1 
                  ? 'Finalizing index...' 
                  : 'Complete! ✨'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF8F3', '#FFEDE3', '#FFE4D6']}
        style={StyleSheet.absoluteFill}
      />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  contentCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    height: spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 8,
    marginBottom: spacing.m,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.text.secondary,
    lineHeight: 28,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 2,
    marginBottom: spacing.s,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
  },
  minimalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    alignSelf: 'flex-start',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.warm.primary,
  },
  minimalButtonText: {
    color: colors.warm.accent,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  optionsContainer: {
    gap: spacing.m,
    marginTop: spacing.l,
  },
  minimalOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    padding: spacing.m,
    borderRadius: radius.l,
    gap: spacing.m,
    borderWidth: 1,
    borderColor: colors.warm.tertiary,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warm.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  optionDesc: {
    color: colors.text.tertiary,
    fontSize: 13,
    marginTop: 2,
  },
  particleContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  particlesWrapper: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.warm.primary,
    shadowColor: colors.warm.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 10,
  },
  statsContainer: {
    alignItems: 'center',
    marginTop: spacing.l,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.m,
  },
  percentageNumber: {
    fontSize: 72,
    fontWeight: '200',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  percentageSymbol: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.text.secondary,
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: spacing.s,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.l,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.warm.tertiary,
    borderRadius: radius.l,
    gap: spacing.s,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warm.accent,
    shadowColor: colors.warm.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  statusText: {
    fontSize: 13,
    color: colors.warm.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
