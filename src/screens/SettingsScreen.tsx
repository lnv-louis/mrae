import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import indexingService from '../services/indexingService';
import storageService from '../utils/storage';
import { IndexingProgress } from '../types';

export default function SettingsScreen() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress | null>(null);
  const [lastIndexed, setLastIndexed] = useState<number | null>(null);

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
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Indexing</Text>
        
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
            {indexingProgress.current && (
              <Text style={styles.progressCurrent} numberOfLines={1}>
                {indexingProgress.current}
              </Text>
            )}
          </View>
        )}

        {!isIndexing && (
          <TouchableOpacity
            style={styles.button}
            onPress={handleStartIndexing}
          >
            <Text style={styles.buttonText}>Start Indexing</Text>
          </TouchableOpacity>
        )}

        {isIndexing && (
          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleStopIndexing}
          >
            <Text style={styles.buttonText}>Stop Indexing</Text>
          </TouchableOpacity>
        )}

        {lastIndexed && (
          <Text style={styles.infoText}>
            Last indexed: {formatDate(lastIndexed)}
          </Text>
        )}

        {indexingProgress && (
          <Text style={styles.infoText}>
            Total indexed: {indexingProgress.processed} photos
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={handleClearData}
        >
          <Text style={styles.buttonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.infoText}>MRAE v1.0.0</Text>
        <Text style={styles.infoText}>
          Memory-retrieved Album Explorer
        </Text>
        <Text style={styles.infoText}>
          Built with Cactus SDK for on-device AI
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonDanger: {
    backgroundColor: '#d32f2f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#000',
  },
  progressCurrent: {
    fontSize: 12,
    color: '#999',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});

