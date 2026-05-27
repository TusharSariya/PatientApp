import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { formatMoney } from './currency';
import {
  addVisit,
  clearDraftVisit,
  getAppSettings,
  getBalanceSummary,
  getClinicProfile,
  getDraftVisit,
  getMedicines,
  getVisitMedicines,
  getVisits,
  saveDraftVisit,
} from './database';
import { buildPrescriptionHtml } from './prescriptionHtml';
import { sharePrescriptionPdf } from './prescriptionPdf';
import MedicationFrequencyField from './MedicationFrequencyField';
import IntervalDaysStepper from './IntervalDaysStepper';
import { formatMedicineSubtitle, medicineToDraftForm } from './medicineDisplay';

const ROUTES = ['Oral', 'Topical', 'IV', 'IM', 'Other'];
const EMPTY_MED = { name: '', dosage: '', frequency: '', intervalDays: 1, duration: '', route: 'Oral', instructions: '' };

function formatDateLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDraftMed(value) {
  return {
    name: value?.name ?? '',
    dosage: value?.dosage ?? '',
    frequency: value?.frequency ?? '',
    intervalDays: value?.intervalDays ?? value?.interval_days ?? 1,
    duration: value?.duration ?? '',
    route: value?.route ?? 'Oral',
    instructions: value?.instructions ?? '',
  };
}

function hasMedicineDraftContent(med) {
  const normalized = normalizeDraftMed(med);
  return Boolean(
    normalized.name.trim() ||
    normalized.dosage.trim() ||
    normalized.frequency.trim() ||
    normalized.duration.trim() ||
    normalized.instructions.trim() ||
    normalized.route !== 'Oral' ||
    normalized.intervalDays !== 1
  );
}

