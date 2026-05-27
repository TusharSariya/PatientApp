import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Keyboard,
  Animated,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useFocusEffect } from '@react-navigation/native';
import { clearDictationOwner, getDictationOwner, setDictationOwner } from './dictationOwner';
import { useGestureTextInput } from './GestureInputProvider';
import { formatMoney } from './currency';
import {
  getAppSettings,
  getBalanceSummary,
  searchFamiliesByRelativeName,
  updatePatient,
  updatePatientFamily,
} from './database';
import { formatPatientAge } from './patientAge';
import { formatPatientNameParts, splitPatientName } from './patientName';

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function insertDictationAtSelection(currentValue, selection, transcript) {
  const source = currentValue ?? '';
  const phrase = transcript ?? '';
  const start = clamp(selection?.start ?? source.length, 0, source.length);
  const end = clamp(selection?.end ?? start, start, source.length);
  const before = source.slice(0, start);
  const after = source.slice(end);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before) && !/^\s/.test(phrase);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after) && !/\s$/.test(phrase);
  const inserted = `${needsLeadingSpace ? ' ' : ''}${phrase}${needsTrailingSpace ? ' ' : ''}`;

  return {
    value: `${before}${inserted}${after}`,
    cursor: before.length + inserted.length,
  };
}

function composeHandlers(...handlers) {
  return (...args) => {
    handlers.forEach(handler => handler?.(...args));
  };
}

function buildPatientForm(patient) {
  const parsedName = splitPatientName(patient.name ?? '');
  return {
    firstName: patient.first_name ?? parsedName.firstName,
    middleName: patient.middle_name ?? parsedName.middleName,
    lastName: patient.last_name ?? parsedName.lastName,
    dob: patient.dob ?? '',
    phone: patient.phone ?? '',
    address: patient.address ?? '',
    notes: patient.notes ?? '',
  };
}

function patientFromForm(patient, form) {
  return {
    ...patient,
    first_name: form.firstName,
    middle_name: form.middleName,
    last_name: form.lastName,
    name: formatPatientNameParts(form.firstName, form.middleName, form.lastName),
    dob: form.dob,
    phone: form.phone,
    address: form.address,
    notes: form.notes,
  };
}

const Field = React.forwardRef(({
  label,
  value,
  onChange,
  editable,
  onFocus,
  onBlur,
  onSelectionChange,
  selection,
  showSoftInputOnFocus,
  multiline,
  keyboardType,
  testID,
}, ref) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={ref}
      testID={testID}
      style={[styles.fieldInput, !editable && styles.fieldInputReadOnly, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChange}
      editable={editable}
      showSoftInputOnFocus={editable ? showSoftInputOnFocus : false}
      onFocus={onFocus}
      onBlur={onBlur}
      onSelectionChange={onSelectionChange}
      selection={selection}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor="#bbb"
      placeholder="—"
    />
  </View>
));

