import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Patient Manager</Text>
      <Text style={styles.subtitle}>What would you like to do?</Text>

      <TouchableOpacity
        testID="home-card-add-patient"
        style={styles.card}
        onPress={() => navigation.navigate('AddPatient')}
      >
        <Text style={styles.cardIcon}>➕</Text>
        <Text style={styles.cardTitle}>New Patient</Text>
        <Text style={styles.cardDesc}>Register a patient's name, phone and address</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="home-card-search"
        style={styles.card}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.cardIcon}>🔍</Text>
        <Text style={styles.cardTitle}>Search Patients</Text>
        <Text style={styles.cardDesc}>Look up a patient by name</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="home-card-all-visits"
        style={styles.card}
        onPress={() => navigation.navigate('AllVisits')}
      >
        <Text style={styles.cardIcon}>📅</Text>
        <Text style={styles.cardTitle}>All Visits</Text>
        <Text style={styles.cardDesc}>View visits across all patients by date range</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="home-card-clinic-profile"
        style={styles.card}
        onPress={() => navigation.navigate('ClinicProfile')}
      >
        <Text style={styles.cardIcon}>👤</Text>
        <Text style={styles.cardTitle}>Doctor / practice details</Text>
        <Text style={styles.cardDesc}>Your name, clinic, and hours—shown on prescription PDFs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="home-card-settings"
        style={styles.card}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.cardIcon}>⚙️</Text>
        <Text style={styles.cardTitle}>Settings</Text>
        <Text style={styles.cardDesc}>Manage gestures and preferences</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  content: {
    padding: 28,
    paddingTop: 64,
    paddingBottom: 40,
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
