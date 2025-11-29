import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import { useGoogleAuth } from '../services/authService';
import photoService from '../services/photoService';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence, 
  Easing,
  FadeInDown,
  FadeOut
} from 'react-native-reanimated';

interface OnboardingProps {
  onComplete: () => void;
}

const LoadingNode = ({ delay, x, y }: { delay: number, x: number, y: number }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),
        withTiming(1, { duration: 500 }),
        withTiming(0.3, { duration: 500 })
      ),
      -1,
      true
    );
    scale.value = withRepeat(
        withSequence(
            withTiming(0, { duration: delay }),
            withTiming(1.2, { duration: 500 }),
            withTiming(1, { duration: 500 })
        ),
        -1,
        true
    )
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    left: x,
    top: y,
  }));

  return <Animated.View style={[styles.node, style]} />;
};

export default function NeuralOnboarding({ onComplete }: OnboardingProps) {
  const { promptAsync, accessToken } = useGoogleAuth();
  const [step, setStep] = React.useState<'welcome' | 'connect' | 'indexing'>('welcome');
  const [indexingStats, setIndexingStats] = React.useState({ processed: 0, total: 0 });

  // Mock indexing simulation
  useEffect(() => {
    if (step === 'indexing') {
      const interval = setInterval(() => {
        setIndexingStats(prev => {
          if (prev.processed >= 340) {
            clearInterval(interval);
            setTimeout(onComplete, 1500); // Finish after delay
            return prev;
          }
          return { processed: prev.processed + 5, total: 340 };
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleConnectLocal = async () => {
    const granted = await photoService.requestPermissions();
    if (granted) {
      setStep('indexing');
    }
  };

  const handleConnectGoogle = async () => {
    await promptAsync();
    // Wait for effect in authService to set token, then proceed
    // For UX, we'll just jump to indexing if prompt returns (in real app verify token)
    setStep('indexing');
  };

  if (step === 'welcome') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.title}>
            Awaken Your{'\n'}External{'\n'}Memory
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(600).springify()} style={styles.subtitle}>
            MRAE connects your scattered photos into a single, intelligent brain.
          </Animated.Text>
        </View>
        <Animated.View entering={FadeInDown.delay(900)} style={styles.footer}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('connect')}>
            <Text style={styles.primaryButtonText}>Begin Initiation</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (step === 'connect') {
    return (
      <View style={styles.container}>
        <Animated.Text entering={FadeInDown} style={styles.titleSmall}>Connect Sources</Animated.Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionCard} onPress={handleConnectGoogle}>
            <Ionicons name="logo-google" size={32} color={colors.neutral.black} />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Google Photos</Text>
              <Text style={styles.optionDesc}>Sync your cloud library</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={colors.neutral.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={handleConnectLocal}>
            <Ionicons name="images" size={32} color={colors.neutral.black} />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Local Gallery</Text>
              <Text style={styles.optionDesc}>Scan on-device photos</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={colors.neutral.gray400} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Neural Visualization */}
      <View style={styles.neuralNet}>
        <LoadingNode delay={0} x={100} y={100} />
        <LoadingNode delay={200} x={200} y={150} />
        <LoadingNode delay={400} x={150} y={250} />
        <LoadingNode delay={600} x={50} y={200} />
        <LoadingNode delay={800} x={250} y={300} />
      </View>

      <View style={styles.contentCenter}>
        <Text style={styles.statNumber}>{indexingStats.processed}</Text>
        <Text style={styles.statLabel}>Memories Linked</Text>
        <Text style={styles.loadingStatus}>analyzing contexts...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sunset.dark,
    padding: spacing.l,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  contentCenter: {
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    ...typography.header.xl,
    color: colors.neutral.white,
    fontSize: 42,
    lineHeight: 48,
    marginBottom: spacing.m,
  },
  titleSmall: {
    ...typography.header.l,
    color: colors.neutral.white,
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
  },
  subtitle: {
    ...typography.body.l,
    color: colors.neutral.gray400,
    maxWidth: '80%',
  },
  footer: {
    paddingBottom: spacing.xxl,
  },
  primaryButton: {
    backgroundColor: colors.sunset.accent,
    paddingVertical: spacing.m,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.neutral.white,
    ...typography.body.l,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: spacing.m,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    padding: spacing.l,
    borderRadius: radius.l,
    gap: spacing.m,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.body.l,
    fontWeight: '600',
    color: colors.neutral.black,
  },
  optionDesc: {
    ...typography.body.s,
    color: colors.neutral.gray600,
  },
  neuralNet: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  node: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sunset.accent,
    shadowColor: colors.sunset.accent,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  statNumber: {
    ...typography.header.xl,
    fontSize: 64,
    color: colors.neutral.white,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.body.l,
    color: colors.neutral.gray400,
    marginBottom: spacing.s,
  },
  loadingStatus: {
    ...typography.caption,
    color: colors.sunset.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

