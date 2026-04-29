import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useGestureTextInput } from './GestureInputProvider';

function PatientCard({ patient, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.cardName}>{patient.name}</Text>
      <Text style={styles.cardDetail}>📞 {patient.phone}</Text>
      <Text style={styles.cardDetail}>📍 {patient.address}</Text>
    </TouchableOpacity>
  );
}

function SearchField({ label, value, onChangeText, input, placeholder }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.searchLabel}>{label}</Text>
      <TextInput
        ref={input.ref}
        style={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        showSoftInputOnFocus={input.showSoftInputOnFocus}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        onSelectionChange={input.onSelectionChange}
        selection={input.selection}
        clearButtonMode="while-editing"
        autoCapitalize="words"
      />
    </View>
  );
}

export default function SearchScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const latestLoadRef = useRef(0);

  const load = useCallback(async (filters) => {
    const requestId = latestLoadRef.current + 1;
    latestLoadRef.current = requestId;
    setLoading(true);
    try {
      const normalized = {
        firstName: filters.firstName.trim(),
        middleName: filters.middleName.trim(),
        lastName: filters.lastName.trim(),
      };
      const hasSearch =
        normalized.firstName.length > 0 ||
        normalized.middleName.length > 0 ||
        normalized.lastName.length > 0;
      const results = hasSearch
        ? await searchPatients(normalized)
        : await getAllPatients();
      if (latestLoadRef.current === requestId) {
        setPatients(results);
      }
    } finally {
      if (latestLoadRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load({ firstName: '', middleName: '', lastName: '' });
  }, [load]);

  function handleFirstNameChange(text) {
    setFirstName(text);
    load({ firstName: text, middleName, lastName });
  }

  function handleMiddleNameChange(text) {
    setMiddleName(text);
    load({ firstName, middleName: text, lastName });
  }

  function handleLastNameChange(text) {
    setLastName(text);
    load({ firstName, middleName, lastName: text });
  }

  const firstNameInput = useGestureTextInput({ label: 'Search First Name', value: firstName, setValue: handleFirstNameChange });
  const middleNameInput = useGestureTextInput({ label: 'Search Middle Name', value: middleName, setValue: handleMiddleNameChange });
  const lastNameInput = useGestureTextInput({ label: 'Search Last Name', value: lastName, setValue: handleLastNameChange });
  const hasSearch = firstName.trim() || middleName.trim() || lastName.trim();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Patients</Text>
      <Text style={styles.subhead}>Use first, middle, and last name prefixes to narrow to the exact patient.</Text>

      <SearchField
        label="First Name"
        value={firstName}
        onChangeText={handleFirstNameChange}
        input={firstNameInput}
        placeholder="Prefix, e.g. Jo"
      />
      <SearchField
        label="Middle Name"
        value={middleName}
        onChangeText={handleMiddleNameChange}
        input={middleNameInput}
        placeholder="Optional prefix"
      />
      <SearchField
        label="Last Name"
        value={lastName}
        onChangeText={handleLastNameChange}
        input={lastNameInput}
        placeholder="Prefix, e.g. Sm"
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#4f6ef7" />
      ) : patients.length === 0 ? (
        <Text style={styles.empty}>
          {hasSearch ? 'No patients match those name prefixes.' : 'No patients yet. Add one!'}
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
    marginBottom: 8,
    color: '#1a1a2e',
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    color: '#61708a',
    marginBottom: 18,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
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
