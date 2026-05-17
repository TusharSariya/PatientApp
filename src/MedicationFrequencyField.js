import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export const FREQUENCY_PRESETS = [1, 2, 3, 4];

export function formatPresetFrequency(times) {
  return `${times}x/day`;
}

export function isPresetFrequency(value) {
  const trimmed = (value ?? '').trim();
  return FREQUENCY_PRESETS.some((times) => formatPresetFrequency(times) === trimmed);
}

export default function MedicationFrequencyField({
  value = '',
  onChange,
  label = 'Frequency (times per day)',
}) {
  const customValue = isPresetFrequency(value) ? '' : value;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {FREQUENCY_PRESETS.map((times) => {
          const preset = formatPresetFrequency(times);
          const active = value === preset;
          return (
            <TouchableOpacity
              key={preset}
              testID={`frequency-preset-${times}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(preset)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{times}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        testID="frequency-custom"
        style={styles.customInput}
        value={customValue}
        onChangeText={onChange}
        placeholder="Custom (e.g. 5x/day, PRN)"
        placeholderTextColor="#bbb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipActive: {
    borderColor: '#4f6ef7',
    backgroundColor: '#4f6ef7',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  chipTextActive: {
    color: '#fff',
  },
  customInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
});
