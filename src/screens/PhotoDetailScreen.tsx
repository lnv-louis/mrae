import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, typography, radius, spacing } from '../theme';
import embeddingService from '../services/embeddingService';
import userPreferenceService from '../services/userPreferenceService';

const { width, height } = Dimensions.get('window');

export default function PhotoDetailScreen({ route, navigation }: any) {
  const { photoId, uri } = route.params;
  const insets = useSafeAreaInsets();
  
  const [infoVisible, setInfoVisible] = useState(false);
  const [aiData, setAiData] = useState<{caption: string | null, city: string | null, time: string | null} | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    loadAiDetails();
  }, []);

  const loadAiDetails = async () => {
    try {
      setLoadingAi(true);
      const data = await embeddingService.generateCaptionWithContext({ id: photoId, uri });
      setAiData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        url: uri,
        title: 'Shared from MRAE',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = () => {
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
  };

  const handleLike = async () => {
    await userPreferenceService.markPreference(photoId, 'Like');
    Alert.alert('Marked as Favorite', 'We will show you more photos like this.');
  };

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
          source={{ uri }} 
          style={styles.image} 
          resizeMode="contain"
        />
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
          <TouchableOpacity style={styles.iconButton} onPress={handleLike}>
            <Ionicons name="heart-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setInfoVisible(!infoVisible)}>
            <Ionicons name={infoVisible ? "information-circle" : "information-circle-outline"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Actions */}
      {!infoVisible && (
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
});

