import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { updatePatient } from './database';
import { formatPatientNameParts } from './patientName';

export default function EditPatientScreen({ route, navigation }) {
  const { patient } = route.params;
  const [firstName, setFirstName] = useState(patient.first_name ?? '');
  const [middleName, setMiddleName] = useState(patient.middle_name ?? '');
  const [lastName, setLastName] = useState(patient.last_name ?? '');
  const [dob, setDob] = useState(patient.dob ?? '');
  const [phone, setPhone] = useState(patient.phone ?? '');
  const [address, setAddress] = useState(patient.address ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Missing Fields', 'Please fill in first name, last name, phone number, and address.');
      return;
    }
    setSaving(true);
    try {
      await updatePatient(patient.id, {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        dob: dob.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      const updatedPatient = {
        ...patient,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        name: formatPatientNameParts(firstName, middleName, lastName),
        dob: dob.trim(),
        phone: phone.trim(),
        address: address.trim(),
      };
      navigation.navigate({ name: 'PatientDetail', params: { patient: updatedPatient }, merge: true });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to update patient details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Edit Patient Details</Text>

        <Text style={styles.label}>First Name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

        <Text style={styles.label}>Middle Name</Text>
        <TextInput style={styles.input} value={middleName} onChangeText={setMiddleName} />

        <Text style={styles.label}>Last Name</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>Address</Text>
        <TextInput style={[styles.input, styles.multiline]} value={address} onChangeText={setAddress} multiline />

        <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Details'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#f5f6fa',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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
    marginBottom: 16,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
