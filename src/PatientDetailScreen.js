import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export default function PatientDetailScreen({ route }) {
  const { patient } = route.params;
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => setRecognizing(false));
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    Alert.alert('Dictation error', event.message ?? 'Something went wrong.');
    setRecognizing(false);
  });

  async function toggleDictation() {
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed for dictation.');
      return;
    }
    setTranscript('');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.infoCard}>
        <Text style={styles.name}>{patient.name}</Text>
        <Text style={styles.detail}>📞 {patient.phone}</Text>
        <Text style={styles.detail}>📍 {patient.address}</Text>
      </View>

      <Text style={styles.sectionLabel}>Dictation</Text>

      <View style={styles.dictationBox}>
        <Text style={styles.transcriptText}>
          {transcript || (recognizing ? 'Listening…' : 'Tap the mic to start dictating.')}
        </Text>

        <TouchableOpacity
          style={[styles.micButton, recognizing && styles.micButtonActive]}
          onPress={toggleDictation}
          activeOpacity={0.8}
        >
          <Text style={styles.micIcon}>{recognizing ? '⏹' : '🎙'}</Text>
        </TouchableOpacity>

        {transcript.length > 0 && !recognizing && (
          <TouchableOpacity onPress={() => setTranscript('')} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#f5f6fa',
    flexGrow: 1,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  detail: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  dictationBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  transcriptText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    minHeight: 72,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4f6ef7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f6ef7',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  micButtonActive: {
    backgroundColor: '#e74c3c',
    shadowColor: '#e74c3c',
  },
  micIcon: {
    fontSize: 32,
  },
  clearButton: {
    marginTop: 16,
  },
  clearText: {
    color: '#4f6ef7',
    fontSize: 14,
    fontWeight: '600',
  },
});
