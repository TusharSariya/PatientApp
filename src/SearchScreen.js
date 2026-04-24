import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { searchPatients, getAllPatients } from './database';

function PatientCard({ patient, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.cardName}>{patient.name}</Text>
      <Text style={styles.cardDetail}>📞 {patient.phone}</Text>
      <Text style={styles.cardDetail}>📍 {patient.address}</Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (text) => {
    setLoading(true);
    try {
      const results = text.trim()
        ? await searchPatients(text.trim())
        : await getAllPatients();
      setPatients(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  function handleChange(text) {
    setQuery(text);
    load(text);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Patients</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name…"
        value={query}
        onChangeText={handleChange}
        clearButtonMode="while-editing"
        autoCapitalize="none"
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#4f6ef7" />
      ) : patients.length === 0 ? (
        <Text style={styles.empty}>
          {query.trim() ? 'No patients found.' : 'No patients yet. Add one!'}
        </Text>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PatientCard
              patient={item}
              onPress={() => navigation.navigate('PatientDetail', { patient: item })}
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f5f6fa',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a2e',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    color: '#1a1a2e',
  },
  empty: {
    textAlign: 'center',
    marginTop: 60,
    color: '#999',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  cardDetail: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
});
