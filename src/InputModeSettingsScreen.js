import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppSettings, saveAppSettings } from './database';
import { GESTURE_INPUT_MODE_NOTE } from './gestureInstructions';
import { INPUT_MODES } from './inputMode';
import { flatPressableRow, flatSection, flatSelectedRow, screenColors, screenContent } from './screenLayout';

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Choose what opens first when supported text fields are focused.
      </Text>
      {defaultInputMode === 'gestures' ? (
        <Text style={styles.note} testID="gesture-input-mode-note">
          {GESTURE_INPUT_MODE_NOTE}
        </Text>
      ) : null}
      <View style={styles.optionsSection}>
        {INPUT_MODES.map((mode, index) => {
          const selected = mode.id === defaultInputMode;
          return (
            <TouchableOpacity
              key={mode.id}
              style={[
                flatPressableRow({ last: index === INPUT_MODES.length - 1 }),
                flatSelectedRow(selected),
              ]}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: screenColors.bg,
  },
  content: screenContent(40),
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: screenColors.bg,
  },
  intro: {
    fontSize: 14,
    color: '#5f6d8a',
    marginBottom: 16,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    marginBottom: 16,
  },
  optionsSection: flatSection(),
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
