import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import ScreenLayout from '../components/ScreenLayout';
import editDiffService from '../services/editDiffService';
import { colors, spacing, radius } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = SCREEN_WIDTH - 40;

interface PathData {
  path: string;
  color: string;
  width: number;
}

export default function CreativeScreen() {
  const [processing, setProcessing] = useState(false);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [drawColor, setDrawColor] = useState('#FF6B4A');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [mode, setMode] = useState<'select' | 'draw' | 'result'>('select');
  
  const pathX = useSharedValue(0);
  const pathY = useSharedValue(0);

  const handleSelectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Need photo access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setBaseImage(result.assets[0].uri);
      setMode('draw');
      setPaths([]);
    }
  };

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      pathX.value = event.x;
      pathY.value = event.y;
      setCurrentPath(`M${event.x},${event.y}`);
    })
    .onUpdate((event) => {
      const newSegment = ` L${event.x},${event.y}`;
      setCurrentPath((prev) => prev + newSegment);
      pathX.value = event.x;
      pathY.value = event.y;
    })
    .onEnd(() => {
      if (currentPath) {
        setPaths((prev) => [...prev, { path: currentPath, color: drawColor, width: strokeWidth }]);
        setCurrentPath('');
      }
    });

  const handleClearCanvas = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleAnalyzeDiff = async () => {
    if (!baseImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    Alert.alert(
      'Analyze Edit',
      'This will compare the original with your edits and generate AI instructions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Analyze',
          onPress: async () => {
            setProcessing(true);
            try {
              // In a real implementation, we'd capture the canvas as an image
              // For now, we'll just use the base image twice as a demo
              const result = await editDiffService.diffAndApply(baseImage, baseImage);
              
              Alert.alert(
                'Analysis Complete',
                `Instructions:\n${result.instructions}\n\nResult: ${result.result.summary}`,
                [{ text: 'OK' }]
              );
              setMode('result');
            } catch (error) {
              console.error('Error in edit diff:', error);
              Alert.alert('Error', 'Failed to analyze edits');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleReset = () => {
    setBaseImage(null);
    setPaths([]);
    setCurrentPath('');
    setMode('select');
  };

  if (mode === 'select') {
    return (
      <ScreenLayout>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Drawing Tools</Text>
            <Text style={styles.subtitle}>Edit & Analyze with AI</Text>
          </View>

          <BlurView intensity={20} style={styles.glassCard}>
            <View style={styles.iconPlaceholder}>
              <Ionicons name="brush" size={40} color={colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>Draw on Photos</Text>
            <Text style={styles.cardDescription}>
              Select a photo, draw your edits, and let AI analyze the changes.
            </Text>
            <TouchableOpacity 
              style={styles.button}
              onPress={handleSelectImage}
            >
              <Text style={styles.buttonText}>Select Photo</Text>
            </TouchableOpacity>
          </BlurView>

          <View style={styles.toolsContainer}>
            <BlurView intensity={20} style={styles.toolCard}>
              <Text style={styles.toolIcon}>✏️</Text>
              <Text style={styles.toolName}>Draw</Text>
            </BlurView>
            <BlurView intensity={20} style={styles.toolCard}>
              <Text style={styles.toolIcon}>🎨</Text>
              <Text style={styles.toolName}>Colors</Text>
            </BlurView>
            <BlurView intensity={20} style={styles.toolCard}>
              <Text style={styles.toolIcon}>🤖</Text>
              <Text style={styles.toolName}>AI Diff</Text>
            </BlurView>
          </View>
        </View>
      </ScreenLayout>
    );
  }

  if (mode === 'draw') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScreenLayout>
          <View style={styles.drawContainer}>
            {/* Header Controls */}
            <View style={styles.drawHeader}>
              <TouchableOpacity style={styles.headerButton} onPress={handleReset}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.drawTitle}>Draw Your Edits</Text>
              <TouchableOpacity style={styles.headerButton} onPress={handleAnalyzeDiff}>
                <Ionicons name="checkmark" size={24} color={colors.warm.accent} />
              </TouchableOpacity>
            </View>

            {/* Drawing Canvas */}
            <View style={styles.canvasContainer}>
              {baseImage && (
                <Image source={{ uri: baseImage }} style={styles.baseImage} resizeMode="contain" />
              )}
              
              <GestureDetector gesture={panGesture}>
                <View style={styles.drawingArea}>
                  <Svg style={StyleSheet.absoluteFill}>
                    {paths.map((pathData, index) => (
                      <Path
                        key={index}
                        d={pathData.path}
                        stroke={pathData.color}
                        strokeWidth={pathData.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {currentPath && (
                      <Path
                        d={currentPath}
                        stroke={drawColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </Svg>
                </View>
              </GestureDetector>
            </View>

            {/* Bottom Toolbar */}
            <BlurView intensity={80} tint="dark" style={styles.toolbar}>
              {/* Color Picker */}
              <View style={styles.colorRow}>
                {['#FF6B4A', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#000000'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      drawColor === color && styles.colorButtonActive
                    ]}
                    onPress={() => setDrawColor(color)}
                  />
                ))}
              </View>

              {/* Stroke Width */}
              <View style={styles.widthRow}>
                {[3, 5, 8, 12].map((width) => (
                  <TouchableOpacity
                    key={width}
                    style={[styles.widthButton, strokeWidth === width && styles.widthButtonActive]}
                    onPress={() => setStrokeWidth(width)}
                  >
                    <View style={[styles.widthPreview, { width: width * 2, height: width * 2 }]} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleUndo}>
                  <Ionicons name="arrow-undo" size={24} color={colors.text.primary} />
                  <Text style={styles.actionText}>Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleClearCanvas}>
                  <Ionicons name="trash-outline" size={24} color={colors.text.primary} />
                  <Text style={styles.actionText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.analyzeButton]} 
                  onPress={handleAnalyzeDiff}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={24} color={colors.neutral.white} />
                      <Text style={styles.actionText}>Analyze</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </ScreenLayout>
      </GestureHandlerRootView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 5,
    textAlign: 'center',
  },
  glassCard: {
    padding: 30,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    marginBottom: 20,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  iconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.warm.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.warm.accent,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: colors.neutral.white,
    fontWeight: '600',
    fontSize: 16,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  toolCard: {
    width: 90,
    height: 90,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.warm.tertiary,
    overflow: 'hidden',
  },
  toolIcon: {
    fontSize: 30,
    marginBottom: 5,
  },
  toolName: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  drawContainer: {
    flex: 1,
  },
  drawHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerButton: {
    padding: 8,
  },
  drawTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  baseImage: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    borderRadius: 12,
  },
  drawingArea: {
    ...StyleSheet.absoluteFillObject,
  },
  toolbar: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: colors.warm.accent,
    transform: [{ scale: 1.2 }],
  },
  widthRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  widthButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.warm.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  widthButtonActive: {
    backgroundColor: colors.warm.secondary,
  },
  widthPreview: {
    backgroundColor: colors.warm.accent,
    borderRadius: 100,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
  },
  analyzeButton: {
    backgroundColor: colors.warm.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  actionText: {
    color: colors.text.primary,
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
});
