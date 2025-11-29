import React, { useEffect, useState, useMemo } from 'react';
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
  withSequence, 
  FadeInDown,
  interpolate,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: () => void;
}

// Pulsing status dot
const PulsingDot = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.5, { duration: 1000 }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000 }),
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

// Single elegant particle
const ElegantParticle = ({ 
  x,
  y,
  size,
  delay,
  duration,
  amplitude,
  color,
}: { 
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  amplitude: number;
  color: string;
}) => {
  const translateX = useSharedValue(x);
  const translateY = useSharedValue(y);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Gentle sine wave motion
    translateX.value = withDelay(
      delay,
      withRepeat(
      withSequence(
          withTiming(x + amplitude, { duration: duration / 2 }),
          withTiming(x - amplitude, { duration: duration / 2 })
      ),
      -1,
      true
      )
    );

    // Float vertically
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(y - 50, { duration }),
        -1,
        true
      )
    );

    // Fade in/out cycle
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration * 0.2 }),
          withTiming(0.8, { duration: duration * 0.6 }),
          withTiming(0, { duration: duration * 0.2 })
        ),
        -1,
        false
      )
    );

    // Scale pulse
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1500 }),
          withTiming(0.8, { duration: 1500 })
        ),
        -1,
        true
    )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return <Animated.View style={animatedStyle} />;
};

// Particle colors - vibrant warm tones
const PARTICLE_COLORS = [
  '#FF6B4A', // Vibrant coral
  '#FF8A65', // Warm coral
  '#FFAB91', // Light coral
  '#FFD4C4', // Soft peach
  '#FFF0E8', // Cream
  '#FFE0B2', // Light amber
];

// Main particle field - NO CIRCLES, just particles
const ParticleField = ({ progress }: { progress: number }) => {
  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withSpring(progress, {
      damping: 20,
      stiffness: 40,
    });
  }, [progress]);

  // Generate MANY more particles in a flowing pattern
  const particles = useMemo(() => {
    const particleArray = [];
    const layers = 8; // Multiple layers for depth
    const particlesPerLayer = 20;

    for (let layer = 0; layer < layers; layer++) {
      const layerRadius = 30 + layer * 20;
      
      for (let i = 0; i < particlesPerLayer; i++) {
        const angle = (i / particlesPerLayer) * Math.PI * 2;
        const x = Math.cos(angle) * layerRadius;
        const y = Math.sin(angle) * layerRadius * 0.6; // Flatten for perspective
        
        particleArray.push({
          id: `${layer}-${i}`,
          x,
          y,
          size: 1 + Math.random() * 2.5, // Very small particles
          delay: Math.random() * 3000,
          duration: 4000 + Math.random() * 3000,
          amplitude: 5 + Math.random() * 15,
          color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        });
      }
    }

    // Add random floating particles
    for (let i = 0; i < 40; i++) {
      particleArray.push({
        id: `random-${i}`,
        x: (Math.random() - 0.5) * 250,
        y: (Math.random() - 0.5) * 250,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 4000,
        duration: 5000 + Math.random() * 4000,
        amplitude: 3 + Math.random() * 10,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      });
    }

    return particleArray;
  }, []);

  // Animated progress wave effect
  const waveOpacity = useSharedValue(0);

  useEffect(() => {
    waveOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const waveStyle = useAnimatedStyle(() => ({
    opacity: waveOpacity.value * progressValue.value,
    transform: [
      { scale: interpolate(progressValue.value, [0, 1], [0.5, 1.5]) }
    ],
  }));

  return (
    <View style={styles.particleContainer}>
      {/* Progress wave rings */}
      <Animated.View style={[styles.progressWave, waveStyle]} />
      <Animated.View style={[styles.progressWave2, waveStyle]} />
      
      {/* Central subtle glow - NO ugly circles */}
      <View style={styles.centerDot} />
      
      {/* All the particles */}
      {particles.map((particle) => (
        <ElegantParticle key={particle.id} {...particle} />
      ))}
    </View>
  );
};

export default function NeuralOnboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'connect' | 'indexing'>('welcome');
  const [indexingStats, setIndexingStats] = useState({ processed: 0, total: 0 });
  const [currentPhoto, setCurrentPhoto] = useState<string>('');

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
        
        if (progress.processed >= progress.total && progress.total > 0) {
          setTimeout(onComplete, 1500);
        }
      });
    } catch (error) {
      console.error('Indexing error:', error);
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

  return (
      <View style={styles.contentCenter}>
        <ParticleField progress={progressPercentage} />
        
        <View style={styles.statsContainer}>
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
          
          <Text style={styles.statLabel}>
            {indexingStats.total > 0 
              ? `${indexingStats.processed} of ${indexingStats.total} photos` 
              : 'initializing neural pathways...'}
          </Text>
          
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
    marginBottom: spacing.xl,
  },
  // Subtle central dot - NO ugly circles
  centerDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.warm.accent,
    opacity: 0.6,
  },
  // Progress wave rings
  progressWave: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 64, 0.15)',
  },
  progressWave2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 64, 0.1)',
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
