import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizeDurationInput } from './medicineDisplay';

function MedicineDurationField({
  value,
  onChangeText,
  testID,
  style,
  ...textInputProps
}, ref) {
  return (
    <View style={[styles.row, style]}>
      <TextInput
        ref={ref}
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={(text) => onChangeText(normalizeDurationInput(text))}
        placeholder="—"
        placeholderTextColor="#a4adbf"
        keyboardType="number-pad"
        maxLength={3}
        {...textInputProps}
      />
      <Text style={styles.unit}>days</Text>
    </View>
  );
}

export default React.forwardRef(MedicineDurationField);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    width: 72,
    minWidth: 72,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f7f9ff',
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  unit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5f6d8a',
  },
});
