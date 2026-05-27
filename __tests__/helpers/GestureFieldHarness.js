import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { GestureInputProvider, useGestureTextInput } from '../../src/GestureInputProvider';

export default function GestureFieldHarness({
  label = 'Field',
  initialValue = '',
  testID = 'gesture-field-input',
  openButtonTestID = 'open-gesture-input',
}) {
  const [value, setValue] = React.useState(initialValue);
  const gestureInput = useGestureTextInput({
    label,
    value,
    setValue,
  });

  return (
    <View>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={setValue}
        ref={gestureInput.ref}
        onFocus={gestureInput.onFocus}
        onBlur={gestureInput.onBlur}
        onSelectionChange={gestureInput.onSelectionChange}
        selection={gestureInput.selection}
        showSoftInputOnFocus={gestureInput.showSoftInputOnFocus}
      />
      <TouchableOpacity testID={openButtonTestID} onPress={gestureInput.openGestureInput}>
        <Text>Open Gesture Input</Text>
      </TouchableOpacity>
      <Text testID={`${testID}-value`}>{value}</Text>
    </View>
  );
}

export function renderGestureHarness(options = {}) {
  const { render } = require('@testing-library/react-native');
  return render(
    <GestureInputProvider>
      <GestureFieldHarness {...options} />
    </GestureInputProvider>
  );
}
