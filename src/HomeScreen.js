import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Patient Manager</Text>
      <Text style={styles.subtitle}>What would you like to do?</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AddPatient')}
      >
        <Text style={styles.cardIcon}>➕</Text>
        <Text style={styles.cardTitle}>New Patient</Text>
        <Text style={styles.cardDesc}>Register a patient's name, phone and address</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.cardIcon}>🔍</Text>
        <Text style={styles.cardTitle}>Search Patients</Text>
        <Text style={styles.cardDesc}>Look up a patient by name</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    padding: 28,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 36,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#888',
  },
});