export default function PatientDetailScreen({ route, navigation }) {
  const { patient } = route.params;
  const [savedPatient, setSavedPatient] = useState(patient);
  const [form, setForm] = useState(() => buildPatientForm(patient));
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const patientAge = formatPatientAge(form.dob);
  const displayedName = formatPatientNameParts(form.firstName, form.middleName, form.lastName) || savedPatient.name;
  const [recognizing, setRecognizing] = useState(false);
  const [balances, setBalances] = useState({ patientBalance: 0, familyBalance: 0 });
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [familyQuery, setFamilyQuery] = useState('');
  const [familyMatches, setFamilyMatches] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [searchingFamilies, setSearchingFamilies] = useState(false);

  const notesRef = useRef(null);
  const setNotes = (value) => setForm((current) => ({ ...current, notes: value }));
  const notesInput = useGestureTextInput({ label: 'Notes', value: form.notes, setValue: setNotes, inputRef: notesRef });

  const dictationFields = [
    { ref: notesRef, setter: setNotes, value: form.notes, label: 'Notes', multiline: true, input: notesInput },
  ];

  const activeIndexRef = useRef(0);
  const shouldAdvanceRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const fabBottom = useRef(new Animated.Value(32)).current;
  const dictationOwner = 'patient-detail';

  React.useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => Animated.timing(fabBottom, {
        toValue: e.endCoordinates.height + 16,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start()
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => Animated.timing(fabBottom, {
        toValue: 32,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start()
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [fabBottom]);

  React.useEffect(() => {
    setSavedPatient(patient);
    setForm(buildPatientForm(patient));
    setDetailsExpanded(false);
    setEditing(false);
    setRecognizing(false);
    setFamilyQuery('');
    setFamilyMatches([]);
    setSelectedFamily(null);
  }, [patient]);

  React.useEffect(() => {
    if (!editing) return undefined;

    let isActive = true;
    const query = familyQuery.trim();
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
  }, [editing, familyQuery]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        const [summary, settings] = await Promise.all([
          getBalanceSummary(savedPatient.id),
          getAppSettings(),
        ]);
        if (isActive) {
          setBalances({
            patientBalance: summary.patientBalance ?? 0,
            familyBalance: summary.familyBalance ?? 0,
          });
          setCurrencyCode(settings.currencyCode);
        }
      })().catch(() => {});
      return () => {
        isActive = false;
      };
    }, [savedPatient.id])
  );

  useSpeechRecognitionEvent('start', () => {
    if (getDictationOwner() !== dictationOwner) return;
    lastTranscriptRef.current = '';
    setRecognizing(true);
  });
  useSpeechRecognitionEvent('end', () => {
    if (getDictationOwner() !== dictationOwner) return;
    clearDictationOwner(dictationOwner);
    lastTranscriptRef.current = '';
    setRecognizing(false);
    if (shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      const next = (activeIndexRef.current + 1) % dictationFields.length;
      activeIndexRef.current = next;
      dictationFields[next]?.ref.current?.focus();
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (getDictationOwner() !== dictationOwner) return;
    const text = (event.results[0]?.transcript ?? '').trim();
    const field = dictationFields[activeIndexRef.current];
    if (!text || !field) return;

    if (text === lastTranscriptRef.current) return;
    let chunk = text;
    if (text.startsWith(lastTranscriptRef.current)) {
      chunk = text.slice(lastTranscriptRef.current.length).trimStart();
    }
    lastTranscriptRef.current = text;
    if (!chunk) return;

    if (!editing) return;
    const next = insertDictationAtSelection(field.value, field.input.selection, chunk);
    field.setter(next.value);
    field.input.setSelection?.({ start: next.cursor, end: next.cursor });
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (getDictationOwner() !== dictationOwner) return;
    clearDictationOwner(dictationOwner);
    Alert.alert('Dictation error', event.message ?? 'Something went wrong.');
    setRecognizing(false);
  });

  function openMedicines() {
    navigation.navigate('PatientMedicines', { patient: savedPatient });
  }

  function openVisits() {
    navigation.navigate('PatientVisits', { patient: savedPatient });
  }

  async function handlePress() {
    if (!editing) return;
    if (recognizing) {
      shouldAdvanceRef.current = true;
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed for dictation.');
      return;
    }
    setDictationOwner(dictationOwner);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  }

  function handleLongPress() {
    if (recognizing) ExpoSpeechRecognitionModule.stop();
  }

  function updateFormField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleDetailsExpanded() {
    if (editing) return;
    setDetailsExpanded((expanded) => !expanded);
  }

  async function handleDetailsAction() {
    if (!editing) {
      setFamilyQuery('');
      setFamilyMatches([]);
      setSelectedFamily(null);
      setEditing(true);
      return;
    }

    const nextForm = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      lastName: form.lastName.trim(),
      dob: form.dob.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    };

    if (!nextForm.firstName || !nextForm.lastName) {
      Alert.alert('Missing Fields', 'Please fill in first name and last name.');
      return;
    }
    if (familyQuery.trim() && !selectedFamily) {
      Alert.alert('Select Family', 'Choose a matching family from the list, or clear the family search.');
      return;
    }

    setSavingDetails(true);
    try {
      let nextFamilyId = savedPatient.family_id;
      if (selectedFamily && selectedFamily.family_id !== savedPatient.family_id) {
        const familyResult = await updatePatientFamily(savedPatient.id, String(selectedFamily.family_id));
        nextFamilyId = familyResult.familyId;
      }
      await updatePatient(savedPatient.id, nextForm);
      const nextPatient = {
        ...patientFromForm(savedPatient, nextForm),
        family_id: nextFamilyId,
      };
      setSavedPatient(nextPatient);
      setForm(nextForm);
      setFamilyQuery('');
      setFamilyMatches([]);
      setSelectedFamily(null);
      setEditing(false);
      navigation.setParams?.({ patient: nextPatient });
      const summary = await getBalanceSummary(savedPatient.id);
      setBalances({
        patientBalance: summary.patientBalance ?? 0,
        familyBalance: summary.familyBalance ?? 0,
      });
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Failed to update patient details.');
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.name}>{displayedName}</Text>
          {savedPatient.family_id ? <Text style={styles.detail}>Family #{savedPatient.family_id}</Text> : null}
          {patientAge ? <Text style={styles.ageDetail}>{patientAge}</Text> : null}
          <Text style={styles.detail}>Patient Balance: {formatMoney(balances.patientBalance, currencyCode)}</Text>
          <Text style={styles.detail}>Family Balance: {formatMoney(balances.familyBalance, currencyCode)}</Text>
        </View>

        <TouchableOpacity
          style={styles.medCard}
          onPress={toggleDetailsExpanded}
          activeOpacity={0.8}
          testID="patient-details-menu-card"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.medTitle}>Patient Details</Text>
            <Text style={styles.medSubtitle}>View demographics, contact details, age, and notes.</Text>
          </View>
          <View style={styles.medButton}>
            <Text style={styles.medButtonText}>{detailsExpanded ? 'Close' : 'Open'}</Text>
          </View>
        </TouchableOpacity>

        {detailsExpanded ? (
          <View style={styles.detailsPanel} testID="patient-details-panel">
            <Field
              label="First Name"
              testID="patient-detail-first-name"
              value={form.firstName}
              onChange={(value) => updateFormField('firstName', value)}
              editable={editing}
            />
            <Field
              label="Middle Name"
              testID="patient-detail-middle-name"
              value={form.middleName}
              onChange={(value) => updateFormField('middleName', value)}
              editable={editing}
            />
            <Field
              label="Last Name"
              testID="patient-detail-last-name"
              value={form.lastName}
              onChange={(value) => updateFormField('lastName', value)}
              editable={editing}
            />
            <Field
              label="Date of Birth"
              testID="patient-detail-dob"
              value={form.dob}
              onChange={(value) => updateFormField('dob', value)}
              editable={editing}
            />
            {patientAge ? <Text style={styles.ageDetail}>{patientAge}</Text> : null}
            <Field
              label="Phone"
              testID="patient-detail-phone"
              value={form.phone}
              onChange={(value) => updateFormField('phone', value)}
              editable={editing}
              keyboardType="phone-pad"
            />
            <Field
              label="Address"
              testID="patient-detail-address"
              value={form.address}
              onChange={(value) => updateFormField('address', value)}
              editable={editing}
              multiline
            />
            <Field
              ref={notesRef}
              label="Notes"
              testID="patient-detail-notes"
              value={form.notes}
              onChange={setNotes}
              editable={editing}
              onFocus={composeHandlers(notesInput.onFocus, () => { activeIndexRef.current = 0; })}
              onBlur={notesInput.onBlur}
              onSelectionChange={notesInput.onSelectionChange}
              selection={notesInput.selection}
              showSoftInputOnFocus={notesInput.showSoftInputOnFocus}
              multiline
            />
            <View style={styles.familySection}>
              <Text style={styles.fieldLabel}>Family</Text>
              <Text style={styles.familyCurrentText}>
                {savedPatient.family_id ? `Family #${savedPatient.family_id}` : 'No family assigned'}
              </Text>
              {editing ? (
                <>
                  <TextInput
                    testID="patient-detail-family-search"
                    style={styles.fieldInput}
                    value={familyQuery}
                    onChangeText={(value) => {
                      setFamilyQuery(value);
                      setSelectedFamily(null);
                    }}
                    placeholder="Search relative name"
                    placeholderTextColor="#bbb"
                    autoCapitalize="words"
                  />
                  <Text style={styles.familyHint}>
                    Moving from another family requires zero patient balance.
                  </Text>
                  {searchingFamilies ? <Text style={styles.familyStatus}>Searching families...</Text> : null}
                  {!searchingFamilies && familyQuery.trim() && familyMatches.length === 0 ? (
                    <Text style={styles.familyStatus}>No family matches found.</Text>
                  ) : null}
                  {familyMatches.map((match) => {
                    const isSelected = selectedFamily?.family_id === match.family_id;
                    return (
                      <TouchableOpacity
                        key={match.family_id}
                        style={[styles.familyMatchButton, isSelected && styles.familyMatchButtonSelected]}
                        onPress={() => {
                          setSelectedFamily(match);
                          setFamilyQuery(match.relative_name);
                        }}
                        activeOpacity={0.8}
                        testID={`patient-detail-family-match-${match.family_id}`}
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
                </>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.detailsActionButton, savingDetails && styles.detailsActionButtonDisabled]}
              onPress={handleDetailsAction}
              disabled={savingDetails}
              testID="patient-detail-edit-save-button"
            >
              <Text style={styles.detailsActionButtonText}>
                {savingDetails ? 'Saving...' : editing ? 'Save' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity testID="patient-visits-card" style={[styles.medCard, { marginTop: 10 }]} onPress={openVisits} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.medTitle}>Visits</Text>
            <Text style={styles.medSubtitle}>View visit history and create a new visit.</Text>
          </View>
          <View style={styles.medButton}>
            <Text style={styles.medButtonText}>Open</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity testID="patient-medicines-card" style={[styles.medCard, { marginTop: 10 }]} onPress={openMedicines} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.medTitle}>Medicines</Text>
            <Text style={styles.medSubtitle}>View current medicines and history.</Text>
          </View>
          <View style={styles.medButton}>
            <Text style={styles.medButtonText}>Open</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {editing ? (
        <Animated.View style={[styles.fab, { bottom: fabBottom }]}>
        <Pressable
          style={[styles.fabInner, recognizing && styles.fabActive]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={500}
        >
          <Text style={styles.fabIcon}>{recognizing ? '⏹' : '🎙'}</Text>
        </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  content: {
    padding: 24,
    paddingBottom: 100,
    flexGrow: 1,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  detail: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  ageDetail: {
    backgroundColor: '#f3f6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2f7',
    color: '#2f46c7',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  medCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce2f7',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  medTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  medSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5f6d8a',
  },
  medButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  medButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  detailsPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce2f7',
    marginTop: 10,
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  fieldInputReadOnly: {
    backgroundColor: '#f7f8fc',
    color: '#5f6d8a',
  },
  fieldInputMultiline: {
    height: 88,
    textAlignVertical: 'top',
  },
  familySection: {
    marginBottom: 20,
  },
  familyCurrentText: {
    backgroundColor: '#f7f8fc',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    color: '#5f6d8a',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  familyHint: {
    color: '#5f6d8a',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  familyStatus: {
    color: '#5f6d8a',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  familyMatchButton: {
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#f7f9ff',
  },
  familyMatchButtonSelected: {
    backgroundColor: '#4f6ef7',
    borderColor: '#4f6ef7',
  },
  familyMatchTitle: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '700',
  },
  familyMatchTitleSelected: {
    color: '#fff',
  },
  familyMatchSubtitle: {
    color: '#5f6d8a',
    fontSize: 13,
    marginTop: 4,
  },
  familyMatchSubtitleSelected: {
    color: '#edf1ff',
  },
  detailsActionButton: {
    marginTop: 4,
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailsActionButtonDisabled: {
    opacity: 0.6,
  },
  detailsActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#4f6ef7',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabInner: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: '#4f6ef7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabActive: {
    backgroundColor: '#e74c3c',
  },
  fabIcon: {
    fontSize: 28,
  },
});
