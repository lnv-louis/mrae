import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import RNFS from 'react-native-fs';
import PhotoGrid from '../components/PhotoGrid';
import querySearchService from '../services/querySearchService';
import speechQueryService from '../services/speechQueryService';
import transcriptionService from '../services/transcriptionService';
import storageService from '../utils/storage';
import { PhotoMetadata } from '../types';
import ScreenLayout from '../components/ScreenLayout';
import { colors, spacing, radius } from '../theme';

const { width } = Dimensions.get('window');

// Suggested search queries
const SUGGESTED_QUERIES = [
  'sunset beach',
  'family gathering',
  'food photography',
  'nature landscapes',
  'city architecture',
  'pets playing',
  'travel memories',
  'celebration moments',
];

export default function ExploreScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [resultsPhotos, setResultsPhotos] = useState<PhotoMetadata[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        // Check if recording is still valid before trying to unload
        try {
          const status = recording.getStatusAsync();
          recording.stopAndUnloadAsync().catch((e: any) => {
            // Ignore errors if already unloaded
            if (!e?.message?.includes('already been unloaded')) {
              console.error('Error cleaning up recording:', e);
            }
          });
        } catch (e) {
          // Recording might already be unloaded, ignore
        }
      }
    };
  }, [recording]);

  const loadRecentSearches = useCallback(async () => {
    try {
      const stored = await storageService.get('recentSearches');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  }, []);

  const saveRecentSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    try {
      const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
      setRecentSearches(updated);
      await storageService.set('recentSearches', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  }, [recentSearches]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      setHasSearched(true);
      await saveRecentSearch(query.trim());
      
      const res = await querySearchService.searchByExpandedText(query.trim());
      const photos = res.results.map((r) => ({ 
        id: r.id, 
        uri: r.uri, 
        createdAt: r.timestamp 
      } as PhotoMetadata));
      
      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setMessage(res.message);
      setTranscript('');
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search photos');
    } finally {
      setSearching(false);
    }
  }, [query, saveRecentSearch]);

  const startRecording = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow microphone access to use voice search');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
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

  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      
      // Get URI before unloading
      const uri = recording.getURI();
      
      // Stop and unload recording
      try {
        await recording.stopAndUnloadAsync();
      } catch (unloadError: any) {
        // If already unloaded, continue with URI if available
        if (!unloadError?.message?.includes('already been unloaded')) {
          throw unloadError;
        }
      }
      
      if (!uri) {
        Alert.alert('Error', 'No audio file recorded');
        setRecording(null);
        return;
      }

      // Transcribe audio using STT
      setSearching(true);
      setHasSearched(true);
      
      const transcription = await transcriptionService.transcribe(uri);
      const transcribedText = transcription.response || '';
      
      if (!transcribedText.trim()) {
        Alert.alert('Error', 'Could not transcribe audio. Please try again.');
        setSearching(false);
        return;
      }

      // Use transcribed text for search
      setQuery(transcribedText);
      await saveRecentSearch(transcribedText);
      
      const res = await speechQueryService.searchByAudio(uri);
      const photos = res.results.map((r) => ({ 
        id: r.id, 
        uri: r.uri, 
        createdAt: r.timestamp 
      } as PhotoMetadata));
      
      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setTranscript(res.transcript);
      setMessage(res.message);
      
      // Cleanup
      setRecording(null);
      try {
        await RNFS.unlink(uri);
      } catch (e) {
        // Ignore cleanup errors
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      Alert.alert('Error', 'Failed to process audio');
      setIsRecording(false);
      setRecording(null);
    } finally {
      setSearching(false);
    }
  }, [recording, saveRecentSearch]);

  const handleAudioPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handlePhotoPress = useCallback((photo: PhotoMetadata) => {
    navigation.navigate('PhotoDetail', { photoId: photo.id, uri: photo.uri });
  }, [navigation]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setQuery(suggestion);
    // Auto-search on suggestion press
    setTimeout(() => {
      handleSearch();
    }, 100);
  }, [handleSearch]);

  const handleRecentSearchPress = useCallback((search: string) => {
    setQuery(search);
    setTimeout(() => {
      handleSearch();
    }, 100);
  }, [handleSearch]);

  // Memoize suggested queries display
  const suggestedQueriesDisplay = useMemo(() => {
    return SUGGESTED_QUERIES.filter(q => !recentSearches.includes(q));
  }, [recentSearches]);

  return (
    <ScreenLayout>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerSubtitle}>Semantic Photo Finding</Text>
      </View>

      {/* ChatGPT-style Search Bar */}
      <View style={styles.searchWrapper}>
        <BlurView intensity={30} tint="light" style={styles.searchBar}>
          <Ionicons 
            name="search-outline" 
            size={20} 
            color={colors.text.tertiary} 
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Search moods, contexts..."
            placeholderTextColor={colors.text.tertiary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              // Reset search state when query is cleared
              if (!text.trim() && hasSearched) {
                setHasSearched(false);
                setResultsPhotos([]);
                setPhrases([]);
                setMessage('');
                setTranscript('');
              }
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            editable={!searching && !isRecording}
          />
          {query.length > 0 && !searching && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                // Reset search state when clearing query
                setHasSearched(false);
                setResultsPhotos([]);
                setPhrases([]);
                setMessage('');
                setTranscript('');
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.iconButton, isRecording && styles.recordingButton]}
            onPress={handleAudioPress}
            disabled={searching}
          >
            {isRecording ? (
              <View style={styles.recordingIndicator} />
            ) : searching ? (
              <ActivityIndicator size="small" color={colors.warm.accent} />
            ) : (
              <Ionicons name="mic" size={20} color={colors.warm.accent} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.sendButton]}
            onPress={handleSearch}
            disabled={searching || !query.trim() || isRecording}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </BlurView>
      </View>

      {isRecording && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingPulse} />
          <Text style={styles.recordingText}>Recording... Tap mic to stop</Text>
        </View>
      )}

      {searching && !isRecording && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.warm.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && hasSearched && resultsPhotos.length === 0 && (
        <View style={styles.center}>
          <BlurView intensity={20} style={styles.glassCard}>
            <Ionicons name="search-outline" size={48} color={colors.text.tertiary} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try a different search query or index your photos first
            </Text>
            {!!message && (
              <Text style={[styles.emptySubtext, { marginTop: 6 }]}>{message}</Text>
            )}
          </BlurView>
        </View>
      )}

      {!searching && resultsPhotos.length > 0 && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Search Results</Text>
            <Text style={styles.count}>{resultsPhotos.length} photos found</Text>
            {phrases.length > 0 && (
              <View style={styles.phrasesRow}>
                {phrases.map((p) => (
                  <View key={p} style={styles.phraseChip}>
                    <Text style={styles.phraseText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!transcript && (
              <View style={styles.transcriptBox}>
                <Ionicons name="mic" size={14} color={colors.text.secondary} />
                <Text style={styles.transcriptText}>{transcript}</Text>
              </View>
            )}
            {!!message && (
              <Text style={styles.messageText}>{message}</Text>
            )}
          </View>
          <PhotoGrid
            photos={resultsPhotos}
            onPhotoPress={handlePhotoPress}
          />
        </ScrollView>
      )}

      {!hasSearched && !searching && !isRecording && (
        <ScrollView contentContainerStyle={styles.suggestionsContent}>
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <View style={styles.chipsContainer}>
                {recentSearches.map((search, index) => (
                  <TouchableOpacity
                    key={`recent-${index}`}
                    style={styles.chip}
                    onPress={() => handleRecentSearchPress(search)}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.warm.accent} />
                    <Text style={styles.chipText}>{search}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggestions</Text>
            <View style={styles.chipsContainer}>
              {suggestedQueriesDisplay.map((suggestion, index) => (
                <TouchableOpacity
                  key={`suggestion-${index}`}
                  style={styles.chip}
                  onPress={() => handleSuggestionPress(suggestion)}
                >
                  <Text style={styles.chipText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.infoSection}>
            <Ionicons name="sparkles-outline" size={24} color={colors.warm.accent} />
            <Text style={styles.infoTitle}>Semantic Search</Text>
            <Text style={styles.infoText}>
              Find photos by describing what you remember: moods, objects, scenes, or feelings.
            </Text>
          </View>
        </ScrollView>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  suggestionsContent: {
    paddingBottom: 100,
    paddingHorizontal: spacing.l,
  },
  headerContainer: {
    marginTop: 40,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 5,
  },
  searchWrapper: {
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
  searchBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: spacing.s,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 16,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  sendButton: {
    backgroundColor: colors.warm.accent,
  },
  recordingButton: {
    backgroundColor: colors.semantic.error,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
    backgroundColor: colors.semantic.error + '20',
    marginHorizontal: spacing.l,
    borderRadius: radius.m,
    marginBottom: spacing.m,
  },
  recordingPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.semantic.error,
    marginRight: spacing.s,
  },
  recordingText: {
    color: colors.semantic.error,
    fontSize: 14,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  glassCard: {
    padding: spacing.xxl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    width: '100%',
  },
  emptyIcon: {
    marginBottom: spacing.m,
    opacity: 0.5,
  },
  loadingText: {
    marginTop: spacing.m,
    fontSize: 16,
    color: colors.text.secondary,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.s,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  resultsHeader: {
    padding: spacing.l,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: 1,
  },
  count: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  phrasesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.s,
  },
  phraseChip: {
    backgroundColor: colors.warm.tertiary,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.m,
  },
  phraseText: {
    color: colors.warm.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  transcriptBox: {
    marginTop: spacing.m,
    backgroundColor: colors.neutral.gray200,
    padding: spacing.m,
    borderRadius: radius.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  transcriptText: {
    color: colors.text.primary,
    fontSize: 13,
    flex: 1,
  },
  messageText: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: 12,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.m,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.warm.tertiary,
    gap: spacing.xs,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.white,
    borderRadius: radius.xl,
    marginTop: spacing.l,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.m,
    marginBottom: spacing.s,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
