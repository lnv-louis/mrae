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
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Audio from 'expo-av';
import { Audio as AudioRecorder } from 'expo-av';

import ScreenLayout from '../components/ScreenLayout';
import nanoBananaService from '../services/nanoBananaService';
import transcriptionService from '../services/transcriptionService';
import { colors, spacing, radius } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SelectionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawingPath {
  path: string;
  color: string;
  width: number;
}

export default function CreativeScreen() {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<'select' | 'edit' | 'result'>('select');
  const [selectionMode, setSelectionMode] = useState<'pencil' | 'circle' | 'rect'>('pencil');
  const [selection, setSelection] = useState<SelectionRegion | null>(null);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<AudioRecorder.Recording | null>(null);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice'); // Voice-first like Siri
  
  const imageRef = useRef<Image>(null);
  const [imageLayout, setImageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const currentX = useSharedValue(0);
  const currentY = useSharedValue(0);
  const isDrawing = useSharedValue(false);

  const handleSelectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Need photo access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled) {
      setBaseImage(result.assets[0].uri);
      setEditedImage(null);
      setSelection(null);
      setPaths([]);
      setPrompt('');
      setMode('edit');
    }
  };

  const handleImageLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setImageLayout({ x, y, width, height });
  };

  const addPathToPaths = useCallback((path: string) => {
    setPaths(prev => [...prev, { 
      path: path, 
      color: '#FF6B4A', 
      width: 3 
    }]);
    setCurrentPath('');
  }, []);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      isDrawing.value = true;
      startX.value = event.x;
      startY.value = event.y;
      currentX.value = event.x;
      currentY.value = event.y;
      
      if (selectionMode === 'pencil') {
        // Start freehand drawing path
        runOnJS(setCurrentPath)(`M${event.x},${event.y}`);
      } else if (selectionMode === 'circle') {
        runOnJS(setCurrentPath)(`M${event.x},${event.y}`);
      }
    })
    .onUpdate((event) => {
      currentX.value = event.x;
      currentY.value = event.y;
      
      if (selectionMode === 'pencil') {
        // Continue freehand drawing - add line to current path
        runOnJS((x: number, y: number) => {
          setCurrentPath((prev: string) => prev ? `${prev} L${x},${y}` : `M${x},${y}`);
        })(event.x, event.y);
      } else if (selectionMode === 'circle') {
        const radius = Math.sqrt(
          Math.pow(event.x - startX.value, 2) + Math.pow(event.y - startY.value, 2)
        );
        const path = `M${startX.value},${startY.value} m-${radius},0 a${radius},${radius} 0 1,0 ${radius * 2},0 a${radius},${radius} 0 1,0 -${radius * 2},0`;
        runOnJS(setCurrentPath)(path);
      }
    })
    .onEnd(() => {
      isDrawing.value = false;
      
      if (selectionMode === 'pencil') {
        // For pencil mode, calculate bounding box from the drawn path
        // Store the path and calculate region from all paths
        if (currentPath) {
          const pathToAdd = currentPath;
          runOnJS(addPathToPaths)(pathToAdd);
          
          // Calculate bounding box from all paths including the new one
          const allPaths = [...paths, { path: pathToAdd, color: '#FF6B4A', width: 3 }];
          const points: { x: number; y: number }[] = [];
          
          // Extract points from paths (simplified - in production, parse SVG path properly)
          allPaths.forEach(p => {
            const matches = p.path.matchAll(/([ML])\s*([\d.]+),([\d.]+)/g);
            for (const match of matches) {
              points.push({ x: parseFloat(match[2]), y: parseFloat(match[3]) });
            }
          });
          
          if (points.length > 0 && imageLayout.width > 0 && imageLayout.height > 0) {
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.max(0, Math.min(...xs) - imageLayout.x);
            const minY = Math.max(0, Math.min(...ys) - imageLayout.y);
            const maxX = Math.min(imageLayout.width, Math.max(...xs) - imageLayout.x);
            const maxY = Math.min(imageLayout.height, Math.max(...ys) - imageLayout.y);
            
            const region: SelectionRegion = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };
            
            if (region.width > 10 && region.height > 10) {
              runOnJS(setSelection)(region);
            }
          }
        }
      } else {
        // Calculate selection region in image coordinates for circle/rect
        const minX = Math.min(startX.value, currentX.value);
        const minY = Math.min(startY.value, currentY.value);
        const maxX = Math.max(startX.value, currentX.value);
        const maxY = Math.max(startY.value, currentY.value);
        
        // Convert screen coordinates to image coordinates
        if (imageLayout.width > 0 && imageLayout.height > 0) {
          const region: SelectionRegion = {
            x: Math.max(0, minX - imageLayout.x),
            y: Math.max(0, minY - imageLayout.y),
            width: Math.min(imageLayout.width, maxX - minX),
            height: Math.min(imageLayout.height, maxY - minY),
          };
          
          if (region.width > 10 && region.height > 10) {
            runOnJS(setSelection)(region);
          }
        }
      }
      
      if (currentPath && selectionMode !== 'pencil') {
        const pathToAdd = currentPath;
        runOnJS(addPathToPaths)(pathToAdd);
      }
      
      runOnJS(setCurrentPath)('');
    });

  const selectionStyle = useAnimatedStyle(() => {
    if (!isDrawing.value) return { opacity: 0 };
    
    const width = Math.abs(currentX.value - startX.value);
    const height = Math.abs(currentY.value - startY.value);
    const x = Math.min(startX.value, currentX.value);
    const y = Math.min(startY.value, currentY.value);
    
    return {
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      opacity: 0.3,
    };
  });

  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow microphone access');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  }, []);

  const handleApplyEdit = useCallback(async () => {
    if (!baseImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt describing what you want to edit');
      return;
    }

    if (!selection) {
      Alert.alert('Error', 'Please select an area on the image to edit');
      return;
    }

    setProcessing(true);
    try {
      const result = await nanoBananaService.editImage({
        imageUri: baseImage,
        prompt: prompt.trim(),
        region: selection,
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
  }, [baseImage, prompt, selection]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      if (!uri) {
        Alert.alert('Error', 'No audio recorded');
        setRecording(null);
        return;
      }

      setProcessing(true);
      const transcription = await transcriptionService.transcribe(uri);
      const transcribedText = transcription.response || '';
      
      if (transcribedText.trim()) {
        setPrompt(transcribedText);
        // Mark that we should auto-apply after transcription (Siri-like behavior)
        shouldAutoApply.current = true;
      } else {
        Alert.alert('Error', 'Could not transcribe audio');
      }
      
      setRecording(null);
      setProcessing(false);
    } catch (error) {
      console.error('Error processing audio:', error);
      Alert.alert('Error', 'Failed to process audio');
      setIsRecording(false);
      setRecording(null);
      setProcessing(false);
    }
  }, [recording]);

  // Auto-apply edit when prompt is set via voice (Siri-like)
  const shouldAutoApply = React.useRef(false);
  
  React.useEffect(() => {
    if (prompt.trim() && selection && baseImage && inputMode === 'voice' && !processing && !isRecording && shouldAutoApply.current) {
      // Small delay to show the transcribed text before applying
      const timer = setTimeout(() => {
        handleApplyEdit();
        shouldAutoApply.current = false;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [prompt, selection, baseImage, inputMode, processing, isRecording, handleApplyEdit]);

  const handleReset = () => {
    setBaseImage(null);
    setEditedImage(null);
    setSelection(null);
    setPaths([]);
    setCurrentPath('');
    setPrompt('');
    setMode('select');
  };

  const handleClearSelection = () => {
    setSelection(null);
    setPaths([]);
    setCurrentPath('');
  };

  if (mode === 'select') {
    return (
      <ScreenLayout>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>AI Editor</Text>
            <Text style={styles.subtitle}>Samsung AI-style Intelligent Editing</Text>
          </View>

          <BlurView intensity={20} style={styles.glassCard}>
            <View style={styles.iconPlaceholder}>
              <Ionicons name="sparkles" size={40} color={colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>Edit Photos with AI</Text>
            <Text style={styles.cardDescription}>
              Select an area on your photo, describe what you want to change, and let AI do the magic.
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
            <Text style={styles.resultTitle}>Edited Result</Text>
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
              Alert.alert('Success', 'Image edited successfully!');
              handleReset();
            }}
          >
            <Text style={styles.saveButtonText}>Save & Continue</Text>
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
              <Text style={styles.editTitle}>AI Editor</Text>
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={handleClearSelection}
                disabled={!selection}
              >
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={selection ? colors.warm.accent : colors.text.tertiary} 
                />
              </TouchableOpacity>
            </View>

            {/* Selection Mode Toggle */}
            <View style={styles.selectionModeContainer}>
              <Text style={styles.selectionModeLabel}>Selection Tool:</Text>
              <View style={styles.selectionModeButtons}>
                <TouchableOpacity
                  style={[
                    styles.selectionModeButton,
                    selectionMode === 'pencil' && styles.selectionModeButtonActive
                  ]}
                  onPress={() => setSelectionMode('pencil')}
                >
                  <Ionicons 
                    name="pencil" 
                    size={18} 
                    color={selectionMode === 'pencil' ? '#fff' : colors.text.secondary} 
                  />
                  <Text style={[
                    styles.selectionModeButtonText,
                    selectionMode === 'pencil' && styles.selectionModeButtonTextActive
                  ]}>
                    Pencil
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectionModeButton,
                    selectionMode === 'circle' && styles.selectionModeButtonActive
                  ]}
                  onPress={() => setSelectionMode('circle')}
                >
                  <Ionicons 
                    name="ellipse-outline" 
                    size={18} 
                    color={selectionMode === 'circle' ? '#fff' : colors.text.secondary} 
                  />
                  <Text style={[
                    styles.selectionModeButtonText,
                    selectionMode === 'circle' && styles.selectionModeButtonTextActive
                  ]}>
                    Circle
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectionModeButton,
                    selectionMode === 'rect' && styles.selectionModeButtonActive
                  ]}
                  onPress={() => setSelectionMode('rect')}
                >
                  <Ionicons 
                    name="square-outline" 
                    size={18} 
                    color={selectionMode === 'rect' ? '#fff' : colors.text.secondary} 
                  />
                  <Text style={[
                    styles.selectionModeButtonText,
                    selectionMode === 'rect' && styles.selectionModeButtonTextActive
                  ]}>
                    Rect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Image with Selection */}
            <View style={styles.imageContainer}>
              {baseImage && (
                <GestureDetector gesture={panGesture}>
                  <View style={styles.imageWrapper}>
                    <Image 
                      ref={imageRef}
                      source={{ uri: baseImage }} 
                      style={styles.baseImage}
                      resizeMode="contain"
                      onLayout={handleImageLayout}
                    />
                    
                    {/* Selection Overlay */}
                    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
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
                          strokeWidth={3}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </Svg>
                    
                    {selection && imageLayout.width > 0 && (
                      <View 
                        style={[
                          styles.selectionBox,
                          {
                            left: imageLayout.x + selection.x,
                            top: imageLayout.y + selection.y,
                            width: selection.width,
                            height: selection.height,
                          }
                        ]}
                      />
                    )}
                  </View>
                </GestureDetector>
              )}
            </View>

            {/* Prompt Input - Voice-first like Siri */}
            <BlurView intensity={80} tint="light" style={styles.promptContainer}>
              <View style={styles.promptHeader}>
                <View style={styles.promptHeaderRow}>
                  <Text style={styles.promptLabel}>
                    {inputMode === 'voice' ? '🎤 Voice Command' : '✏️ Text Prompt'}
                  </Text>
                  <TouchableOpacity
                    style={styles.modeToggle}
                    onPress={() => setInputMode(inputMode === 'voice' ? 'text' : 'voice')}
                  >
                    <Ionicons 
                      name={inputMode === 'voice' ? 'text' : 'mic'} 
                      size={18} 
                      color={colors.warm.accent} 
                    />
                    <Text style={styles.modeToggleText}>
                      {inputMode === 'voice' ? 'Text' : 'Voice'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {selection && (
                  <Text style={styles.selectionInfo}>
                    Area selected: {Math.round(selection.width)}×{Math.round(selection.height)}px
                  </Text>
                )}
              </View>
              
              {inputMode === 'voice' ? (
                // Voice-first mode (Siri-like)
                <View style={styles.voiceModeContainer}>
                  {prompt ? (
                    <View style={styles.transcribedTextContainer}>
                      <Ionicons name="mic" size={16} color={colors.text.secondary} />
                      <Text style={styles.transcribedText}>{prompt}</Text>
                      <TouchableOpacity
                        onPress={() => setPrompt('')}
                        style={styles.clearPromptButton}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.voicePromptPlaceholder}>
                      <Ionicons name="mic-outline" size={32} color={colors.text.tertiary} />
                      <Text style={styles.voicePromptText}>
                        {selection 
                          ? 'Tap mic to describe your edit' 
                          : 'Select an area first, then tap mic'}
                      </Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={[
                      styles.voiceButtonLarge,
                      isRecording && styles.voiceButtonLargeActive,
                      (!selection || processing) && styles.voiceButtonLargeDisabled
                    ]}
                    onPress={isRecording ? stopRecording : startRecording}
                    disabled={!selection || processing}
                  >
                    {isRecording ? (
                      <>
                        <View style={styles.recordingIndicatorLarge} />
                        <Text style={styles.recordingText}>Recording... Tap to stop</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="mic" size={32} color="#fff" />
                        <Text style={styles.voiceButtonText}>
                          {prompt ? 'Re-record' : 'Start Recording'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  {prompt && selection && (
                    <TouchableOpacity
                      style={[
                        styles.applyButton,
                        processing && styles.applyButtonDisabled
                      ]}
                      onPress={handleApplyEdit}
                      disabled={processing}
                    >
                      {processing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#fff" />
                          <Text style={styles.applyButtonText}>Apply AI Edit</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                // Text input mode (fallback)
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.promptInput}
                    placeholder="e.g., make the sky more blue, remove the person, add flowers..."
                    placeholderTextColor={colors.text.tertiary}
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
                    onPress={isRecording ? stopRecording : startRecording}
                    disabled={processing}
                  >
                    {isRecording ? (
                      <View style={styles.recordingIndicator} />
                    ) : (
                      <Ionicons name="mic" size={24} color={colors.text.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {inputMode === 'text' && (
                <TouchableOpacity
                  style={[
                    styles.applyButton,
                    (!prompt.trim() || !selection || processing) && styles.applyButtonDisabled
                  ]}
                  onPress={handleApplyEdit}
                  disabled={!prompt.trim() || !selection || processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.applyButtonText}>Apply AI Edit</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </ScreenLayout>
    </GestureHandlerRootView>
  );
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
  editContainer: {
    flex: 1,
  },
  editHeader: {
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
  editTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
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
    borderRadius: 12,
  },
  selectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FF6B4A',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
  },
  promptContainer: {
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
  promptHeader: {
    marginBottom: 12,
  },
  promptLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  selectionInfo: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 15,
  },
  promptInput: {
    flex: 1,
    minHeight: 80,
    backgroundColor: colors.warm.tertiary,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  voiceButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.warm.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#FF3B30',
  },
  recordingIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.warm.accent,
    paddingVertical: 14,
    borderRadius: 12,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  resultImage: {
    flex: 1,
    width: '100%',
    marginHorizontal: 20,
    borderRadius: 12,
  },
  saveButton: {
    margin: 20,
    backgroundColor: colors.warm.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionModeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.warm.tertiary,
  },
  selectionModeLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  selectionModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.warm.tertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectionModeButtonActive: {
    backgroundColor: colors.warm.accent,
    borderColor: colors.warm.accent,
  },
  selectionModeButtonText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  selectionModeButtonTextActive: {
    color: '#fff',
  },
  promptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.warm.tertiary,
  },
  modeToggleText: {
    fontSize: 12,
    color: colors.warm.accent,
    fontWeight: '600',
  },
  voiceModeContainer: {
    gap: 12,
  },
  transcribedTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warm.tertiary,
    padding: 12,
    borderRadius: 12,
    minHeight: 60,
  },
  transcribedText: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    fontStyle: 'italic',
  },
  clearPromptButton: {
    padding: 4,
  },
  voicePromptPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.warm.tertiary,
    borderRadius: 12,
    minHeight: 120,
  },
  voicePromptText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  voiceButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.warm.accent,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 64,
  },
  voiceButtonLargeActive: {
    backgroundColor: '#FF3B30',
  },
  voiceButtonLargeDisabled: {
    opacity: 0.5,
  },
  recordingIndicatorLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
