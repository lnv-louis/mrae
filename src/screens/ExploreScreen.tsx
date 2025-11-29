import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import PhotoGrid from '../components/PhotoGrid';
import querySearchService from '../services/querySearchService';
import speechQueryService from '../services/speechQueryService';
import { PhotoMetadata } from '../types';
import ScreenLayout from '../components/ScreenLayout';
import { colors, spacing, radius } from '../theme';

export default function ExploreScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [resultsPhotos, setResultsPhotos] = useState<PhotoMetadata[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      setHasSearched(true);
      const res = await querySearchService.searchByExpandedText(query.trim());
      const photos = res.results.map((r) => ({ id: r.id, uri: r.uri, createdAt: r.timestamp } as PhotoMetadata));
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
  };

  const handleAudioSearch = async () => {
    try {
      setSearching(true);
      setHasSearched(true);
      const res = await speechQueryService.searchByAudio('mock://audio');
      const photos = res.results.map((r) => ({ id: r.id, uri: r.uri, createdAt: r.timestamp } as PhotoMetadata));
      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setTranscript(res.transcript);
      setMessage(res.message);
    } catch (error) {
      console.error('Error audio searching:', error);
      Alert.alert('Error', 'Failed to search by audio');
    } finally {
      setSearching(false);
    }
  };

  const handlePhotoPress = (photo: any) => {
    navigation.navigate('PhotoDetail', { photoId: photo.id, uri: photo.uri });
  };

  return (
    <ScreenLayout>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerSubtitle}>Semantic Photo Finding</Text>
      </View>

      <View style={styles.searchWrapper}>
        <BlurView intensity={30} tint="light" style={styles.searchBlur}>
          <TextInput
            style={styles.input}
            placeholder="Search moods, contexts..."
            placeholderTextColor={colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchButton, styles.audioButton]}
            onPress={handleAudioSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Audio</Text>
            )}
          </TouchableOpacity>
        </BlurView>
      </View>

      {searching && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && hasSearched && resultsPhotos.length === 0 && (
        <View style={styles.center}>
          <BlurView intensity={20} style={styles.glassCard}>
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

      {!hasSearched && !searching && (
        <View style={styles.center}>
          <BlurView intensity={20} style={styles.glassCard}>
            <Text style={styles.placeholderText}>
              Find photos by mood & context
            </Text>
            <Text style={styles.placeholderSubtext}>
              Example: "sunset with people", "dog playing", "food"
            </Text>
          </BlurView>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
    marginBottom: 10,
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
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBlur: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  input: {
    flex: 1,
    height: 40,
    color: colors.text.primary,
    fontSize: 16,
    paddingHorizontal: 10,
  },
  searchButton: {
    backgroundColor: colors.warm.tertiary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: colors.warm.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  glassCard: {
    padding: 30,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    width: '100%',
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  resultsHeader: {
    padding: 20,
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
    gap: 8,
    marginTop: 8,
  },
  phraseChip: {
    backgroundColor: colors.warm.tertiary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  phraseText: {
    color: colors.warm.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  transcriptBox: {
    marginTop: 10,
    backgroundColor: colors.neutral.gray200,
    padding: 10,
    borderRadius: 10,
  },
  transcriptText: {
    color: colors.text.primary,
    fontSize: 13,
  },
  messageText: {
    marginTop: 6,
    color: colors.text.tertiary,
    fontSize: 12,
  },
  audioButton: {
    marginLeft: 8,
  },
});
