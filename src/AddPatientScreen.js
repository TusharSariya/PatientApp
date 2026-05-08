import React, { useEffect, useState } from 'react';
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
import { addPatient, searchFamiliesByRelativeName } from './database';
import { useGestureTextInput } from './GestureInputProvider';
import { formatPatientNameParts } from './patientName';

export default function AddPatientScreen() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [relativeNameQuery, setRelativeNameQuery] = useState('');
  const [familyMatches, setFamilyMatches] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [searchingFamilies, setSearchingFamilies] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const firstNameInput = useGestureTextInput({ label: 'First Name', value: firstName, setValue: setFirstName });
  const middleNameInput = useGestureTextInput({ label: 'Middle Name', value: middleName, setValue: setMiddleName });
  const lastNameInput = useGestureTextInput({ label: 'Last Name', value: lastName, setValue: setLastName });
  const dobInput = useGestureTextInput({ label: 'Date of Birth', value: dob, setValue: setDob });
  const relativeNameInput = useGestureTextInput({
    label: 'Relative Name Search',
    value: relativeNameQuery,
    setValue: handleRelativeNameQueryChange,
  });
  const addressInput = useGestureTextInput({ label: 'Address', value: address, setValue: setAddress });

  function handleRelativeNameQueryChange(value) {
    setRelativeNameQuery(value);
    setSelectedFamily(null);
  }

  useEffect(() => {
    let isActive = true;
    const query = relativeNameQuery.trim();
    if (!query) {
      setFamilyMatches([]);
      setSearchingFamilies(false);
      return () => {
        isActive = false;
      };
    }

    setSearchingFamilies(true);
    const timeoutId = setTimeout(async () => {
      try {
        const matches = await searchFamiliesByRelativeName(query);
        if (isActive) setFamilyMatches(matches);
      } finally {
        if (isActive) setSearchingFamilies(false);
      }
    }, 200);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [relativeNameQuery]);

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Missing Fields', 'Please fill in first name, last name, phone number, and address.');
      return;
    }
    if (relativeNameQuery.trim() && !selectedFamily) {
      Alert.alert('Select Family', 'Choose a matching family from the list, or clear the relative search to create a new family.');
      return;
    }
    setLoading(true);
    try {
      const fullName = formatPatientNameParts(firstName, middleName, lastName);
      const result = await addPatient(
        firstName.trim(),
        middleName.trim(),
        lastName.trim(),
        dob.trim(),
        phone.trim(),
        address.trim(),
        selectedFamily ? String(selectedFamily.family_id) : ''
      );
      const membershipText = result.createdNewFamily
        ? `Created family #${result.familyId}.`
        : `Added to family #${result.familyId}.`;
      Alert.alert('Success', `${fullName} has been added. ${membershipText}`);
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setDob('');
      setRelativeNameQuery('');
      setFamilyMatches([]);
      setSelectedFamily(null);
      setPhone('');
      setAddress('');
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Failed to save patient.');
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

        <Text style={styles.label}>First Name</Text>
        <TextInput
          ref={firstNameInput.ref}
          style={styles.input}
          placeholder="e.g. John"
          value={firstName}
          onChangeText={setFirstName}
          showSoftInputOnFocus={firstNameInput.showSoftInputOnFocus}
          onFocus={firstNameInput.onFocus}
          onBlur={firstNameInput.onBlur}
          onSelectionChange={firstNameInput.onSelectionChange}
          selection={firstNameInput.selection}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Middle Name</Text>
        <TextInput
          ref={middleNameInput.ref}
          style={styles.input}
          placeholder="Optional"
          value={middleName}
          onChangeText={setMiddleName}
          showSoftInputOnFocus={middleNameInput.showSoftInputOnFocus}
          onFocus={middleNameInput.onFocus}
          onBlur={middleNameInput.onBlur}
          onSelectionChange={middleNameInput.onSelectionChange}
          selection={middleNameInput.selection}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          ref={lastNameInput.ref}
          style={styles.input}
          placeholder="e.g. Smith"
          value={lastName}
          onChangeText={setLastName}
          showSoftInputOnFocus={lastNameInput.showSoftInputOnFocus}
          onFocus={lastNameInput.onFocus}
          onBlur={lastNameInput.onBlur}
          onSelectionChange={lastNameInput.onSelectionChange}
          selection={lastNameInput.selection}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 555-123-4567"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Find Family by Relative Name</Text>
        <TextInput
          ref={relativeNameInput.ref}
          style={styles.input}
          placeholder="Type relative name (e.g. Alice Johnson)"
          value={relativeNameQuery}
          onChangeText={handleRelativeNameQueryChange}
          showSoftInputOnFocus={relativeNameInput.showSoftInputOnFocus}
          onFocus={relativeNameInput.onFocus}
          onBlur={relativeNameInput.onBlur}
          onSelectionChange={relativeNameInput.onSelectionChange}
          selection={relativeNameInput.selection}
          autoCapitalize="words"
        />
        <Text style={styles.helperText}>
          Leave this blank to create a new family automatically.
        </Text>
        {searchingFamilies ? <Text style={styles.familyStatus}>Searching families…</Text> : null}
        {!searchingFamilies && relativeNameQuery.trim() && familyMatches.length === 0 ? (
          <Text style={styles.familyStatus}>No family matches found. Keep blank to create a new family.</Text>
        ) : null}
        {familyMatches.map((match) => {
          const isSelected = selectedFamily?.family_id === match.family_id;
          return (
            <TouchableOpacity
              key={match.family_id}
              style={[styles.familyMatchButton, isSelected && styles.familyMatchButtonSelected]}
              onPress={() => {
                setSelectedFamily(match);
                setRelativeNameQuery(match.relative_name);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.familyMatchTitle, isSelected && styles.familyMatchTitleSelected]}>
                Family #{match.family_id}
              </Text>
              <Text style={[styles.familyMatchSubtitle, isSelected && styles.familyMatchSubtitleSelected]}>
                Relative match: {match.relative_name} ({match.member_count} member{match.member_count === 1 ? '' : 's'})
              </Text>
            </TouchableOpacity>
          );
        })}
        {selectedFamily ? (
          <Text style={styles.familyStatus}>Selected Family #{selectedFamily.family_id}</Text>
        ) : null}

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput
          ref={dobInput.ref}
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={dob}
          onChangeText={setDob}
          showSoftInputOnFocus={dobInput.showSoftInputOnFocus}
          onFocus={dobInput.onFocus}
          onBlur={dobInput.onBlur}
          onSelectionChange={dobInput.onSelectionChange}
          selection={dobInput.selection}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          ref={addressInput.ref}
          style={[styles.input, styles.multiline]}
          placeholder="e.g. 123 Main St, City, State"
          value={address}
          onChangeText={setAddress}
          showSoftInputOnFocus={addressInput.showSoftInputOnFocus}
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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
  helperText: {
    marginTop: -12,
    marginBottom: 12,
    color: '#61708a',
    fontSize: 12,
  },
  familyStatus: {
    color: '#5f6d8a',
    fontSize: 13,
    marginBottom: 10,
  },
  familyMatchButton: {
    borderWidth: 1,
    borderColor: '#d9dff5',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  familyMatchButtonSelected: {
    borderColor: '#4f6ef7',
    backgroundColor: '#eef2ff',
  },
  familyMatchTitle: {
    color: '#1a1a2e',
    fontWeight: '700',
    fontSize: 14,
  },
  familyMatchTitleSelected: {
    color: '#2f46c7',
  },
  familyMatchSubtitle: {
    color: '#586179',
    fontSize: 13,
    marginTop: 2,
  },
  familyMatchSubtitleSelected: {
    color: '#2f46c7',
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
