import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import ScreenLayout from '../components/ScreenLayout';
import nanoBananaService from '../services/nanoBananaService';
import { colors, spacing, radius } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DrawingPath {
  path: string;
  color: string;
  width: number;
}

const PRESET_EDITS = [
  { id: 'remove-people', label: 'Remove People Behind', prompt: 'remove all people in the background' },
  { id: 'sunny', label: 'Make Sunny', prompt: 'change the weather to sunny with blue sky' },
  { id: 'sunset', label: 'Golden Hour', prompt: 'change lighting to golden hour sunset' },
  { id: 'rain', label: 'Add Rain', prompt: 'add rain and wet surfaces' },
  { id: 'night', label: 'Make Night', prompt: 'change to nighttime with stars' },
  { id: 'winter', label: 'Add Snow', prompt: 'add snow and winter atmosphere' },
];

export default function CreativeScreen() {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<'select' | 'edit' | 'result'>('select');
  const [editMode, setEditMode] = useState<'text' | 'draw'>('text');
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [imageLayout, setImageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const isDrawing = useSharedValue(false);

  const handleSelectImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Need photo access to use this feature');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setBaseImage(result.assets[0].uri);
        setEditedImage(null);
        setPaths([]);
        setPrompt('');
        setMode('edit');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleImageLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setImageLayout({ x, y, width, height });
  };

  const addPathToPaths = useCallback((path: string) => {
    setPaths(prev => [...prev, {
      path,
      color: editMode === 'draw' ? '#FF6B4A' : '#4A90E2',
      width: editMode === 'draw' ? 8 : 3,
    }]);
    setCurrentPath('');
  }, [editMode]);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      if (editMode !== 'draw') return;
      isDrawing.value = true;
      startX.value = event.x;
      startY.value = event.y;
      runOnJS(setCurrentPath)(`M${event.x},${event.y}`);
    })
    .onUpdate((event) => {
      if (editMode !== 'draw') return;
      runOnJS((x: number, y: number) => {
        setCurrentPath((prev: string) => prev ? `${prev} L${x},${y}` : `M${x},${y}`);
      })(event.x, event.y);
    })
    .onEnd(() => {
      if (editMode !== 'draw') return;
      isDrawing.value = false;
      if (currentPath) {
        const pathToAdd = currentPath;
        runOnJS(addPathToPaths)(pathToAdd);
      }
      runOnJS(setCurrentPath)('');
    });

  const handleApplyEdit = useCallback(async (editPrompt?: string) => {
    if (!baseImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    const finalPrompt = editPrompt || prompt.trim();
    if (!finalPrompt) {
      Alert.alert('Error', 'Please enter what you want to edit or select a preset');
      return;
    }

    setProcessing(true);
    try {
      // For draw mode, we need to send both the original image and the drawn paths
      // The API should interpret the drawing as a visual guide
      const result = await nanoBananaService.editImage({
        imageUri: baseImage,
        prompt: editMode === 'draw'
          ? `${finalPrompt}. Use the drawn sketch as a visual guide for the edit.`
          : finalPrompt,
        // If there are paths, we could convert them to a mask image
        // For now, just send the prompt
      });

      if (result.success && result.outputPath) {
        setEditedImage(result.outputPath);
        setMode('result');
      } else {
        Alert.alert('Error', result.error || 'Failed to edit image');
      }
    } catch (error: any) {
      console.error('Edit error:', error);
      Alert.alert('Error', error?.message || 'Failed to edit image');
    } finally {
      setProcessing(false);
    }
  }, [baseImage, prompt, editMode]);

  const handlePresetEdit = (preset: typeof PRESET_EDITS[0]) => {
    setPrompt(preset.prompt);
    setTimeout(() => handleApplyEdit(preset.prompt), 100);
  };

  const handleReset = () => {
    setBaseImage(null);
    setEditedImage(null);
    setPaths([]);
    setCurrentPath('');
    setPrompt('');
    setMode('select');
  };

  const handleClearDrawing = () => {
    setPaths([]);
    setCurrentPath('');
  };

  if (mode === 'select') {
    return (
      <ScreenLayout>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Create</Text>
            <Text style={styles.subtitle}>AI-powered photo editing</Text>
          </View>

          <BlurView intensity={20} style={styles.glassCard}>
            <View style={styles.iconPlaceholder}>
              <Ionicons name="create" size={40} color={colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>Edit with AI</Text>
            <Text style={styles.cardDescription}>
              Describe edits in natural language, draw what you want, or use quick presets
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={handleSelectImage}
            >
              <Text style={styles.buttonText}>Select Photo</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </ScreenLayout>
    );
  }

  if (mode === 'result' && editedImage) {
    return (
      <ScreenLayout>
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <TouchableOpacity style={styles.headerButton} onPress={handleReset}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.resultTitle}>Result</Text>
            <View style={{ width: 24 }} />
          </View>

          <Image
            source={{ uri: editedImage }}
            style={styles.resultImage}
            resizeMode="contain"
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              Alert.alert('Success', 'Image edited!');
              handleReset();
            }}
          >
            <Text style={styles.saveButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenLayout>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editContainer}>
            {/* Header */}
            <View style={styles.editHeader}>
              <TouchableOpacity style={styles.headerButton} onPress={handleReset}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Create</Text>
              {editMode === 'draw' && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleClearDrawing}
                  disabled={paths.length === 0}
                >
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color={paths.length > 0 ? colors.warm.accent : colors.text.tertiary}
                  />
                </TouchableOpacity>
              )}
              {editMode === 'text' && <View style={{ width: 24 }} />}
            </View>

            {/* Mode Toggle */}
            <View style={styles.modeToggleContainer}>
              <TouchableOpacity
                style={[styles.modeToggleButton, editMode === 'text' && styles.modeToggleButtonActive]}
                onPress={() => setEditMode('text')}
              >
                <Ionicons
                  name="text"
                  size={18}
                  color={editMode === 'text' ? '#fff' : colors.text.secondary}
                />
                <Text style={[styles.modeToggleText, editMode === 'text' && styles.modeToggleTextActive]}>
                  Natural Language
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeToggleButton, editMode === 'draw' && styles.modeToggleButtonActive]}
                onPress={() => setEditMode('draw')}
              >
                <Ionicons
                  name="brush"
                  size={18}
                  color={editMode === 'draw' ? '#fff' : colors.text.secondary}
                />
                <Text style={[styles.modeToggleText, editMode === 'draw' && styles.modeToggleTextActive]}>
                  Draw to Edit
                </Text>
              </TouchableOpacity>
            </View>

            {/* Image with Drawing */}
            <View style={styles.imageContainer}>
              {baseImage && (
                <GestureDetector gesture={editMode === 'draw' ? panGesture : Gesture.Pan()}>
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: baseImage }}
                      style={styles.baseImage}
                      resizeMode="contain"
                      onLayout={handleImageLayout}
                    />

                    {/* Drawing Overlay */}
                    {editMode === 'draw' && (
                      <Svg style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
                            stroke="#FF6B4A"
                            strokeWidth={8}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                      </Svg>
                    )}
                  </View>
                </GestureDetector>
              )}
            </View>

            {/* Controls */}
            <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false}>
              {/* Instructions */}
              <Text style={styles.instructionText}>
                {editMode === 'text'
                  ? 'Describe what you want to edit or choose a preset below'
                  : 'Draw what you want to add, then describe it below'}
              </Text>

              {/* Text Input */}
              {editMode === 'text' && (
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., make the sky more blue, add flowers..."
                  placeholderTextColor={colors.text.tertiary}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  numberOfLines={2}
                />
              )}

              {editMode === 'draw' && (
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., a sun, birds flying, mountains..."
                  placeholderTextColor={colors.text.tertiary}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  numberOfLines={2}
                />
              )}

              {/* Presets */}
              <Text style={styles.presetsTitle}>Quick Presets</Text>
              <View style={styles.presetsContainer}>
                {PRESET_EDITS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={styles.presetButton}
                    onPress={() => handlePresetEdit(preset)}
                    disabled={processing}
                  >
                    <Text style={styles.presetButtonText}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Apply Button */}
              <TouchableOpacity
                style={[
                  styles.applyButton,
                  (!prompt.trim() || processing) && styles.applyButtonDisabled
                ]}
                onPress={() => handleApplyEdit()}
                disabled={!prompt.trim() || processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                    <Text style={styles.applyButtonText}>Apply Edit</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </ScreenLayout>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.l,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  glassCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  iconPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.warm.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.s,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.l,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.warm.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    borderRadius: radius.l,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  editContainer: {
    flex: 1,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: 40,
    paddingBottom: spacing.m,
  },
  headerButton: {
    padding: spacing.xs,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    gap: spacing.s,
    marginBottom: spacing.m,
  },
  modeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.s,
    borderRadius: radius.m,
    backgroundColor: colors.neutral.gray200,
  },
  modeToggleButtonActive: {
    backgroundColor: colors.warm.accent,
  },
  modeToggleText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  modeToggleTextActive: {
    color: '#fff',
  },
  imageContainer: {
    flex: 1,
    marginHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.m,
  },
  controlsContainer: {
    maxHeight: 320,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
  },
  instructionText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.m,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.m,
    padding: spacing.m,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
  },
  presetsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.s,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.m,
  },
  presetButton: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.m,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.warm.tertiary,
  },
  presetButtonText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.warm.accent,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: 40,
    paddingBottom: spacing.m,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  resultImage: {
    flex: 1,
    width: '100%',
    marginHorizontal: spacing.l,
    borderRadius: radius.m,
  },
  saveButton: {
    margin: spacing.l,
    backgroundColor: colors.warm.accent,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
