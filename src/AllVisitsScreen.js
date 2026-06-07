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
import { formatMoney } from './currency';
import { getAppSettings, getVisitsInDateRange } from './database';
import {
  groupVisitsByDate,
  isValidIsoDate,
  startOfMonthIsoDate,
  todayIsoDate,
} from './visitDates';
import { flatPressableRow, flatSection, screenColors, screenContent } from './screenLayout';

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

function VisitCard({ visit, currencyCode, onPress, last }) {
  return (
    <TouchableOpacity
      style={flatPressableRow({ last })}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.patientName} numberOfLines={1}>
        {visit.patient_name}
      </Text>
      <Text style={styles.visitCost}>{formatMoney(visit.visit_cost, currencyCode)}</Text>
    </TouchableOpacity>
  );
}

export default function AllVisitsScreen({ navigation }) {
  const [startDate, setStartDate] = useState(startOfMonthIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('INR');

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
      const [rows, settings] = await Promise.all([
        getVisitsInDateRange({ startDate: start, endDate: end }),
        getAppSettings(),
      ]);
      setVisits(rows);
      setCurrencyCode(settings.currencyCode);
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
      <View style={styles.filterSection}>
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
          renderItem={({ item, index, section }) => (
            <VisitCard
              visit={item}
              currencyCode={currencyCode}
              last={index === section.data.length - 1}
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
    backgroundColor: screenColors.bg,
  },
  filterSection: {
    ...flatSection({ marginBottom: 0 }),
    ...screenContent(0),
    paddingTop: 12,
    paddingBottom: 16,
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
    backgroundColor: screenColors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  searchButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
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
    ...screenContent(32),
    paddingTop: 0,
  },
  resultCount: {
    fontSize: 14,
    color: '#5f6d8a',
    marginBottom: 12,
    fontWeight: '600',
  },
  dateHeader: {
    backgroundColor: screenColors.bg,
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
