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

// Suggested search queries - More inspiring and diverse
const SUGGESTED_QUERIES = [
  'golden hour moments with warm light',
  'candid laughter and genuine smiles',
  'peaceful nature scenes that feel serene',
  'urban architecture with interesting geometry',
  'food that looks delicious and colorful',
  'adventurous travel memories',
  'cozy indoor moments with soft lighting',
  'vibrant celebrations full of energy',
  'quiet contemplative moments alone',
  'dynamic action shots with movement',
  'nostalgic vintage vibes',
  'minimalist compositions with negative space',
];

export default function ExploreScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [resultsPhotos, setResultsPhotos] = useState<PhotoMetadata[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string>('');
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
      setSearchProgress('Processing your query...');
      await saveRecentSearch(query.trim());

      setSearchProgress('Generating text embeddings...');
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI

      setSearchProgress('Searching through your photos...');
      const res = await querySearchService.searchByExpandedText(query.trim());

      setSearchProgress('Ranking results...');
      const photos = res.results.map((r) => ({
        id: r.id,
        uri: r.uri,
        createdAt: r.timestamp
      } as PhotoMetadata));

      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setMessage(res.message);
      setTranscript('');
      setSearchProgress('');
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search photos');
      setSearchProgress('');
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

      // Start recording with WAV format (best for Whisper STT)
      // Whisper models work best with WAV/PCM audio
      const { recording: newRecording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000, // 16kHz is optimal for Whisper
          numberOfChannels: 1, // Mono
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000, // 16kHz is optimal for Whisper
          numberOfChannels: 1, // Mono
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });

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
      setSearchProgress('Transcribing audio...');

      const transcription = await transcriptionService.transcribe(uri);
      const transcribedText = transcription.response || '';

      if (!transcribedText.trim()) {
        Alert.alert('Error', 'Could not transcribe audio. Please try again.');
        setSearching(false);
        setSearchProgress('');
        return;
      }

      // Use transcribed text for search
      setQuery(transcribedText);
      await saveRecentSearch(transcribedText);

      setSearchProgress('Generating embeddings...');
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI

      setSearchProgress('Searching photos...');
      const res = await speechQueryService.searchByAudio(uri);

      setSearchProgress('Ranking results...');
      const photos = res.results.map((r) => ({
        id: r.id,
        uri: r.uri,
        createdAt: r.timestamp
      } as PhotoMetadata));

      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setTranscript(res.transcript);
      setMessage(res.message);
      setSearchProgress('');
      
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
      {/* Compact Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      {/* Prominent Dual-Input Design */}
      <View style={styles.inputContainer}>
        {/* Large Voice Button */}
        <TouchableOpacity
          style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
          onPress={handleAudioPress}
          disabled={searching}
        >
          {isRecording ? (
            <View style={styles.voiceButtonContent}>
              <View style={styles.recordingPulseIcon} />
              <Text style={styles.voiceButtonText}>Stop</Text>
            </View>
          ) : (
            <View style={styles.voiceButtonContent}>
              <Ionicons name="mic" size={28} color="#fff" />
              <Text style={styles.voiceButtonText}>Voice</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Text Input */}
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="or describe with text..."
            placeholderTextColor={colors.text.tertiary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
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
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
          {query.length > 0 && !searching && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setHasSearched(false);
                setResultsPhotos([]);
                setPhrases([]);
                setMessage('');
                setTranscript('');
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={searching || !query.trim() || isRecording}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isRecording && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingPulse} />
          <Text style={styles.recordingText}>Listening...</Text>
        </View>
      )}

      {searching && !isRecording && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.warm.accent} />
          <Text style={styles.loadingText}>{searchProgress || 'Searching...'}</Text>
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
              <Text style={styles.sectionTitle}>Recent</Text>
              <View style={styles.chipsContainer}>
                {recentSearches.slice(0, 3).map((search, index) => (
                  <TouchableOpacity
                    key={`recent-${index}`}
                    style={styles.chip}
                    onPress={() => handleRecentSearchPress(search)}
                  >
                    <Text style={styles.chipText}>{search}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Try</Text>
            <View style={styles.chipsContainer}>
              {suggestedQueriesDisplay.slice(0, 6).map((suggestion, index) => (
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
            <Ionicons name="sparkles-outline" size={20} color={colors.warm.accent} style={{ marginBottom: 6 }} />
            <Text style={styles.infoText}>
              Describe the mood, colors, or story — our AI understands context, not just keywords.
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
    marginTop: 30,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
    gap: spacing.m,
    alignItems: 'stretch',
  },
  voiceButton: {
    width: 100,
    backgroundColor: colors.warm.accent,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.l,
    shadowColor: colors.warm.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  voiceButtonRecording: {
    backgroundColor: colors.semantic.error,
  },
  voiceButtonContent: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordingPulseIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    alignItems: 'center',
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: 0,
    minHeight: 44,
    maxHeight: 80,
    lineHeight: 20,
  },
  clearButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warm.accent,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: spacing.l,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.s,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
  },
  chipText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '400',
  },
  infoSection: {
    alignItems: 'center',
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.m,
    marginTop: spacing.m,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
