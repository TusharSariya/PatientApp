import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 30;

function clampIntervalDays(value) {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, value));
}

export default function IntervalDaysStepper({ value, onChange, testIDPrefix = 'interval-days' }) {
  const intervalDays = clampIntervalDays(Number(value) || MIN_INTERVAL_DAYS);

  function adjustIntervalDays(delta) {
    onChange(clampIntervalDays(intervalDays + delta));
  }

  const controls = [
    { label: '-5', delta: -5, testID: `${testIDPrefix}-minus-5` },
    { label: '-1', delta: -1, testID: `${testIDPrefix}-minus-1` },
    { label: '+1', delta: 1, testID: `${testIDPrefix}-plus-1` },
    { label: '+5', delta: 5, testID: `${testIDPrefix}-plus-5` },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.valueBox}>
        <Text style={styles.value} testID={`${testIDPrefix}-value`}>
          {intervalDays}
        </Text>
        <Text style={styles.unit}>{intervalDays === 1 ? 'day' : 'days'}</Text>
      </View>
      <View style={styles.controls}>
        {controls.map((control) => {
          const disabled =
            (control.delta < 0 && intervalDays === MIN_INTERVAL_DAYS) ||
            (control.delta > 0 && intervalDays === MAX_INTERVAL_DAYS);
          return (
            <TouchableOpacity
              key={control.label}
              testID={control.testID}
              style={[styles.button, disabled && styles.buttonDisabled]}
              onPress={() => adjustIntervalDays(control.delta)}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{control.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  valueBox: {
    minWidth: 82,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f7f9ff',
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  unit: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#5f6d8a',
  },
  controls: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    minWidth: 48,
    borderWidth: 1,
    borderColor: '#4f6ef7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#e9eeff',
  },
  buttonDisabled: {
    borderColor: '#e0e4ef',
    backgroundColor: '#f5f6fa',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2f46c7',
  },
  buttonTextDisabled: {
    color: '#a4adbf',
  },
});
