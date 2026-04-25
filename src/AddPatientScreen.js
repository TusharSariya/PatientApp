import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { addPatient } from './database';
import { GestureTriggerButton, useGestureTextInput } from './GestureInputProvider';

function FieldLabel({ children, onGesturePress }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      <GestureTriggerButton onPress={onGesturePress} />
    </View>
  );
}

export default function AddPatientScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const nameInput = useGestureTextInput({ label: 'Full Name', value: name, setValue: setName });
  const phoneInput = useGestureTextInput({ label: 'Phone Number', value: phone, setValue: setPhone });
  const addressInput = useGestureTextInput({ label: 'Address', value: address, setValue: setAddress });

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await addPatient(name.trim(), phone.trim(), address.trim());
      Alert.alert('Success', `${name.trim()} has been added.`);
      setName('');
      setPhone('');
      setAddress('');
    } catch (e) {
      Alert.alert('Error', 'Failed to save patient.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>New Patient</Text>

        <FieldLabel onGesturePress={nameInput.openGestureInput}>Full Name</FieldLabel>
        <TextInput
          ref={nameInput.ref}
          style={styles.input}
          placeholder="e.g. John Smith"
          value={name}
          onChangeText={setName}
          onFocus={nameInput.onFocus}
          onBlur={nameInput.onBlur}
          onSelectionChange={nameInput.onSelectionChange}
          selection={nameInput.selection}
          autoCapitalize="words"
        />

        <FieldLabel onGesturePress={phoneInput.openGestureInput}>Phone Number</FieldLabel>
        <TextInput
          ref={phoneInput.ref}
          style={styles.input}
          placeholder="e.g. 555-123-4567"
          value={phone}
          onChangeText={setPhone}
          onFocus={phoneInput.onFocus}
          onBlur={phoneInput.onBlur}
          onSelectionChange={phoneInput.onSelectionChange}
          selection={phoneInput.selection}
          keyboardType="phone-pad"
        />

        <FieldLabel onGesturePress={addressInput.openGestureInput}>Address</FieldLabel>
        <TextInput
          ref={addressInput.ref}
          style={[styles.input, styles.multiline]}
          placeholder="e.g. 123 Main St, City, State"
          value={address}
          onChangeText={setAddress}
          onFocus={addressInput.onFocus}
          onBlur={addressInput.onBlur}
          onSelectionChange={addressInput.onSelectionChange}
          selection={addressInput.selection}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Save Patient'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 28,
    color: '#1a1a2e',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 20,
    color: '#1a1a2e',
  },
  multiline: {
    height: 90,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
