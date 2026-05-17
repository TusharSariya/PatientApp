import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getVisitsInDateRange } from './database';
import {
  formatDateLabel,
  isValidIsoDate,
  startOfMonthIsoDate,
  todayIsoDate,
} from './visitDates';

function formatCurrency(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function visitToPatient(row) {
  return {
    id: row.patient_id,
    name: row.patient_name,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    dob: row.dob,
    family_id: row.family_id,
    phone: row.phone,
    address: row.address,
  };
}

function VisitCard({ visit, onPress }) {
  return (
    <TouchableOpacity style={styles.visitCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.visitHeader}>
        <Text style={styles.patientName}>{visit.patient_name}</Text>
        <Text style={styles.visitDate}>{formatDateLabel(visit.visit_date)}</Text>
      </View>
      {visit.complaints ? (
        <Text style={styles.visitDetail} numberOfLines={2}>
          Complaints: {visit.complaints}
        </Text>
      ) : null}
      {visit.diagnosis ? (
        <Text style={styles.visitDetail} numberOfLines={2}>
          Diagnosis: {visit.diagnosis}
        </Text>
      ) : null}
      <Text style={styles.visitCost}>Visit Cost: {formatCurrency(visit.visit_cost)}</Text>
      {visit.medicine_count > 0 ? (
        <Text style={styles.medicineCount}>
          {visit.medicine_count} medicine{visit.medicine_count === 1 ? '' : 's'} prescribed
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function AllVisitsScreen({ navigation }) {
  const [startDate, setStartDate] = useState(startOfMonthIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loadVisits = useCallback(async () => {
    const start = startDate.trim();
    const end = endDate.trim();

    if (!start || !end) {
      Alert.alert('Required', 'Start date and end date are required.');
      return;
    }
    if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format for both dates.');
      return;
    }
    if (start > end) {
      Alert.alert('Invalid range', 'Start date must be on or before end date.');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const rows = await getVisitsInDateRange({ startDate: start, endDate: end });
      setVisits(rows);
    } catch {
      Alert.alert('Error', 'Could not load visits.');
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <View style={styles.container}>
      <View style={styles.filterCard}>
        <Text style={styles.sectionTitle}>Date range</Text>
        <Text style={styles.label}>Start date</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#bbb"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>End date</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#bbb"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={loadVisits}
          disabled={loading}
          testID="view-visits-button"
        >
          <Text style={styles.searchButtonText}>{loading ? 'Loading…' : 'View visits'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#4f6ef7" />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            hasSearched ? (
              <Text style={styles.resultCount}>
                {visits.length} visit{visits.length === 1 ? '' : 's'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            hasSearched ? (
              <Text style={styles.empty}>No visits in this range.</Text>
            ) : (
              <Text style={styles.empty}>Choose a date range and tap View visits.</Text>
            )
          }
          renderItem={({ item }) => (
            <VisitCard
              visit={item}
              onPress={() => navigation.navigate('PatientVisits', { patient: visitToPatient(item) })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  filterCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5f6d8a',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f5f6fa',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  searchButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loader: {
    marginTop: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  resultCount: {
    fontSize: 14,
    color: '#5f6d8a',
    marginBottom: 12,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginTop: 24,
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  patientName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginRight: 12,
  },
  visitDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f6ef7',
  },
  visitDetail: {
    fontSize: 14,
    color: '#5f6d8a',
    marginBottom: 4,
  },
  visitCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginTop: 4,
  },
  medicineCount: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
});