export default function PatientVisitsScreen({ route }) {
  const { patient } = route.params;
  const [visits, setVisits] = useState([]);
  const [visitMedicines, setVisitMedicines] = useState({});
  const [currentMedicines, setCurrentMedicines] = useState([]);
  const [currentMedsExpanded, setCurrentMedsExpanded] = useState(false);
  const [balances, setBalances] = useState({
    patientBalance: 0,
    familyBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharingVisitId, setSharingVisitId] = useState(null);
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
  const [editingDraftId, setEditingDraftId] = useState(null);
  const scrollViewRef = useRef(null);
  const medicineSectionYRef = useRef(0);
  const nextDraftIdRef = useRef(0);
  const [visitCost, setVisitCost] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentScope, setPaymentScope] = useState('patient');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const skipAutosaveRef = useRef(false);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getVisits(patient.id);
      setVisits(rows);
      const medEntries = await Promise.all(rows.map(async (visit) => [visit.id, await getVisitMedicines(visit.id)]));
      setVisitMedicines(Object.fromEntries(medEntries));
      const balanceSummary = await getBalanceSummary(patient.id);
      setBalances(balanceSummary);
      const activeMeds = await getMedicines(patient.id);
      setCurrentMedicines(activeMeds);
      const settings = await getAppSettings();
      setCurrencyCode(settings.currencyCode);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    loadVisits().catch(() => {});
  }, [loadVisits]);

  function resetVisitForm() {
    setVisitDate(todayIsoDate());
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
    setEditingDraftId(null);
    setDraftMed(EMPTY_MED);
    nextDraftIdRef.current = 0;
    setVisitCost('');
    setPaymentAmount('');
    setPaymentScope('patient');
  }

  function buildDraftPayload() {
    return {
      visitDate,
      complaints,
      diagnosis,
      investigations,
      procedures,
      findings,
      bp,
      weight,
      weightUnit,
      notes,
      visitCost,
      paymentAmount,
      paymentScope,
      draftMed,
      medicines: prescribedMeds,
    };
  }

  function hasDraftContent(draft) {
    return Boolean(
      (draft.visitDate ?? '').trim() !== todayIsoDate() ||
      (draft.complaints ?? '').trim() ||
      (draft.diagnosis ?? '').trim() ||
      (draft.investigations ?? '').trim() ||
      (draft.procedures ?? '').trim() ||
      (draft.findings ?? '').trim() ||
      (draft.bp ?? '').trim() ||
      (draft.weight ?? '').trim() ||
      draft.weightUnit !== 'kg' ||
      (draft.notes ?? '').trim() ||
      (draft.visitCost ?? '').trim() ||
      (draft.paymentAmount ?? '').trim() ||
      draft.paymentScope !== 'patient' ||
      hasMedicineDraftContent(draft.draftMed) ||
      (draft.medicines ?? []).length > 0
    );
  }

  function restoreDraft(draft) {
    setVisitDate(draft.visitDate || todayIsoDate());
    setComplaints(draft.complaints ?? '');
    setDiagnosis(draft.diagnosis ?? '');
    setInvestigations(draft.investigations ?? '');
    setProcedures(draft.procedures ?? '');
    setFindings(draft.findings ?? '');
    setBp(draft.bp ?? '');
    setWeight(draft.weight ?? '');
    setWeightUnit(draft.weightUnit ?? 'kg');
    setNotes(draft.notes ?? '');
    setVisitCost(draft.visitCost ?? '');
    setPaymentAmount(draft.paymentAmount ?? '');
    setPaymentScope(draft.paymentScope === 'family' ? 'family' : 'patient');
    const medicines = Array.isArray(draft.medicines) ? draft.medicines : [];
    const restoredMeds = medicines.map((med, index) => ({
      ...normalizeDraftMed(med),
      draftId: med.draftId ?? index + 1,
    }));
    setPrescribedMeds(restoredMeds);
    nextDraftIdRef.current = restoredMeds.reduce((max, med) => Math.max(max, med.draftId), 0);
    setDraftMed(normalizeDraftMed(draft.draftMed));
    setEditingDraftId(null);
  }

  useEffect(() => {
    let cancelled = false;
    setDraftReady(false);
    setDraftStatus('');
    skipAutosaveRef.current = true;
    getDraftVisit(patient.id)
      .then((draft) => {
        if (cancelled) return;
        if (draft) {
          restoreDraft(draft);
          setHasSavedDraft(true);
          setDraftStatus('Draft restored');
        } else {
          resetVisitForm();
          setHasSavedDraft(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasSavedDraft(false);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setDraftReady(true);
        setTimeout(() => {
          skipAutosaveRef.current = false;
        }, 0);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  useEffect(() => {
    if (!draftReady) return undefined;
    if (skipAutosaveRef.current) return undefined;

    const draft = buildDraftPayload();
    const shouldKeepDraft = hasDraftContent(draft);

    const timer = setTimeout(async () => {
      try {
        if (shouldKeepDraft) {
          setDraftStatus('Saving draft...');
          await saveDraftVisit(patient.id, draft);
          setHasSavedDraft(true);
          setDraftStatus('Draft saved');
        } else if (hasSavedDraft) {
          await clearDraftVisit(patient.id);
          setHasSavedDraft(false);
          setDraftStatus('');
        }
      } catch {
        setDraftStatus('Draft not saved');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    patient.id,
    draftReady,
    visitDate,
    complaints,
    diagnosis,
    investigations,
    procedures,
    findings,
    bp,
    weight,
    weightUnit,
    notes,
    draftMed,
    prescribedMeds,
    visitCost,
    paymentAmount,
    paymentScope,
    hasSavedDraft,
  ]);

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
        medicines: prescribedMeds.map(({ draftId: _draftId, ...med }) => med),
      });
      await clearDraftVisit(patient.id);
      skipAutosaveRef.current = true;
      resetVisitForm();
      setHasSavedDraft(false);
      setDraftStatus('');
      setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);
      await loadVisits();
    } catch {
      Alert.alert('Error', 'Failed to create visit.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscardDraft() {
    try {
      await clearDraftVisit(patient.id);
      skipAutosaveRef.current = true;
      resetVisitForm();
      setHasSavedDraft(false);
      setDraftStatus('');
      setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);
    } catch {
      Alert.alert('Draft', 'Could not discard the draft.');
    }
  }

  async function handlePrescriptionPdf(visit) {
    setSharingVisitId(visit.id);
    try {
      let meds = visitMedicines[visit.id];
      if (meds == null) {
        meds = await getVisitMedicines(visit.id);
      }
      const [clinic, settings] = await Promise.all([getClinicProfile(), getAppSettings()]);
      const html = buildPrescriptionHtml({
        patient,
        visit,
        medicines: meds,
        clinic,
        patientBalance: balances.patientBalance,
        currencyCode: settings.currencyCode,
      });
      await sharePrescriptionPdf(html);
    } catch {
      Alert.alert('Prescription', 'Could not create or share the PDF.');
    } finally {
      setSharingVisitId(null);
    }
  }

  function buildDraftMedicineEntry(draftId) {
    return {
      draftId,
      name: draftMed.name.trim(),
      dosage: draftMed.dosage.trim(),
      frequency: draftMed.frequency.trim(),
      intervalDays: draftMed.intervalDays,
      duration: draftMed.duration.trim(),
      route: draftMed.route,
      instructions: draftMed.instructions.trim(),
    };
  }

  function scrollToMedicineSection() {
    scrollViewRef.current?.scrollTo?.({
      y: medicineSectionYRef.current,
      animated: true,
    });
  }

  function addDraftMedicine() {
    if (!draftMed.name.trim()) {
      Alert.alert('Required', 'Medicine name is required.');
      return;
    }
    if (editingDraftId != null) {
      setPrescribedMeds((current) =>
        current.map((med) =>
          med.draftId === editingDraftId ? buildDraftMedicineEntry(editingDraftId) : med
        )
      );
      setEditingDraftId(null);
    } else {
      nextDraftIdRef.current += 1;
      setPrescribedMeds((current) => [...current, buildDraftMedicineEntry(nextDraftIdRef.current)]);
    }
    setDraftMed(EMPTY_MED);
    scrollToMedicineSection();
  }

  function startEditDraftMedicine(draftId) {
    const med = prescribedMeds.find((entry) => entry.draftId === draftId);
    if (!med) return;
    setDraftMed({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      intervalDays: med.intervalDays,
      duration: med.duration,
      route: med.route,
      instructions: med.instructions,
    });
    setEditingDraftId(draftId);
  }

  function cancelEditDraftMedicine() {
    setEditingDraftId(null);
    setDraftMed(EMPTY_MED);
  }

  function deleteDraftMedicine(draftId) {
    Alert.alert('Remove medicine', 'Remove this prescribed medicine from the visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPrescribedMeds((current) => current.filter((med) => med.draftId !== draftId));
          if (editingDraftId === draftId) {
            setEditingDraftId(null);
            setDraftMed(EMPTY_MED);
          }
        },
      },
    ]);
  }

  function renderMedicineSection() {
    return (
      <View
        testID="visit-medicine-section"
        onLayout={(event) => {
          medicineSectionYRef.current = event.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.label}>Interval Between Days</Text>
        <IntervalDaysStepper
          value={draftMed.intervalDays}
          onChange={(intervalDays) => setDraftMed((m) => ({ ...m, intervalDays }))}
          testIDPrefix="visit-medicine-interval"
        />

        <TouchableOpacity
          testID="current-medicines-toggle"
          style={styles.currentMedsToggle}
          onPress={() => setCurrentMedsExpanded((open) => !open)}
          activeOpacity={0.8}
        >
          <Text style={styles.currentMedsToggleTitle}>
            Current medicines ({currentMedicines.length})
          </Text>
          <Text style={styles.currentMedsToggleChevron}>{currentMedsExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {currentMedsExpanded ? (
          <>
            <Text style={styles.currentMedsHint}>Tap a medicine to pre-fill the form below.</Text>
            {currentMedicines.length === 0 ? (
              <Text style={styles.currentMedsEmpty}>No medicines on file.</Text>
            ) : (
              currentMedicines.map((med) => {
                const subtitle = formatMedicineSubtitle(med);
                return (
                  <TouchableOpacity
                    key={med.id}
                    style={styles.currentMedRow}
                    onPress={() => setDraftMed(medicineToDraftForm(med))}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currentMedName}>{med.name}</Text>
                      {subtitle ? <Text style={styles.currentMedSub}>{subtitle}</Text> : null}
                    </View>
                    <Text style={styles.currentMedChevron}>›</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : null}

        <Text style={[styles.sectionTitleInline, { marginTop: 20 }]}>Prescribe Medicines</Text>
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
        <MedicationFrequencyField
          value={draftMed.frequency}
          onChange={(frequency) => setDraftMed((m) => ({ ...m, frequency }))}
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
          <Text style={styles.secondaryButtonText}>
            {editingDraftId != null ? 'Update Prescribed Medicine' : '+ Add Prescribed Medicine'}
          </Text>
        </TouchableOpacity>
        {editingDraftId != null ? (
          <TouchableOpacity style={styles.cancelEditButton} onPress={cancelEditDraftMedicine}>
            <Text style={styles.cancelEditButtonText}>Cancel edit</Text>
          </TouchableOpacity>
        ) : null}
        {prescribedMeds.map((med) => {
          const subtitle = formatMedicineSubtitle(med);
          return (
            <View key={med.draftId} style={styles.prescribedRow}>
              <View style={styles.prescribedInfo}>
                <Text style={styles.prescribedName}>{med.name}</Text>
                {subtitle ? <Text style={styles.prescribedText}>{subtitle}</Text> : null}
                {med.duration ? <Text style={styles.prescribedText}>{med.duration}</Text> : null}
                {med.instructions ? (
                  <Text style={styles.prescribedText} numberOfLines={2}>
                    {med.instructions}
                  </Text>
                ) : null}
              </View>
              <View style={styles.prescribedActions}>
                <TouchableOpacity
                  style={styles.prescribedActionBtn}
                  onPress={() => startEditDraftMedicine(med.draftId)}
                  testID={`edit-draft-med-${med.draftId}`}
                >
                  <Text style={styles.prescribedEditText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.prescribedActionBtn}
                  onPress={() => deleteDraftMedicine(med.draftId)}
                  testID={`delete-draft-med-${med.draftId}`}
                >
                  <Text style={styles.prescribedDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        testID="visit-scroll-view"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.patientCard}>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientDetail}>Visits and encounter history</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Patient Balance:</Text>
            <Text style={styles.balanceValue}>{formatMoney(balances.patientBalance, currencyCode)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Family Balance:</Text>
            <Text style={styles.balanceValue}>{formatMoney(balances.familyBalance, currencyCode)}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>New Visit</Text>
              {draftStatus ? <Text style={styles.draftStatus}>{draftStatus}</Text> : null}
            </View>
            {hasSavedDraft || hasDraftContent(buildDraftPayload()) ? (
              <TouchableOpacity
                style={styles.discardDraftButton}
                onPress={handleDiscardDraft}
                testID="discard-draft-visit-button"
              >
                <Text style={styles.discardDraftButtonText}>Discard Draft</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.label}>Visit Date</Text>
          <TextInput
            style={styles.input}
            value={visitDate}
            onChangeText={setVisitDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#bbb"
          />
          {renderMedicineSection()}
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
                testID={`payment-scope-${scopeOption.id}`}
                style={[styles.routeChip, paymentScope === scopeOption.id && styles.routeChipActive]}
                onPress={() => setPaymentScope(scopeOption.id)}
              >
                <Text style={[styles.routeChipText, paymentScope === scopeOption.id && styles.routeChipTextActive]}>
                  {scopeOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            testID="create-visit-button"
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
              <Text style={styles.visitNotes}>Visit Cost: {formatMoney(visit.visit_cost, currencyCode)}</Text>
              {visit.notes ? <Text style={styles.visitNotes}>{visit.notes}</Text> : null}
              {(visitMedicines[visit.id] ?? []).length > 0 ? (
                <Text style={styles.visitNotes}>
                  Medicines: {(visitMedicines[visit.id] ?? [])
                    .map((med) => `${med.name}${med.interval_days ? ` (q${med.interval_days}d)` : ''}`)
                    .join(', ')}
                </Text>
              ) : null}
              <TouchableOpacity
                testID={`prescription-pdf-${visit.id}`}
                style={[styles.prescriptionBtn, sharingVisitId === visit.id && styles.prescriptionBtnDisabled]}
                onPress={() => handlePrescriptionPdf(visit)}
                disabled={sharingVisitId != null}
              >
                <Text style={styles.prescriptionBtnText}>
                  {sharingVisitId === visit.id ? 'Preparing PDF…' : 'Prescription (PDF)'}
                </Text>
              </TouchableOpacity>
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
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  draftStatus: {
    marginTop: 4,
    color: '#5f6d8a',
    fontSize: 13,
    fontWeight: '600',
  },
  discardDraftButton: {
    borderWidth: 1,
    borderColor: '#f0c5bd',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff5f3',
  },
  discardDraftButtonText: {
    color: '#b23b2e',
    fontWeight: '700',
    fontSize: 13,
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
  currentMedsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e9eeff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce2f7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  currentMedsToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2f46c7',
  },
  currentMedsToggleChevron: {
    fontSize: 12,
    color: '#4f6ef7',
    fontWeight: '700',
  },
  currentMedsHint: {
    fontSize: 13,
    color: '#5f6d8a',
    marginTop: 8,
    marginBottom: 10,
  },
  currentMedsEmpty: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  currentMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f9ff',
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  currentMedName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  currentMedSub: {
    fontSize: 13,
    color: '#5f6d8a',
    marginTop: 2,
  },
  currentMedChevron: {
    fontSize: 20,
    color: '#4f6ef7',
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f3f6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  prescribedInfo: {
    flex: 1,
    marginRight: 8,
  },
  prescribedName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  prescribedText: {
    fontSize: 13,
    color: '#34415f',
    marginTop: 2,
  },
  prescribedActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  prescribedActionBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  prescribedEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4f6ef7',
  },
  prescribedDeleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c0392b',
  },
  cancelEditButton: {
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelEditButtonText: {
    fontSize: 13,
    color: '#5f6d8a',
    fontWeight: '600',
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
  prescriptionBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#e9eeff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  prescriptionBtnDisabled: {
    opacity: 0.65,
  },
  prescriptionBtnText: {
    color: '#2f46c7',
    fontWeight: '700',
    fontSize: 14,
  },
});
