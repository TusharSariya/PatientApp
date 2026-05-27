import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppSettings, saveAppSettings } from './database';
import { INPUT_MODES } from './inputMode';

export default function InputModeSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultInputMode, setDefaultInputMode] = useState('gestures');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getAppSettings();
      setDefaultInputMode(settings.defaultInputMode);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function handleSelect(mode) {
    if (mode === defaultInputMode || saving) return;
    setSaving(true);
    try {
      const settings = await saveAppSettings({ defaultInputMode: mode });
      setDefaultInputMode(settings.defaultInputMode);
    } catch {
      Alert.alert('Error', 'Could not save input mode.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f6ef7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Choose what opens first when supported text fields are focused.
      </Text>
      {INPUT_MODES.map((mode) => {
        const selected = mode.id === defaultInputMode;
        return (
          <TouchableOpacity
            key={mode.id}
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => handleSelect(mode.id)}
            disabled={saving}
            testID={`input-mode-option-${mode.id}`}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{mode.title}</Text>
              <Text style={styles.rowSub}>{mode.subtitle}</Text>
            </View>
            <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : ''}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f6fa',
  },
  intro: {
    fontSize: 14,
    color: '#5f6d8a',
    marginBottom: 16,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: {
    borderColor: '#4f6ef7',
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  rowSub: {
    fontSize: 13,
    color: '#5f6d8a',
    lineHeight: 18,
  },
  check: {
    width: 24,
    textAlign: 'center',
    fontSize: 18,
    color: '#bbb',
    fontWeight: '800',
  },
  checkSelected: {
    color: '#4f6ef7',
  },
});
