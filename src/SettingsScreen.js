import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { flatPressableRow, flatSection, screenColors, screenContent } from './screenLayout';

const ROWS = [
  {
    key: 'report',
    icon: '🐞',
    title: 'Report a problem',
    sub: 'Share diagnostics after an error',
    screen: 'ReportProblem',
  },
  {
    key: 'clinic',
    icon: '🏥',
    title: 'Practice details',
    sub: 'Header on PDF prescriptions',
    screen: 'ClinicProfile',
  },
  {
    key: 'currency',
    icon: '₹',
    title: 'Currency',
    sub: 'Amounts on prescriptions and visits',
    screen: 'CurrencySettings',
  },
  {
    key: 'visitAi',
    icon: '🧠',
    title: 'Visit AI',
    sub: 'On-device Gemma 4 visit dictation',
    screen: 'VisitAiSettings',
  },
  {
    key: 'inputMode',
    icon: '⌨',
    title: 'Input Mode',
    sub: 'Choose keyboard, voice, or gestures',
    screen: 'InputModeSettings',
  },
  {
    key: 'gestures',
    icon: '👋',
    title: 'Manage Gestures',
    sub: 'Map gestures to words',
    screen: 'ManageGestures',
  },
];

export default function SettingsScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        {ROWS.map((row, index) => (
          <TouchableOpacity
            key={row.key}
            testID={`settings-row-${row.key}`}
            style={flatPressableRow({ last: index === ROWS.length - 1 })}
            onPress={() => navigation.navigate(row.screen)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{row.icon}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
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
  content: screenContent(40),
  section: flatSection(),
  icon: {
    fontSize: 26,
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 13,
    color: '#999',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
  },
});
