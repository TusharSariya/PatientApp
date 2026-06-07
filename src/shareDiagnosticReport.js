import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { buildDiagnosticReport } from './diagnosticReport';

export async function shareDiagnosticReport({ userNotes = '' } = {}) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
    return;
  }

  const report = await buildDiagnosticReport({ userNotes });
  const uri = `${FileSystem.cacheDirectory}patientapp-diagnostic.txt`;
  await FileSystem.writeAsStringAsync(uri, report, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(uri, {
    mimeType: 'text/plain',
    dialogTitle: 'Report problem',
  });
}
