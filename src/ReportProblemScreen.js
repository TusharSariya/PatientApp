import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { buildDiagnosticReport } from './diagnosticReport';
import { shareDiagnosticReport } from './shareDiagnosticReport';
import { flatSection, screenColors, screenContent } from './screenLayout';

export default function ReportProblemScreen({ route }) {
  const [userNotes, setUserNotes] = useState(route?.params?.prefill ?? '');
  const [preview, setPreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingPreview(true);
    buildDiagnosticReport({ userNotes })
      .then((report) => {
        if (active) setPreview(report);
      })
      .catch(() => {
        if (active) setPreview('Could not build diagnostic preview.');
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, [userNotes]);

  async function handleShare() {
    setSharing(true);
    try {
      await shareDiagnosticReport({ userNotes });
    } catch {
      Alert.alert('Error', 'Could not share the diagnostic report.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Describe what you were doing when the problem happened. The report includes app version,
        device info, and recent errors. It does not include patient names or medical records.
      </Text>

      <View style={styles.formSection}>
        <Text style={[styles.label, styles.firstLabel]}>What happened?</Text>
        <TextInput
          testID="report-problem-notes"
          style={[styles.input, styles.multiline]}
          value={userNotes}
          onChangeText={setUserNotes}
          placeholder="Steps to reproduce, what you expected, what happened instead"
          placeholderTextColor="#bbb"
          multiline
        />

        <Text style={styles.label}>Diagnostic preview</Text>
        {loadingPreview ? (
          <ActivityIndicator size="small" color="#4f6ef7" style={styles.loader} />
        ) : (
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        )}

        <TouchableOpacity
          testID="report-problem-send"
          style={[styles.sendButton, sharing && styles.sendButtonDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          <Text style={styles.sendButtonText}>{sharing ? 'Preparing…' : 'Send report'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    ...screenContent(40),
    backgroundColor: screenColors.bg,
  },
  intro: {
    fontSize: 13,
    lineHeight: 18,
    color: '#65708a',
    marginBottom: 16,
  },
  formSection: flatSection({ paddingVertical: 16 }),
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  firstLabel: {
    marginTop: 0,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  loader: {
    marginVertical: 16,
  },
  previewBox: {
    backgroundColor: screenColors.tint,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: screenColors.border,
    padding: 12,
  },
  previewText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#4a5568',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sendButton: {
    marginTop: 24,
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
