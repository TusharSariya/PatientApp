import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getVisitsInDateRange } from './database';
import {
  groupVisitsByDate,
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
    <TouchableOpacity style={styles.visitRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.patientName} numberOfLines={1}>
        {visit.patient_name}
      </Text>
      <Text style={styles.visitCost}>{formatCurrency(visit.visit_cost)}</Text>
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

  const sections = useMemo(() => groupVisitsByDate(visits), [visits]);

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
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
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
          renderSectionHeader={({ section }) => (
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>{section.title}</Text>
            </View>
          )}
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
  dateHeader: {
    backgroundColor: '#f5f6fa',
    paddingTop: 14,
    paddingBottom: 6,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5f6d8a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginTop: 24,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  patientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    marginRight: 12,
  },
  visitCost: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4f6ef7',
  },
});
