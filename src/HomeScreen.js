import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { flatPressableRow, flatSection, screenColors, screenContent } from './screenLayout';

const CARDS = [
  {
    testID: 'home-card-add-patient',
    screen: 'AddPatient',
    icon: '➕',
    title: 'New Patient',
    desc: "Register a patient's name, phone and address",
  },
  {
    testID: 'home-card-search',
    screen: 'Search',
    icon: '🔍',
    title: 'Search Patients',
    desc: 'Look up a patient by name',
  },
  {
    testID: 'home-card-all-visits',
    screen: 'AllVisits',
    icon: '📅',
    title: 'All Visits',
    desc: 'View visits across all patients by date range',
  },
  {
    testID: 'home-card-clinic-profile',
    screen: 'ClinicProfile',
    icon: '👤',
    title: 'Doctor / practice details',
    desc: 'Your name, clinic, and hours—shown on prescription PDFs',
  },
  {
    testID: 'home-card-settings',
    screen: 'Settings',
    icon: '⚙️',
    title: 'Settings',
    desc: 'Manage gestures and preferences',
  },
];

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Patient Manager</Text>
      <Text style={styles.subtitle}>What would you like to do?</Text>

      <View style={styles.navSection}>
        {CARDS.map((card, index) => (
          <TouchableOpacity
            key={card.testID}
            testID={card.testID}
            style={flatPressableRow({ last: index === CARDS.length - 1 })}
            onPress={() => navigation.navigate(card.screen)}
            activeOpacity={0.75}
          >
            <Text style={styles.cardIcon}>{card.icon}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenColors.bg,
  },
  content: {
    ...screenContent(40),
    paddingTop: 64,
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
    marginBottom: 24,
  },
  navSection: flatSection({ marginBottom: 0 }),
  cardIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: '#888',
  },
  chevron: {
    fontSize: 22,
    color: '#ccc',
  },
});
