import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ROWS = [
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
    <View style={styles.container}>
      {ROWS.map(row => (
        <TouchableOpacity
          key={row.key}
          style={styles.row}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
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
