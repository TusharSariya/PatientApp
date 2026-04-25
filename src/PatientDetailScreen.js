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
  Modal,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { getMedicines, addMedicine, deleteMedicine } from './database';
import { GestureTriggerButton, useGestureTextInput } from './GestureInputProvider';

const ROUTES = ['Oral', 'Topical', 'IV', 'IM', 'Other'];

const EMPTY_FORM = { name: '', dosage: '', frequency: '', duration: '', route: 'Oral', instructions: '' };

function composeHandlers(...handlers) {
  return (...args) => {
    handlers.forEach(handler => handler?.(...args));
  };
}

function BottomSheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheet.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={sheet.container}>
          <View style={sheet.handle} />
          {title ? <Text style={sheet.title}>{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },
});

function MedicineCard({ medicine, onPress }) {
  const sub = [medicine.dosage, medicine.frequency].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={medCard.card} onPress={onPress} activeOpacity={0.75}>
      <View style={{ flex: 1 }}>
        <Text style={medCard.name}>{medicine.name}</Text>
        {sub ? <Text style={medCard.sub}>{sub}</Text> : null}
      </View>
      <Text style={medCard.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const medCard = StyleSheet.create({
  card: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#e0e4ff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  sub: { fontSize: 13, color: '#666', marginTop: 3 },
  chevron: { fontSize: 22, color: '#bbb', marginLeft: 8 },
});

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
  onGesturePress,
  multiline,
  keyboardType,
}, ref) => (
  <View style={styles.fieldGroup}>
    <View style={styles.fieldHeader}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <GestureTriggerButton onPress={onGesturePress} />
    </View>
    <TextInput
      ref={ref}
      style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChange}
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

  // Medicines
  const [medicines, setMedicines] = useState([]);
  const [detailSheet, setDetailSheet] = useState({ visible: false, med: null });
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [medForm, setMedForm] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);

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
  const medNameInput = useGestureTextInput({ label: 'Medicine Name', value: medForm.name, setValue: value => setMedForm(form => ({ ...form, name: value })) });
  const medDosageInput = useGestureTextInput({ label: 'Medicine Dosage', value: medForm.dosage, setValue: value => setMedForm(form => ({ ...form, dosage: value })) });
  const medFrequencyInput = useGestureTextInput({ label: 'Medicine Frequency', value: medForm.frequency, setValue: value => setMedForm(form => ({ ...form, frequency: value })) });
  const medDurationInput = useGestureTextInput({ label: 'Medicine Duration', value: medForm.duration, setValue: value => setMedForm(form => ({ ...form, duration: value })) });
  const medInstructionsInput = useGestureTextInput({ label: 'Medicine Instructions', value: medForm.instructions, setValue: value => setMedForm(form => ({ ...form, instructions: value })) });

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

  useEffect(() => {
    getMedicines(patient.id).then(setMedicines).catch(() => {});
  }, [patient.id]);

  const personalFields = [
    { ref: notesRef, setter: setNotes, value: notes, label: 'Notes', multiline: true, input: notesInput },
  ];

  const rxFields = [
    { ref: complaintsRef,     setter: setComplaints,     value: complaints,     label: 'Complaints',            multiline: true,  input: complaintsInput     },
    { ref: diagnosisRef,      setter: setDiagnosis,      value: diagnosis,      label: 'Diagnosis',             multiline: true,  input: diagnosisInput      },
    { ref: investigationsRef, setter: setInvestigations, value: investigations, label: 'Investigations',        multiline: true,  input: investigationsInput },
    { ref: proceduresRef,     setter: setProcedures,     value: procedures,     label: 'Procedures',            multiline: true,  input: proceduresInput     },
    { ref: findingsRef,       setter: setFindings,       value: findings,       label: 'Findings',              multiline: true,  input: findingsInput       },
    { ref: bpRef,             setter: setBp,             value: bp,             label: 'Blood Pressure (mmHg)', multiline: false, input: bpInput             },
    { ref: weightRef,         setter: setWeight,         value: weight,         label: 'Weight',                multiline: false, keyboardType: 'decimal-pad', input: weightInput },
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

  async function handleAddMedicine() {
    if (!medForm.name.trim()) {
      Alert.alert('Required', 'Medicine name is required.');
      return;
    }
    setAddLoading(true);
    try {
      const fields = {
        name: medForm.name.trim(),
        dosage: medForm.dosage.trim(),
        frequency: medForm.frequency.trim(),
        duration: medForm.duration.trim(),
        route: medForm.route,
        instructions: medForm.instructions.trim(),
      };
      const id = await addMedicine(patient.id, fields);
      setMedicines(prev => [...prev, { id, patient_id: patient.id, ...fields }]);
      setAddSheetVisible(false);
      setMedForm(EMPTY_FORM);
    } catch {
      Alert.alert('Error', 'Failed to save medicine.');
    } finally {
      setAddLoading(false);
    }
  }

  function handleDeleteMedicine(id) {
    Alert.alert('Delete Medicine', 'Remove this medicine?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMedicine(id);
          setMedicines(prev => prev.filter(m => m.id !== id));
          setDetailSheet({ visible: false, med: null });
        },
      },
    ]);
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
              onGesturePress={() => {
                activeIndexRef.current = i;
                f.input.openGestureInput();
              }}
              multiline={f.multiline}
            />
          ))}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
            {/* Medicines */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Medicines</Text>
              <TouchableOpacity style={styles.addMedBtn} onPress={() => setAddSheetVisible(true)}>
                <Text style={styles.addMedBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {medicines.length === 0 ? (
              <Text style={styles.noMeds}>No medicines added yet.</Text>
            ) : (
              medicines.map(med => (
                <MedicineCard
                  key={med.id}
                  medicine={med}
                  onPress={() => setDetailSheet({ visible: true, med })}
                />
              ))
            )}

            <View style={styles.divider} />

            {rxFields.map((f, i) =>
              f.label === 'Weight' ? (
                <View key={f.label} style={styles.fieldGroup}>
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>Weight</Text>
                    <GestureTriggerButton onPress={() => {
                      activeIndexRef.current = i;
                      f.input.openGestureInput();
                    }} />
                  </View>
                  <View style={styles.weightRow}>
                    <TextInput
                      ref={f.ref}
                      style={[styles.fieldInput, styles.weightInput]}
                      value={f.value}
                      onChangeText={f.setter}
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
                  onGesturePress={() => {
                    activeIndexRef.current = i;
                    f.input.openGestureInput();
                  }}
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

      {/* Medicine detail sheet */}
      <BottomSheet
        visible={detailSheet.visible}
        onClose={() => setDetailSheet({ visible: false, med: null })}
        title={detailSheet.med?.name}
      >
        {detailSheet.med && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Dosage',       value: detailSheet.med.dosage },
              { label: 'Frequency',    value: detailSheet.med.frequency },
              { label: 'Duration',     value: detailSheet.med.duration },
              { label: 'Route',        value: detailSheet.med.route },
              { label: 'Instructions', value: detailSheet.med.instructions },
            ].map(({ label, value }) =>
              value ? (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ) : null
            )}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeleteMedicine(detailSheet.med.id)}
            >
              <Text style={styles.deleteBtnText}>Delete Medicine</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Add medicine sheet */}
      <BottomSheet
        visible={addSheetVisible}
        onClose={() => { setAddSheetVisible(false); setMedForm(EMPTY_FORM); }}
        title="Add Medicine"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>Name *</Text>
            <GestureTriggerButton onPress={medNameInput.openGestureInput} />
          </View>
          <TextInput
            ref={medNameInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.name}
            onChangeText={v => setMedForm(f => ({ ...f, name: v }))}
            onFocus={medNameInput.onFocus}
            onBlur={medNameInput.onBlur}
            onSelectionChange={medNameInput.onSelectionChange}
            selection={medNameInput.selection}
            placeholder="e.g. Amoxicillin"
            placeholderTextColor="#bbb"
            autoCapitalize="words"
          />

          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>Dosage</Text>
            <GestureTriggerButton onPress={medDosageInput.openGestureInput} />
          </View>
          <TextInput
            ref={medDosageInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.dosage}
            onChangeText={v => setMedForm(f => ({ ...f, dosage: v }))}
            onFocus={medDosageInput.onFocus}
            onBlur={medDosageInput.onBlur}
            onSelectionChange={medDosageInput.onSelectionChange}
            selection={medDosageInput.selection}
            placeholder="e.g. 500mg"
            placeholderTextColor="#bbb"
          />

          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>Frequency</Text>
            <GestureTriggerButton onPress={medFrequencyInput.openGestureInput} />
          </View>
          <TextInput
            ref={medFrequencyInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.frequency}
            onChangeText={v => setMedForm(f => ({ ...f, frequency: v }))}
            onFocus={medFrequencyInput.onFocus}
            onBlur={medFrequencyInput.onBlur}
            onSelectionChange={medFrequencyInput.onSelectionChange}
            selection={medFrequencyInput.selection}
            placeholder="e.g. Twice daily"
            placeholderTextColor="#bbb"
          />

          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>Duration</Text>
            <GestureTriggerButton onPress={medDurationInput.openGestureInput} />
          </View>
          <TextInput
            ref={medDurationInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.duration}
            onChangeText={v => setMedForm(f => ({ ...f, duration: v }))}
            onFocus={medDurationInput.onFocus}
            onBlur={medDurationInput.onBlur}
            onSelectionChange={medDurationInput.onSelectionChange}
            selection={medDurationInput.selection}
            placeholder="e.g. 7 days"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.fieldLabel}>Route</Text>
          <View style={styles.routeRow}>
            {ROUTES.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.routeChip, medForm.route === r && styles.routeChipActive]}
                onPress={() => setMedForm(f => ({ ...f, route: r }))}
              >
                <Text style={[styles.routeChipText, medForm.route === r && styles.routeChipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>Instructions</Text>
            <GestureTriggerButton onPress={medInstructionsInput.openGestureInput} />
          </View>
          <TextInput
            ref={medInstructionsInput.ref}
            style={[styles.fieldInput, styles.fieldInputMultiline, { marginBottom: 24 }]}
            value={medForm.instructions}
            onChangeText={v => setMedForm(f => ({ ...f, instructions: v }))}
            onFocus={medInstructionsInput.onFocus}
            onBlur={medInstructionsInput.onBlur}
            onSelectionChange={medInstructionsInput.onSelectionChange}
            selection={medInstructionsInput.selection}
            placeholder="e.g. Take after meals"
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveBtn, addLoading && { opacity: 0.6 }]}
            onPress={handleAddMedicine}
            disabled={addLoading}
          >
            <Text style={styles.saveBtnText}>{addLoading ? 'Saving…' : 'Save Medicine'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
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
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  divider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginVertical: 24,
  },
  // Medicines section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  addMedBtn: {
    backgroundColor: '#4f6ef7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addMedBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noMeds: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
  },
  // Detail sheet
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1a1a2e',
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  deleteBtnText: {
    color: '#e74c3c',
    fontWeight: '600',
    fontSize: 15,
  },
  // Add medicine form
  routeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  routeChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  routeChipActive: {
    backgroundColor: '#4f6ef7',
    borderColor: '#4f6ef7',
  },
  routeChipText: {
    fontSize: 14,
    color: '#666',
  },
  routeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // FAB
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
