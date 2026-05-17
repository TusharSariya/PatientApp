import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { formatMoney, getCurrencyOption, SUPPORTED_CURRENCIES } from './currency';
import { getAppSettings, saveAppSettings } from './database';

export default function CurrencySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('INR');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getAppSettings();
      setCurrencyCode(settings.currencyCode);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function handleSelect(code) {
    if (code === currencyCode || saving) return;
    setSaving(true);
    try {
      const settings = await saveAppSettings({ currencyCode: code });
      setCurrencyCode(settings.currencyCode);
    } catch {
      Alert.alert('Error', 'Could not save currency.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f6ef7" />
      </View>
    );
  }

  const sample = formatMoney(150, currencyCode);

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Amounts on prescriptions and visit screens use this currency.
      </Text>
      <Text style={styles.sampleLabel}>Preview</Text>
      <Text style={styles.sampleValue}>{sample}</Text>
      {SUPPORTED_CURRENCIES.map((currency) => {
        const selected = currency.code === currencyCode;
        const option = getCurrencyOption(currency.code);
        return (
          <TouchableOpacity
            key={currency.code}
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => handleSelect(currency.code)}
            disabled={saving}
            testID={`currency-option-${currency.code}`}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{currency.label}</Text>
              <Text style={styles.rowSub}>
                {currency.code} · {option.symbol} · {formatMoney(99, currency.code)}
              </Text>
            </View>
            <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : ''}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f6fa',
  },
  intro: {
    fontSize: 14,
    color: '#5f6d8a',
    marginBottom: 16,
    lineHeight: 20,
  },
  sampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sampleValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: {
    borderColor: '#4f6ef7',
    backgroundColor: '#f3f6ff',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  rowSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  check: {
    fontSize: 20,
    color: 'transparent',
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  checkSelected: {
    color: '#4f6ef7',
  },
});
