import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Share,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, typography, radius, spacing } from '../theme';
import embeddingService from '../services/embeddingService';
import userPreferenceService from '../services/userPreferenceService';
import nanoBananaService from '../services/nanoBananaService';

const { width, height } = Dimensions.get('window');

export default function PhotoDetailScreen({ route, navigation }: any) {
  const { photoId, uri } = route.params;
  const insets = useSafeAreaInsets();
  
  const [infoVisible, setInfoVisible] = useState(false);
  const [aiData, setAiData] = useState<{caption: string | null, city: string | null, time: string | null} | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editedImageUri, setEditedImageUri] = useState<string | null>(null);

  // Preload AI data immediately when screen opens
  const loadAiDetails = useCallback(async () => {
    try {
      setLoadingAi(true);
      const data = await embeddingService.generateCaptionWithContext({ id: photoId, uri });
      setAiData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAi(false);
    }
  }, [photoId, uri]);

  // ✅ PERFORMANCE: Don't auto-load AI data on mount (saves 2-5 seconds)
  // AI data will load when user taps the info button instead
  // useEffect(() => {
  //   loadAiDetails();
  // }, [loadAiDetails]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        url: uri,
        title: 'Shared from MRAE',
      });
    } catch (error) {
      console.error(error);
    }
  }, [uri]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo from your device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await MediaLibrary.deleteAssetsAsync([photoId]);
              await userPreferenceService.markPreference(photoId, 'Dislike');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', 'Could not delete photo');
            }
          }
        }
      ]
    );
  }, [photoId, uri, navigation]);

  const handleApplyEdit = useCallback(async () => {
    if (!editPrompt.trim()) {
      Alert.alert('Error', 'Please enter what you want to edit');
      return;
    }

    setEditLoading(true);
    try {
      const result = await nanoBananaService.editImage({
        imageUri: editedImageUri || uri,
        prompt: editPrompt.trim(),
      });

      if (result.success && result.outputPath) {
        setEditedImageUri(result.outputPath);
        setEditPrompt('');
        Alert.alert('Success', 'Image edited successfully!');
      } else {
        Alert.alert('Edit Info', result.error || 'Image editing is being processed');
      }
    } catch (error: any) {
      console.error('Edit error:', error);
      Alert.alert('Error', error?.message || 'Failed to edit image');
    } finally {
      setEditLoading(false);
    }
  }, [editPrompt, uri, editedImageUri]);


  return (
    <View style={styles.container}>
      {/* Main Image */}
      <ScrollView
        contentContainerStyle={styles.imageContainer}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        centerContent
      >
        <Image
          source={{ uri: editedImageUri || uri }}
          style={styles.image}
          resizeMode="contain"
          onLoadStart={() => setImageLoaded(false)}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
        {!imageLoaded && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        {editedImageUri && (
          <View style={styles.editedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.editedBadgeText}>Edited</Text>
          </View>
        )}
      </ScrollView>

      {/* Header Actions */}
      <View style={[styles.header, { top: insets.top }]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setEditMode(!editMode);
              setInfoVisible(false);
            }}
          >
            <Ionicons name={editMode ? "create" : "create-outline"} size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setInfoVisible(!infoVisible);
              setEditMode(false);
              // If opening info and AI data not loaded yet, trigger load
              if (!infoVisible && !aiData && !loadingAi) {
                loadAiDetails();
              }
            }}
          >
            <Ionicons name={infoVisible ? "information-circle" : "information-circle-outline"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Actions */}
      {!infoVisible && !editMode && (
        <Animated.View entering={FadeInDown} style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.footerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="white" />
            <Text style={styles.footerText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerButton, styles.deleteButton]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <Text style={[styles.footerText, { color: '#FF3B30' }]}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Info Sheet Overlay */}
      {infoVisible && (
        <BlurView intensity={80} tint="dark" style={styles.infoOverlay}>
          <View style={[styles.infoContent, { paddingTop: insets.top + 60 }]}>
            <Text style={styles.infoTitle}>Photo Intelligence</Text>
            
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>CONTEXT</Text>
              {loadingAi ? (
                <ActivityIndicator size="small" color="#fff" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />
              ) : (
                <View>
                  <Text style={styles.infoValue}>
                    <Ionicons name="location-outline" size={14} color={colors.neutral.gray400} /> {aiData?.city || 'Unknown Location'}
                  </Text>
                  <Text style={styles.infoValue}>
                    <Ionicons name="time-outline" size={14} color={colors.neutral.gray400} /> {aiData?.time || 'Unknown Time'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>AI ANALYSIS</Text>
              {loadingAi ? (
                <Text style={styles.loadingText}>Analyzing visual context...</Text>
              ) : (
                <Text style={styles.aiCaption}>
                  "{aiData?.caption || 'No caption available.'}"
                </Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.closeInfoButton}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.closeInfoText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* Edit Panel */}
      {editMode && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editOverlay}
        >
          <BlurView intensity={80} tint="dark" style={styles.editPanel}>
            <View style={[styles.editContent, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={styles.editTitle}>AI Image Edit</Text>
              <Text style={styles.editSubtitle}>Describe what you want to change</Text>

              <TextInput
                style={styles.editInput}
                placeholder="e.g., make it brighter, change the sky to sunset, add more colors..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={editPrompt}
                onChangeText={setEditPrompt}
                multiline
                maxLength={500}
                editable={!editLoading}
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={() => {
                    setEditMode(false);
                    setEditPrompt('');
                  }}
                  disabled={editLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.editButton,
                    styles.applyButton,
                    (!editPrompt.trim() || editLoading) && styles.applyButtonDisabled
                  ]}
                  onPress={handleApplyEdit}
                  disabled={!editPrompt.trim() || editLoading}
                >
                  {editLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.applyButtonText}>Apply Edit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {editedImageUri && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setEditedImageUri(null);
                    setEditPrompt('');
                  }}
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.sunset.accent} />
                  <Text style={styles.resetButtonText}>Reset to Original</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    width: width,
    height: height,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  footerButton: {
    alignItems: 'center',
    gap: 5,
  },
  deleteButton: {
    opacity: 0.9,
  },
  footerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  infoOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  infoContent: {
    flex: 1,
    paddingHorizontal: 30,
  },
  infoTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    marginBottom: 40,
    letterSpacing: 1,
  },
  infoSection: {
    marginBottom: 30,
  },
  infoLabel: {
    color: colors.sunset.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  infoValue: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 8,
  },
  aiCaption: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    lineHeight: 28,
    fontStyle: 'italic',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  closeInfoButton: {
    marginTop: 'auto',
    marginBottom: 50,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  closeInfoText: {
    color: '#fff',
    fontWeight: '600',
  },
  editedBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,200,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  editPanel: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  editContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  editTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  editSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: colors.warm.accent,
    flexDirection: 'row',
    gap: 8,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
  },
  resetButtonText: {
    color: colors.sunset.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});

