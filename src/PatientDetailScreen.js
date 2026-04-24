import React, { useState, useRef, useEffect } from 'react';
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

const Field = React.forwardRef(({ label, value, onChange, onFocus, multiline, keyboardType }, ref) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={ref}
      style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChange}
      onFocus={onFocus}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType}
      placeholderTextColor="#bbb"
      placeholder="—"
    />
  </View>
));

export default function PatientDetailScreen({ route }) {
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

  const activeIndexRef = useRef(0);
  const shouldAdvanceRef = useRef(false);
  const fabBottom = useRef(new Animated.Value(32)).current;

  useEffect(() => {
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
    return () => { show.remove(); hide.remove(); };
  }, []);

  const personalFields = [
    { ref: notesRef, setter: setNotes, value: notes, label: 'Notes', multiline: true },
  ];

  const rxFields = [
    { ref: complaintsRef,     setter: setComplaints,     value: complaints,     label: 'Complaints',            multiline: true  },
    { ref: diagnosisRef,      setter: setDiagnosis,      value: diagnosis,      label: 'Diagnosis',             multiline: true  },
    { ref: investigationsRef, setter: setInvestigations, value: investigations, label: 'Investigations',        multiline: true  },
    { ref: proceduresRef,     setter: setProcedures,     value: procedures,     label: 'Procedures',            multiline: true  },
    { ref: findingsRef,       setter: setFindings,       value: findings,       label: 'Findings',              multiline: true  },
    { ref: bpRef,             setter: setBp,             value: bp,             label: 'Blood Pressure (mmHg)', multiline: false },
    { ref: weightRef,         setter: setWeight,         value: weight,         label: 'Weight',                multiline: false, keyboardType: 'decimal-pad' },
  ];

  const currentFields = activeTab === 'Personal' ? personalFields : rxFields;

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
    if (shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      const next = (activeIndexRef.current + 1) % currentFields.length;
      activeIndexRef.current = next;
      currentFields[next]?.ref.current?.focus();
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    const field = currentFields[activeIndexRef.current];
    if (text && field) field.setter(text);
  });
  useSpeechRecognitionEvent('error', (event) => {
    Alert.alert('Dictation error', event.message ?? 'Something went wrong.');
    setRecognizing(false);
  });

  function handleTabChange(tab) {
    activeIndexRef.current = 0;
    setActiveTab(tab);
  }

  // Tap: start dictation, or stop + next field if already dictating
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

  // Hold: stop dictation without advancing
  function handleLongPress() {
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
    }
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
              onFocus={() => { activeIndexRef.current = i; }}
              multiline={f.multiline}
            />
          ))}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
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
                      onFocus={() => { activeIndexRef.current = i; }}
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
                  onFocus={() => { activeIndexRef.current = i; }}
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
