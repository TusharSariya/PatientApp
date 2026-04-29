import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  addMedicine,
  deleteMedicine,
  getMedicineHistory,
  getMedicines,
} from './database';
import { useGestureTextInput } from './GestureInputProvider';

const ROUTES = ['Oral', 'Topical', 'IV', 'IM', 'Other'];
const EMPTY_FORM = { name: '', dosage: '', frequency: '', duration: '', route: 'Oral', instructions: '' };

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
    <TouchableOpacity style={styles.medCard} onPress={onPress} activeOpacity={0.75}>
      <View style={{ flex: 1 }}>
        <Text style={styles.medName}>{medicine.name}</Text>
        {sub ? <Text style={styles.medSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.medChevron}>›</Text>
    </TouchableOpacity>
  );
}

function formatHistoryTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildHistoryLine(item) {
  const action = item.action === 'removed' ? 'Removed' : 'Added';
  const parts = [item.name, item.dosage, item.frequency].filter(Boolean);
  return `${action}: ${parts.join(' · ') || item.name}`;
}

export default function PatientMedicinesScreen({ route }) {
  const { patient } = route.params;

  const [medicines, setMedicines] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailSheet, setDetailSheet] = useState({ visible: false, med: null });
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [medForm, setMedForm] = useState(EMPTY_FORM);

  const medNameRef = useRef(null);
  const medDosageRef = useRef(null);
  const medFrequencyRef = useRef(null);
  const medDurationRef = useRef(null);
  const medInstructionsRef = useRef(null);

  const medNameInput = useGestureTextInput({ label: 'Medicine Name', value: medForm.name, setValue: value => setMedForm(form => ({ ...form, name: value })), inputRef: medNameRef });
  const medDosageInput = useGestureTextInput({ label: 'Medicine Dosage', value: medForm.dosage, setValue: value => setMedForm(form => ({ ...form, dosage: value })), inputRef: medDosageRef });
  const medFrequencyInput = useGestureTextInput({ label: 'Medicine Frequency', value: medForm.frequency, setValue: value => setMedForm(form => ({ ...form, frequency: value })), inputRef: medFrequencyRef });
  const medDurationInput = useGestureTextInput({ label: 'Medicine Duration', value: medForm.duration, setValue: value => setMedForm(form => ({ ...form, duration: value })), inputRef: medDurationRef });
  const medInstructionsInput = useGestureTextInput({ label: 'Medicine Instructions', value: medForm.instructions, setValue: value => setMedForm(form => ({ ...form, instructions: value })), inputRef: medInstructionsRef });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [medicineRows, historyRows] = await Promise.all([
        getMedicines(patient.id),
        getMedicineHistory(patient.id),
      ]);
      setMedicines(medicineRows);
      setHistory(historyRows);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  async function handleAddMedicine() {
    if (!medForm.name.trim()) {
      Alert.alert('Required', 'Medicine name is required.');
      return;
    }

    setAddLoading(true);
    try {
      await addMedicine(patient.id, {
        name: medForm.name.trim(),
        dosage: medForm.dosage.trim(),
        frequency: medForm.frequency.trim(),
        duration: medForm.duration.trim(),
        route: medForm.route,
        instructions: medForm.instructions.trim(),
      });
      setAddSheetVisible(false);
      setMedForm(EMPTY_FORM);
      await loadData();
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
          setDetailSheet({ visible: false, med: null });
          await loadData();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.patientCard}>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientDetail}>📞 {patient.phone}</Text>
          <Text style={styles.patientDetail}>📍 {patient.address}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Current Medicines</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setAddSheetVisible(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 36 }} size="large" color="#4f6ef7" />
        ) : medicines.length === 0 ? (
          <Text style={styles.empty}>No active medicines.</Text>
        ) : (
          medicines.map((med) => (
            <MedicineCard
              key={med.id}
              medicine={med}
              onPress={() => setDetailSheet({ visible: true, med })}
            />
          ))
        )}

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Medicine History</Text>
        </View>
        {history.length === 0 ? (
          <Text style={styles.empty}>No history yet.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <Text style={styles.historyAction}>{buildHistoryLine(item)}</Text>
              <Text style={styles.historyTime}>{formatHistoryTimestamp(item.created_at)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={detailSheet.visible}
        onClose={() => setDetailSheet({ visible: false, med: null })}
        title={detailSheet.med?.name}
      >
        {detailSheet.med && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Dosage', value: detailSheet.med.dosage },
              { label: 'Frequency', value: detailSheet.med.frequency },
              { label: 'Duration', value: detailSheet.med.duration },
              { label: 'Route', value: detailSheet.med.route },
              { label: 'Instructions', value: detailSheet.med.instructions },
            ].map(({ label, value }) => (
              value ? (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ) : null
            ))}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeleteMedicine(detailSheet.med.id)}
            >
              <Text style={styles.deleteBtnText}>Delete Medicine</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </BottomSheet>

      <BottomSheet
        visible={addSheetVisible}
        onClose={() => {
          setAddSheetVisible(false);
          setMedForm(EMPTY_FORM);
        }}
        title="Add Medicine"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            ref={medNameInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.name}
            onChangeText={v => setMedForm(f => ({ ...f, name: v }))}
            showSoftInputOnFocus={medNameInput.showSoftInputOnFocus}
            onFocus={medNameInput.onFocus}
            onBlur={medNameInput.onBlur}
            onSelectionChange={medNameInput.onSelectionChange}
            selection={medNameInput.selection}
            placeholder="e.g. Amoxicillin"
            placeholderTextColor="#bbb"
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Dosage</Text>
          <TextInput
            ref={medDosageInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.dosage}
            onChangeText={v => setMedForm(f => ({ ...f, dosage: v }))}
            showSoftInputOnFocus={medDosageInput.showSoftInputOnFocus}
            onFocus={medDosageInput.onFocus}
            onBlur={medDosageInput.onBlur}
            onSelectionChange={medDosageInput.onSelectionChange}
            selection={medDosageInput.selection}
            placeholder="e.g. 500mg"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.fieldLabel}>Frequency</Text>
          <TextInput
            ref={medFrequencyInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.frequency}
            onChangeText={v => setMedForm(f => ({ ...f, frequency: v }))}
            showSoftInputOnFocus={medFrequencyInput.showSoftInputOnFocus}
            onFocus={medFrequencyInput.onFocus}
            onBlur={medFrequencyInput.onBlur}
            onSelectionChange={medFrequencyInput.onSelectionChange}
            selection={medFrequencyInput.selection}
            placeholder="e.g. Twice daily"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.fieldLabel}>Duration</Text>
          <TextInput
            ref={medDurationInput.ref}
            style={[styles.fieldInput, { marginBottom: 16 }]}
            value={medForm.duration}
            onChangeText={v => setMedForm(f => ({ ...f, duration: v }))}
            showSoftInputOnFocus={medDurationInput.showSoftInputOnFocus}
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

          <Text style={styles.fieldLabel}>Instructions</Text>
          <TextInput
            ref={medInstructionsInput.ref}
            style={[styles.fieldInput, styles.fieldInputMultiline, { marginBottom: 24 }]}
            value={medForm.instructions}
            onChangeText={v => setMedForm(f => ({ ...f, instructions: v }))}
            showSoftInputOnFocus={medInstructionsInput.showSoftInputOnFocus}
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
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  patientCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  patientName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  patientDetail: {
    fontSize: 14,
    color: '#566',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyHeader: {
    marginTop: 28,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  addButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  medCard: {
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
  medName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  medSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  medChevron: {
    fontSize: 22,
    color: '#bbb',
    marginLeft: 8,
  },
  empty: {
    color: '#9aa3b1',
    fontSize: 14,
    marginBottom: 8,
  },
  historyRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ebf5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  historyAction: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
  },
  historyTime: {
    color: '#8f97aa',
    fontSize: 12,
    marginTop: 4,
  },
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
});
