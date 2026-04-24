import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

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
          <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Field({ label, value, onChange, multiline, keyboardType }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        placeholderTextColor="#bbb"
        placeholder="—"
      />
    </View>
  );
}

function PersonalTab({ patient }) {
  const [notes, setNotes] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
      <View style={styles.infoCard}>
        <Text style={styles.name}>{patient.name}</Text>
        <Text style={styles.detail}>📞 {patient.phone}</Text>
        <Text style={styles.detail}>📍 {patient.address}</Text>
      </View>

      <Field label="Notes" value={notes} onChange={setNotes} multiline />
    </ScrollView>
  );
}

function RxTab() {
  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [procedures, setProcedures] = useState('');
  const [findings, setFindings] = useState('');
  const [bp, setBp] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
        <Field label="Complaints"     value={complaints}     onChange={setComplaints}     multiline />
        <Field label="Diagnosis"      value={diagnosis}      onChange={setDiagnosis}      multiline />
        <Field label="Investigations" value={investigations} onChange={setInvestigations} multiline />
        <Field label="Procedures"     value={procedures}     onChange={setProcedures}     multiline />
        <Field label="Findings"       value={findings}       onChange={setFindings}       multiline />
        <Field label="Blood Pressure (mmHg)" value={bp} onChange={setBp} />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Weight</Text>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.fieldInput, styles.weightInput]}
              value={weight}
              onChangeText={setWeight}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function PatientDetailScreen({ route }) {
  const { patient } = route.params;
  const [activeTab, setActiveTab] = useState('Personal');

  return (
    <View style={styles.container}>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Personal' ? (
        <PersonalTab patient={patient} />
      ) : (
        <RxTab />
      )}
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
    paddingBottom: 48,
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
});
