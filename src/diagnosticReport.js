import { Platform } from 'react-native';

import { formatErrorsForReport, getRecentErrors } from './errorLog';
import { getAllPatients, getAppSettings } from './database';
import { getAppMetadata, getDeviceMetadata } from './runtimeInfo';

export async function buildDiagnosticReport({ userNotes = '' } = {}) {
  const [settings, patients] = await Promise.all([
    getAppSettings().catch(() => ({ currencyCode: 'unknown', defaultInputMode: 'unknown' })),
    getAllPatients().catch(() => []),
  ]);

  const app = getAppMetadata();
  const device = getDeviceMetadata();

  const lines = [
    'PatientApp Diagnostic Report',
    '==========================',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Platform: ${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
    `App version: ${app.version}`,
    `Build: ${app.build}`,
    `Application ID: ${app.applicationId}`,
    `Device: ${device.manufacturer} ${device.modelName}`,
    `OS version: ${device.osName} ${device.osVersion}`.trim(),
    '',
    'Settings',
    `  Currency: ${settings.currencyCode ?? 'unknown'}`,
    `  Input mode: ${settings.defaultInputMode ?? 'unknown'}`,
    '',
    'Counts (no patient names)',
    `  Patients on device: ${Array.isArray(patients) ? patients.length : 0}`,
    '',
    'User notes',
    userNotes.trim() || '(none provided)',
    '',
    'Recent errors',
    formatErrorsForReport(getRecentErrors()),
    '',
    'Privacy note: this report excludes patient names, contact details, and medical records.',
  ];

  return lines.join('\n');
}
