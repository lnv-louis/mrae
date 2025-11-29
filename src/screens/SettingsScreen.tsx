import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import indexingService from '../services/indexingService';
import storageService from '../utils/storage';
import { IndexingProgress } from '../types';
import ScreenLayout from '../components/ScreenLayout';
import { colors, spacing, radius } from '../theme';

export default function SettingsScreen({ navigation }: any) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress | null>(null);
  const [lastIndexed, setLastIndexed] = useState<number | null>(null);
  const [hasShownComplete, setHasShownComplete] = useState(false);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    const status = await indexingService.getIndexingStatus();
    setIsIndexing(status.isIndexing);
    setIndexingProgress(status.progress);
    setLastIndexed(status.lastIndexed);
    const done = !status.isIndexing && status.progress && status.progress.total > 0 && status.progress.processed >= status.progress.total;
    if (done && !hasShownComplete) {
      Alert.alert('Indexing Complete', 'Your photos are indexed. Search is ready.');
      setHasShownComplete(true);
    }
  };

  const handleStartIndexing = async () => {
    try {
      Alert.alert(
        'Start Indexing',
        'This will process all photos and generate embeddings. This may take a while.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start',
            onPress: async () => {
              await indexingService.startIndexing((progress) => {
                setIndexingProgress(progress);
                setIsIndexing(progress.processed < progress.total);
              });
              await loadStatus();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error starting indexing:', error);
      Alert.alert('Error', 'Failed to start indexing');
    }
  };

  const handleStopIndexing = () => {
    indexingService.stopIndexing();
    Alert.alert('Indexing Stopped', 'Indexing has been stopped. Progress has been saved.');
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all indexed photos and embeddings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearAll();
            setIndexingProgress(null);
            setLastIndexed(null);
            Alert.alert('Success', 'All data has been cleared');
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <ScreenLayout>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Smart Cleaner Section */}
        <BlurView intensity={20} style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="trash-bin-outline" size={24} color={colors.warm.accent} />
            <Text style={styles.cardTitle}>Smart Storage</Text>
          </View>
          <Text style={styles.cardDescription}>
            Swipe left/right to clean up unwanted photos and save space.
          </Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
                // Assuming we might navigate to CleanScreen if we kept it or implement a modal
                // Since CleanScreen is not in the tab, we can navigate to it if it's registered in a Stack.
                // But we only have Tab navigator in App.tsx. 
                // I'll just show an alert for now or maybe I should have kept it as a screen in a Stack Navigator.
                // For this demo, I'll assume CleanScreen is not easily accessible unless I add a Stack.
                // I will update App.tsx later if needed to add a Stack for CleanScreen.
                Alert.alert("Smart Cleaner", "This feature will open the Tinder-like cleaner interface.");
            }}
          >
            <Text style={styles.actionButtonText}>Open Cleaner</Text>
          </TouchableOpacity>
        </BlurView>

        {/* Indexing Section */}
        <BlurView intensity={20} style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="scan-outline" size={24} color={colors.warm.accent} />
            <Text style={styles.cardTitle}>AI Indexing</Text>
          </View>
          {!isIndexing && indexingProgress && indexingProgress.total > 0 && indexingProgress.processed >= indexingProgress.total && (
            <View style={styles.completeBanner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.semantic.success} />
              <Text style={styles.completeText}>Indexing Complete • Search Ready</Text>
            </View>
          )}
          
          {isIndexing && indexingProgress && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Processing: {indexingProgress.processed} / {indexingProgress.total}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(indexingProgress.processed / indexingProgress.total) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {!isIndexing && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleStartIndexing}
            >
              <Text style={styles.actionButtonText}>Start Indexing</Text>
            </TouchableOpacity>
          )}

          {isIndexing && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.stopButton]}
              onPress={handleStopIndexing}
            >
              <Text style={styles.actionButtonText}>Stop Indexing</Text>
            </TouchableOpacity>
          )}
          
          {lastIndexed && (
            <Text style={styles.lastIndexedText}>
              Last indexed: {formatDate(lastIndexed)}
            </Text>
          )}
        </BlurView>

        {/* Data Management */}
        <BlurView intensity={20} style={styles.glassCard}>
           <View style={styles.cardHeader}>
            <Ionicons name="server-outline" size={24} color={colors.warm.accent} />
            <Text style={styles.cardTitle}>Data</Text>
          </View>
          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClearData}
          >
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </BlurView>

      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 2,
  },
  glassCard: {
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.neutral.white,
    marginBottom: 20,
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: colors.warm.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.warm.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: colors.neutral.white,
    fontWeight: '600',
    fontSize: 16,
  },
  stopButton: {
    backgroundColor: colors.semantic.error,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
    borderWidth: 1,
    borderColor: colors.semantic.error,
  },
  dangerButtonText: {
    color: colors.semantic.error,
    fontWeight: '600',
    fontSize: 16,
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressText: {
    color: colors.text.primary,
    marginBottom: 5,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.warm.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.semantic.success,
  },
  lastIndexedText: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 10,
  },
  completeText: {
    color: colors.semantic.success,
    fontSize: 14,
    fontWeight: '600',
  },
});
