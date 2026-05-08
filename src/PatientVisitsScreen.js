import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addVisit, getBalanceSummary, getVisitMedicines, getVisits } from './database';

const ROUTES = ['Oral', 'Topical', 'IV', 'IM', 'Other'];
const EMPTY_MED = { name: '', dosage: '', frequency: '', duration: '', route: 'Oral', instructions: '' };

function formatDateLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export default function PatientVisitsScreen({ route }) {
  const { patient } = route.params;
  const [visits, setVisits] = useState([]);
  const [visitMedicines, setVisitMedicines] = useState({});
  const [balances, setBalances] = useState({
    patientBalance: 0,
    familyBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visitDate, setVisitDate] = useState(todayIsoDate());
  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [procedures, setProcedures] = useState('');
  const [findings, setFindings] = useState('');
  const [bp, setBp] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [draftMed, setDraftMed] = useState(EMPTY_MED);
  const [prescribedMeds, setPrescribedMeds] = useState([]);
  const [visitCost, setVisitCost] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentScope, setPaymentScope] = useState('patient');

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getVisits(patient.id);
      setVisits(rows);
      const medEntries = await Promise.all(rows.map(async (visit) => [visit.id, await getVisitMedicines(visit.id)]));
      setVisitMedicines(Object.fromEntries(medEntries));
      const balanceSummary = await getBalanceSummary(patient.id);
      setBalances(balanceSummary);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    loadVisits().catch(() => {});
  }, [loadVisits]);

  async function handleCreateVisit() {
    if (!visitDate.trim()) {
      Alert.alert('Required', 'Visit date is required.');
      return;
    }
    setSaving(true);
    try {
      await addVisit(patient.id, {
        visitDate: visitDate.trim(),
        complaints: complaints.trim(),
        diagnosis: diagnosis.trim(),
        investigations: investigations.trim(),
        procedures: procedures.trim(),
        findings: findings.trim(),
        bp: bp.trim(),
        weight: weight.trim(),
        weightUnit,
        notes: notes.trim(),
        visitCost: visitCost.trim() || 0,
        paymentAmount: paymentAmount.trim() || 0,
        paymentScope,
        familyId: patient.family_id,
        medicines: prescribedMeds,
      });
      setComplaints('');
      setDiagnosis('');
      setInvestigations('');
      setProcedures('');
      setFindings('');
      setBp('');
      setWeight('');
      setWeightUnit('kg');
      setNotes('');
      setPrescribedMeds([]);
      setDraftMed(EMPTY_MED);
      setVisitCost('');
      setPaymentAmount('');
      setPaymentScope('patient');
      await loadVisits();
    } catch {
      Alert.alert('Error', 'Failed to create visit.');
    } finally {
      setSaving(false);
    }
  }

  function addDraftMedicine() {
    if (!draftMed.name.trim()) {
      Alert.alert('Required', 'Medicine name is required.');
      return;
    }
    setPrescribedMeds((current) => [
      ...current,
      {
        name: draftMed.name.trim(),
        dosage: draftMed.dosage.trim(),
        frequency: draftMed.frequency.trim(),
        duration: draftMed.duration.trim(),
        route: draftMed.route,
        instructions: draftMed.instructions.trim(),
      },
    ]);
    setDraftMed(EMPTY_MED);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.patientCard}>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientDetail}>Visits and encounter history</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Patient Balance:</Text>
            <Text style={styles.balanceValue}>{formatCurrency(balances.patientBalance)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Family Balance:</Text>
            <Text style={styles.balanceValue}>{formatCurrency(balances.familyBalance)}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>New Visit</Text>
          <Text style={styles.label}>Visit Date</Text>
          <TextInput
            style={styles.input}
            value={visitDate}
            onChangeText={setVisitDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#bbb"
          />
          <Text style={styles.label}>Complaints</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={complaints}
            onChangeText={setComplaints}
            placeholder="Chief complaints"
            placeholderTextColor="#bbb"
            multiline
          />
          <Text style={styles.label}>Diagnosis</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="Diagnosis"
            placeholderTextColor="#bbb"
            multiline
          />
          <Text style={styles.label}>Investigations</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={investigations}
            onChangeText={setInvestigations}
            placeholder="Investigations"
            placeholderTextColor="#bbb"
            multiline
          />
          <Text style={styles.label}>Procedures</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={procedures}
            onChangeText={setProcedures}
            placeholder="Procedures"
            placeholderTextColor="#bbb"
            multiline
          />
          <Text style={styles.label}>Findings</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={findings}
            onChangeText={setFindings}
            placeholder="Findings"
            placeholderTextColor="#bbb"
            multiline
          />
          <Text style={styles.label}>Blood Pressure</Text>
          <TextInput
            style={styles.input}
            value={bp}
            onChangeText={setBp}
            placeholder="e.g. 120/80"
            placeholderTextColor="#bbb"
          />
          <Text style={styles.label}>Weight</Text>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.input, styles.weightInput]}
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 72"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
            />
            <View style={styles.unitToggle}>
              {['kg', 'lbs'].map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitBtn, weightUnit === unit && styles.unitBtnActive]}
                  onPress={() => setWeightUnit(unit)}
                >
                  <Text style={[styles.unitBtnText, weightUnit === unit && styles.unitBtnTextActive]}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Visit notes"
            placeholderTextColor="#bbb"
            multiline
          />
          <Text style={styles.label}>Visit Cost</Text>
          <TextInput
            style={styles.input}
            value={visitCost}
            onChangeText={setVisitCost}
            placeholder="e.g. 150"
            placeholderTextColor="#bbb"
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Payment Amount</Text>
          <TextInput
            style={styles.input}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            placeholder="e.g. 50"
            placeholderTextColor="#bbb"
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Apply Payment To</Text>
          <View style={styles.routeRow}>
            {[
              { id: 'patient', label: 'Patient Balance' },
              { id: 'family', label: 'Family Balance' },
            ].map((scopeOption) => (
              <TouchableOpacity
                key={scopeOption.id}
                style={[styles.routeChip, paymentScope === scopeOption.id && styles.routeChipActive]}
                onPress={() => setPaymentScope(scopeOption.id)}
              >
                <Text style={[styles.routeChipText, paymentScope === scopeOption.id && styles.routeChipTextActive]}>
                  {scopeOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitleInline}>Prescribe Medicines</Text>
          <TextInput
            style={styles.input}
            value={draftMed.name}
            onChangeText={(value) => setDraftMed((m) => ({ ...m, name: value }))}
            placeholder="Medicine name"
            placeholderTextColor="#bbb"
          />
          <TextInput
            style={styles.input}
            value={draftMed.dosage}
            onChangeText={(value) => setDraftMed((m) => ({ ...m, dosage: value }))}
            placeholder="Dosage"
            placeholderTextColor="#bbb"
          />
          <TextInput
            style={styles.input}
            value={draftMed.frequency}
            onChangeText={(value) => setDraftMed((m) => ({ ...m, frequency: value }))}
            placeholder="Frequency"
            placeholderTextColor="#bbb"
          />
          <TextInput
            style={styles.input}
            value={draftMed.duration}
            onChangeText={(value) => setDraftMed((m) => ({ ...m, duration: value }))}
            placeholder="Duration"
            placeholderTextColor="#bbb"
          />
          <View style={styles.routeRow}>
            {ROUTES.map((routeName) => (
              <TouchableOpacity
                key={routeName}
                style={[styles.routeChip, draftMed.route === routeName && styles.routeChipActive]}
                onPress={() => setDraftMed((m) => ({ ...m, route: routeName }))}
              >
                <Text style={[styles.routeChipText, draftMed.route === routeName && styles.routeChipTextActive]}>{routeName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={draftMed.instructions}
            onChangeText={(value) => setDraftMed((m) => ({ ...m, instructions: value }))}
            placeholder="Instructions"
            placeholderTextColor="#bbb"
            multiline
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={addDraftMedicine}>
            <Text style={styles.secondaryButtonText}>+ Add Prescribed Medicine</Text>
          </TouchableOpacity>
          {prescribedMeds.map((med, index) => (
            <View key={`${med.name}-${index}`} style={styles.prescribedRow}>
              <Text style={styles.prescribedText}>
                {med.name} {med.dosage ? `· ${med.dosage}` : ''} {med.frequency ? `· ${med.frequency}` : ''}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleCreateVisit}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Create Visit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Visits</Text>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} size="large" color="#4f6ef7" />
        ) : visits.length === 0 ? (
          <Text style={styles.empty}>No visits yet.</Text>
        ) : (
          visits.map((visit) => (
            <View key={visit.id} style={styles.visitCard}>
              <Text style={styles.visitDate}>{formatDateLabel(visit.visit_date)}</Text>
              {visit.complaints ? <Text style={styles.visitReason}>Complaints: {visit.complaints}</Text> : null}
              {visit.diagnosis ? <Text style={styles.visitNotes}>Diagnosis: {visit.diagnosis}</Text> : null}
              {visit.investigations ? <Text style={styles.visitNotes}>Investigations: {visit.investigations}</Text> : null}
              {visit.procedures ? <Text style={styles.visitNotes}>Procedures: {visit.procedures}</Text> : null}
              {visit.findings ? <Text style={styles.visitNotes}>Findings: {visit.findings}</Text> : null}
              {visit.bp ? <Text style={styles.visitNotes}>BP: {visit.bp}</Text> : null}
              {visit.weight ? <Text style={styles.visitNotes}>Weight: {visit.weight} {visit.weight_unit || 'kg'}</Text> : null}
              <Text style={styles.visitNotes}>Visit Cost: {formatCurrency(visit.visit_cost)}</Text>
              {visit.notes ? <Text style={styles.visitNotes}>{visit.notes}</Text> : null}
              {(visitMedicines[visit.id] ?? []).length > 0 ? (
                <Text style={styles.visitNotes}>Medicines: {(visitMedicines[visit.id] ?? []).map((med) => med.name).join(', ')}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
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
    marginBottom: 20,
  },
  patientName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  patientDetail: {
    marginTop: 6,
    color: '#5f6d8a',
    fontSize: 14,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  balanceLabel: {
    color: '#5f6d8a',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce2f7',
    padding: 16,
  },
  listHeader: {
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  sectionTitleInline: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
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
  },
  multiline: {
    minHeight: 86,
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
    backgroundColor: '#fff',
  },
  unitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  unitBtnActive: {
    backgroundColor: '#4f6ef7',
  },
  unitBtnText: {
    color: '#65718d',
    fontWeight: '600',
  },
  unitBtnTextActive: {
    color: '#fff',
  },
  routeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  routeChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  routeChipActive: {
    backgroundColor: '#4f6ef7',
    borderColor: '#4f6ef7',
  },
  routeChipText: {
    fontSize: 13,
    color: '#61708a',
  },
  routeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: '#e9eeff',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#2f46c7',
    fontWeight: '700',
    fontSize: 14,
  },
  prescribedRow: {
    backgroundColor: '#f3f6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  prescribedText: {
    fontSize: 13,
    color: '#34415f',
  },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  empty: {
    color: '#9aa3b1',
    fontSize: 14,
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ebf5',
    padding: 14,
    marginBottom: 10,
  },
  visitDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  visitReason: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#34415f',
  },
  visitNotes: {
    marginTop: 6,
    fontSize: 14,
    color: '#596580',
  },
});
