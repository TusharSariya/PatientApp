import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Animated,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useGestureTextInput } from './GestureInputProvider';

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

function TabBar({ active, onChange }) {
  const tabs = ['Personal', 'Rx'];
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, active === tab && styles.tabActive]}
          onPress={() => onChange(tab)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const Field = React.forwardRef(({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  onSelectionChange,
  selection,
  showSoftInputOnFocus,
  multiline,
  keyboardType,
}, ref) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={ref}
      style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChange}
      showSoftInputOnFocus={showSoftInputOnFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onSelectionChange={onSelectionChange}
      selection={selection}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType}
      placeholderTextColor="#bbb"
      placeholder="—"
    />
  </View>
));

export default function PatientDetailScreen({ route, navigation }) {
  const { patient } = route.params;
  const [activeTab, setActiveTab] = useState('Personal');
  const [recognizing, setRecognizing] = useState(false);

  // Personal fields
  const [notes, setNotes] = useState('');

  // Rx fields
  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [procedures, setProcedures] = useState('');
  const [findings, setFindings] = useState('');
  const [bp, setBp] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');

  // Refs
  const notesRef = useRef(null);
  const complaintsRef = useRef(null);
  const diagnosisRef = useRef(null);
  const investigationsRef = useRef(null);
  const proceduresRef = useRef(null);
  const findingsRef = useRef(null);
  const bpRef = useRef(null);
  const weightRef = useRef(null);

  const notesInput = useGestureTextInput({ label: 'Notes', value: notes, setValue: setNotes, inputRef: notesRef });
  const complaintsInput = useGestureTextInput({ label: 'Complaints', value: complaints, setValue: setComplaints, inputRef: complaintsRef });
  const diagnosisInput = useGestureTextInput({ label: 'Diagnosis', value: diagnosis, setValue: setDiagnosis, inputRef: diagnosisRef });
  const investigationsInput = useGestureTextInput({ label: 'Investigations', value: investigations, setValue: setInvestigations, inputRef: investigationsRef });
  const proceduresInput = useGestureTextInput({ label: 'Procedures', value: procedures, setValue: setProcedures, inputRef: proceduresRef });
  const findingsInput = useGestureTextInput({ label: 'Findings', value: findings, setValue: setFindings, inputRef: findingsRef });
  const bpInput = useGestureTextInput({ label: 'Blood Pressure', value: bp, setValue: setBp, inputRef: bpRef });
  const weightInput = useGestureTextInput({ label: 'Weight', value: weight, setValue: setWeight, inputRef: weightRef });

  const activeIndexRef = useRef(0);
  const shouldAdvanceRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const fabBottom = useRef(new Animated.Value(32)).current;

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

  const personalFields = [
    { ref: notesRef, setter: setNotes, value: notes, label: 'Notes', multiline: true, input: notesInput },
  ];

  const rxFields = [
    { ref: complaintsRef, setter: setComplaints, value: complaints, label: 'Complaints', multiline: true, input: complaintsInput },
    { ref: diagnosisRef, setter: setDiagnosis, value: diagnosis, label: 'Diagnosis', multiline: true, input: diagnosisInput },
    { ref: investigationsRef, setter: setInvestigations, value: investigations, label: 'Investigations', multiline: true, input: investigationsInput },
    { ref: proceduresRef, setter: setProcedures, value: procedures, label: 'Procedures', multiline: true, input: proceduresInput },
    { ref: findingsRef, setter: setFindings, value: findings, label: 'Findings', multiline: true, input: findingsInput },
    { ref: bpRef, setter: setBp, value: bp, label: 'Blood Pressure (mmHg)', multiline: false, input: bpInput },
    { ref: weightRef, setter: setWeight, value: weight, label: 'Weight', multiline: false, keyboardType: 'decimal-pad', input: weightInput },
  ];

  const currentFields = activeTab === 'Personal' ? personalFields : rxFields;

  useSpeechRecognitionEvent('start', () => {
    lastTranscriptRef.current = '';
    setRecognizing(true);
  });
  useSpeechRecognitionEvent('end', () => {
    lastTranscriptRef.current = '';
    setRecognizing(false);
    if (shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      const next = (activeIndexRef.current + 1) % currentFields.length;
      activeIndexRef.current = next;
      currentFields[next]?.ref.current?.focus();
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = (event.results[0]?.transcript ?? '').trim();
    const field = currentFields[activeIndexRef.current];
    if (!text || !field) return;

    if (text === lastTranscriptRef.current) return;
    let chunk = text;
    if (text.startsWith(lastTranscriptRef.current)) {
      chunk = text.slice(lastTranscriptRef.current.length).trimStart();
    }
    lastTranscriptRef.current = text;
    if (!chunk) return;

    const next = insertDictationAtSelection(field.value, field.input.selection, chunk);
    field.setter(next.value);
    field.input.setSelection?.({ start: next.cursor, end: next.cursor });
  });
  useSpeechRecognitionEvent('error', (event) => {
    Alert.alert('Dictation error', event.message ?? 'Something went wrong.');
    setRecognizing(false);
  });

  function handleTabChange(tab) {
    activeIndexRef.current = 0;
    setActiveTab(tab);
  }

  function openMedicines() {
    navigation.navigate('PatientMedicines', { patient });
  }

  async function handlePress() {
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
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  }

  function handleLongPress() {
    if (recognizing) ExpoSpeechRecognitionModule.stop();
  }

  return (
    <View style={styles.container}>
      <TabBar active={activeTab} onChange={handleTabChange} />

      {activeTab === 'Personal' ? (
        <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
          <View style={styles.infoCard}>
            <Text style={styles.name}>{patient.name}</Text>
            <Text style={styles.detail}>📞 {patient.phone}</Text>
            <Text style={styles.detail}>📍 {patient.address}</Text>
          </View>
          {personalFields.map((f, i) => (
            <Field
              key={f.label}
              ref={f.ref}
              label={f.label}
              value={f.value}
              onChange={f.setter}
              onFocus={composeHandlers(f.input.onFocus, () => { activeIndexRef.current = i; })}
              onBlur={f.input.onBlur}
              onSelectionChange={f.input.onSelectionChange}
              selection={f.input.selection}
              showSoftInputOnFocus={f.input.showSoftInputOnFocus}
              multiline={f.multiline}
            />
          ))}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
            <View style={styles.medCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medTitle}>Medicines</Text>
                <Text style={styles.medSubtitle}>Open full list, add/remove meds, and view previous medicine history.</Text>
              </View>
              <TouchableOpacity style={styles.medButton} onPress={openMedicines}>
                <Text style={styles.medButtonText}>Open</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {rxFields.map((f, i) =>
              f.label === 'Weight' ? (
                <View key={f.label} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Weight</Text>
                  <View style={styles.weightRow}>
                    <TextInput
                      ref={f.ref}
                      style={[styles.fieldInput, styles.weightInput]}
                      value={f.value}
                      onChangeText={f.setter}
                      showSoftInputOnFocus={f.input.showSoftInputOnFocus}
                      onFocus={composeHandlers(f.input.onFocus, () => { activeIndexRef.current = i; })}
                      onBlur={f.input.onBlur}
                      onSelectionChange={f.input.onSelectionChange}
                      selection={f.input.selection}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor="#bbb"
                    />
                    <View style={styles.unitToggle}>
                      {['kg', 'lbs'].map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[styles.unitBtn, weightUnit === unit && styles.unitBtnActive]}
                          onPress={() => setWeightUnit(unit)}
                        >
                          <Text style={[styles.unitBtnText, weightUnit === unit && styles.unitBtnTextActive]}>
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <Field
                  key={f.label}
                  ref={f.ref}
                  label={f.label}
                  value={f.value}
                  onChange={f.setter}
                  onFocus={composeHandlers(f.input.onFocus, () => { activeIndexRef.current = i; })}
                  onBlur={f.input.onBlur}
                  onSelectionChange={f.input.onSelectionChange}
                  selection={f.input.selection}
                  showSoftInputOnFocus={f.input.showSoftInputOnFocus}
                  multiline={f.multiline}
                  keyboardType={f.keyboardType}
                />
              )
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4f6ef7',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#4f6ef7',
  },
  tabContent: {
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
  divider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginVertical: 24,
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
  fieldInputMultiline: {
    height: 88,
    textAlignVertical: 'top',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  unitBtnActive: {
    backgroundColor: '#4f6ef7',
  },
  unitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  unitBtnTextActive: {
    color: '#fff',
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
