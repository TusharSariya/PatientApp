import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Keyboard,
  Animated,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useFocusEffect } from '@react-navigation/native';
import { clearDictationOwner, getDictationOwner, setDictationOwner } from './dictationOwner';
import { useGestureTextInput } from './GestureInputProvider';
import { getBalanceSummary } from './database';

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function insertDictationAtSelection(currentValue, selection, transcript) {
  const source = currentValue ?? '';
  const phrase = transcript ?? '';
  const start = clamp(selection?.start ?? source.length, 0, source.length);
  const end = clamp(selection?.end ?? start, start, source.length);
  const before = source.slice(0, start);
  const after = source.slice(end);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before) && !/^\s/.test(phrase);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after) && !/\s$/.test(phrase);
  const inserted = `${needsLeadingSpace ? ' ' : ''}${phrase}${needsTrailingSpace ? ' ' : ''}`;

  return {
    value: `${before}${inserted}${after}`,
    cursor: before.length + inserted.length,
  };
}

function composeHandlers(...handlers) {
  return (...args) => {
    handlers.forEach(handler => handler?.(...args));
  };
}

const Field = React.forwardRef(({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  onSelectionChange,
  selection,
  showSoftInputOnFocus,
  multiline,
}, ref) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={ref}
      style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChange}
      showSoftInputOnFocus={showSoftInputOnFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onSelectionChange={onSelectionChange}
      selection={selection}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor="#bbb"
      placeholder="—"
    />
  </View>
));

export default function PatientDetailScreen({ route, navigation }) {
  const { patient } = route.params;
  const [recognizing, setRecognizing] = useState(false);
  const [balances, setBalances] = useState({ patientBalance: 0, familyBalance: 0 });
  const [notes, setNotes] = useState('');

  const notesRef = useRef(null);
  const notesInput = useGestureTextInput({ label: 'Notes', value: notes, setValue: setNotes, inputRef: notesRef });

  const dictationFields = [
    { ref: notesRef, setter: setNotes, value: notes, label: 'Notes', multiline: true, input: notesInput },
  ];

  const activeIndexRef = useRef(0);
  const shouldAdvanceRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const fabBottom = useRef(new Animated.Value(32)).current;
  const dictationOwner = 'patient-detail';

  React.useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => Animated.timing(fabBottom, {
        toValue: e.endCoordinates.height + 16,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start()
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => Animated.timing(fabBottom, {
        toValue: 32,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start()
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [fabBottom]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        const summary = await getBalanceSummary(patient.id);
        if (isActive) {
          setBalances({
            patientBalance: summary.patientBalance ?? 0,
            familyBalance: summary.familyBalance ?? 0,
          });
        }
      })().catch(() => {});
      return () => {
        isActive = false;
      };
    }, [patient.id])
  );

  useSpeechRecognitionEvent('start', () => {
    if (getDictationOwner() !== dictationOwner) return;
    lastTranscriptRef.current = '';
    setRecognizing(true);
  });
  useSpeechRecognitionEvent('end', () => {
    if (getDictationOwner() !== dictationOwner) return;
    clearDictationOwner(dictationOwner);
    lastTranscriptRef.current = '';
    setRecognizing(false);
    if (shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      const next = (activeIndexRef.current + 1) % dictationFields.length;
      activeIndexRef.current = next;
      dictationFields[next]?.ref.current?.focus();
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (getDictationOwner() !== dictationOwner) return;
    const text = (event.results[0]?.transcript ?? '').trim();
    const field = dictationFields[activeIndexRef.current];
    if (!text || !field) return;

    if (text === lastTranscriptRef.current) return;
    let chunk = text;
    if (text.startsWith(lastTranscriptRef.current)) {
      chunk = text.slice(lastTranscriptRef.current.length).trimStart();
    }
    lastTranscriptRef.current = text;
    if (!chunk) return;

    const next = insertDictationAtSelection(field.value, field.input.selection, chunk);
    field.setter(next.value);
    field.input.setSelection?.({ start: next.cursor, end: next.cursor });
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (getDictationOwner() !== dictationOwner) return;
    clearDictationOwner(dictationOwner);
    Alert.alert('Dictation error', event.message ?? 'Something went wrong.');
    setRecognizing(false);
  });

  function openMedicines() {
    navigation.navigate('PatientMedicines', { patient });
  }

  function openVisits() {
    navigation.navigate('PatientVisits', { patient });
  }

  function openEditPatient() {
    navigation.navigate('EditPatient', { patient });
  }

  async function handlePress() {
    if (recognizing) {
      shouldAdvanceRef.current = true;
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed for dictation.');
      return;
    }
    setDictationOwner(dictationOwner);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  }

  function handleLongPress() {
    if (recognizing) ExpoSpeechRecognitionModule.stop();
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.name}>{patient.name}</Text>
          {patient.family_id ? <Text style={styles.detail}>👨‍👩‍👧‍👦 Family #{patient.family_id}</Text> : null}
          {patient.dob ? <Text style={styles.detail}>🎂 {patient.dob}</Text> : null}
          <Text style={styles.detail}>📞 {patient.phone}</Text>
          <Text style={styles.detail}>📍 {patient.address}</Text>
          <Text style={styles.detail}>Patient Balance: ${Number(balances.patientBalance ?? 0).toFixed(2)}</Text>
          <Text style={styles.detail}>Family Balance: ${Number(balances.familyBalance ?? 0).toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.medCard} onPress={openEditPatient} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.medTitle}>Patient Details</Text>
            <Text style={styles.medSubtitle}>Open editable demographics and contact details.</Text>
          </View>
          <View style={styles.medButton}>
            <Text style={styles.medButtonText}>Open</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.medCard, { marginTop: 10 }]} onPress={openVisits} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.medTitle}>Visits</Text>
            <Text style={styles.medSubtitle}>View visit history and create a new visit.</Text>
          </View>
          <View style={styles.medButton}>
            <Text style={styles.medButtonText}>Open</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.medCard, { marginTop: 10 }]} onPress={openMedicines} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.medTitle}>Medicines</Text>
            <Text style={styles.medSubtitle}>View current medicines and history.</Text>
          </View>
          <View style={styles.medButton}>
            <Text style={styles.medButtonText}>Open</Text>
          </View>
        </TouchableOpacity>
        {dictationFields.map((f, i) => (
          <Field
            key={f.label}
            ref={f.ref}
            label={f.label}
            value={f.value}
            onChange={f.setter}
            onFocus={composeHandlers(f.input.onFocus, () => { activeIndexRef.current = i; })}
            onBlur={f.input.onBlur}
            onSelectionChange={f.input.onSelectionChange}
            selection={f.input.selection}
            showSoftInputOnFocus={f.input.showSoftInputOnFocus}
            multiline={f.multiline}
          />
        ))}
      </ScrollView>

      <Animated.View style={[styles.fab, { bottom: fabBottom }]}>
        <Pressable
          style={[styles.fabInner, recognizing && styles.fabActive]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={500}
        >
          <Text style={styles.fabIcon}>{recognizing ? '⏹' : '🎙'}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  content: {
    padding: 24,
    paddingBottom: 100,
    flexGrow: 1,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  detail: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  medCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce2f7',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  medTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  medSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5f6d8a',
  },
  medButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  medButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  fieldInputMultiline: {
    height: 88,
    textAlignVertical: 'top',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#4f6ef7',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabInner: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: '#4f6ef7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabActive: {
    backgroundColor: '#e74c3c',
  },
  fabIcon: {
    fontSize: 28,
  },
});
