import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getClinicProfile, saveClinicProfile } from './database';
import { showErrorAlert } from './errorAlerts';
import { flatSection, screenColors, screenContent } from './screenLayout';

export default function ClinicProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [registration, setRegistration] = useState('');
  const [hours, setHours] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getClinicProfile();
      setDoctorName(row.doctorName);
      setQualifications(row.qualifications);
      setAddress(row.address);
      setContact(row.contact);
      setRegistration(row.registration);
      setHours(row.hours);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  async function handleSave() {
    setSaving(true);
    try {
      await saveClinicProfile({
        doctorName: doctorName.trim(),
        qualifications: qualifications.trim(),
        address: address.trim(),
        contact: contact.trim(),
        registration: registration.trim(),
        hours: hours.trim(),
      });
      Alert.alert('Saved', 'These details will appear at the top of prescription PDFs.');
    } catch (error) {
      showErrorAlert(navigation, {
        message: 'Could not save your details.',
        screen: 'ClinicProfile',
        error,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4f6ef7" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            Fill in your professional header once. It is reused whenever you share a prescription PDF from a patient visit.
          </Text>

          <View style={styles.formSection}>
          <Text style={styles.label}>Doctor / practice name</Text>
          <TextInput
            style={styles.input}
            value={doctorName}
            onChangeText={setDoctorName}
            placeholder="e.g. Dr Linesh Yawalkar"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.label}>Qualifications</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={qualifications}
            onChangeText={setQualifications}
            placeholder="Degrees and certifications"
            placeholderTextColor="#bbb"
            multiline
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={address}
            onChangeText={setAddress}
            placeholder="Clinic address (use line breaks if needed)"
            placeholderTextColor="#bbb"
            multiline
          />

          <Text style={styles.label}>Contact</Text>
          <TextInput
            style={styles.input}
            value={contact}
            onChangeText={setContact}
            placeholder="Phone / WhatsApp"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.label}>Registration</Text>
          <TextInput
            style={styles.input}
            value={registration}
            onChangeText={setRegistration}
            placeholder="e.g. Reg. No. 67827"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.label}>Hours</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={hours}
            onChangeText={setHours}
            placeholder="Consultation hours"
            placeholderTextColor="#bbb"
            multiline
          />

          <TouchableOpacity
            testID="clinic-profile-save"
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: screenColors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: screenContent(40),
  formSection: flatSection({ paddingVertical: 16 }),
  hint: {
    fontSize: 13,
    color: '#65708a',
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
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
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
