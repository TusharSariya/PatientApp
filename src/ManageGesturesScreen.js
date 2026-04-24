import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  Platform,
  Modal,
  Keyboard,
} from 'react-native';
import { getGestures, addGesture, deleteGesture } from './database';
import { recordGesture, matchGesture } from './gestureRecognizer';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- BottomSheet ----
function BottomSheet({ visible, onClose, title, children, closeDisabled = false }) {
  function handleClose() {
    if (!closeDisabled) onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={sheet.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={sheet.container}>
          <View style={sheet.handle} />
          {title ? <Text style={sheet.title}>{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd',
    alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 20 },
});

// ---- RecordWidget ----
function RecordWidget({ onDone, onPhaseChange }) {
  const [phase, setPhase] = useState('idle'); // idle | countdown | recording | done
  const [count, setCount] = useState(3);
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);

  function reset() {
    setPhase('idle');
    setCount(3);
    setProgress(0);
  }

  async function start() {
    Keyboard.dismiss();
    for (let i = 3; i >= 1; i--) {
      if (!mounted.current) return;
      setPhase('countdown');
      setCount(i);
      await sleep(1000);
    }
    if (!mounted.current) return;
    setPhase('recording');
    setProgress(0);

    try {
      const data = await recordGesture(p => {
        if (mounted.current) setProgress(p);
      });
      console.log('[gesture] recorded', data?.length, 'samples');
      if (!mounted.current) return;
      setPhase('done');
      onDone(data);
    } catch (e) {
      console.warn('[gesture] recording error', e);
      if (!mounted.current) return;
      setPhase('idle');
      Alert.alert('Recording failed', String(e?.message ?? e));
    }
  }

  if (phase === 'countdown') {
    return (
      <View style={rec.box}>
        <Text style={rec.countNum}>{count}</Text>
        <Text style={rec.countSub}>Get ready…</Text>
      </View>
    );
  }

  if (phase === 'recording') {
    return (
      <View style={rec.box}>
        <View style={rec.track}>
          <View style={[rec.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={rec.recordingLabel}>Recording…</Text>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={rec.box}>
        <Text style={rec.doneText}>✓ Captured</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={rec.btn} onPress={start} activeOpacity={0.75}>
      <Text style={rec.btnText}>⏺  Record Gesture</Text>
    </TouchableOpacity>
  );
}

const rec = StyleSheet.create({
  box: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#f8f9ff',
    borderRadius: 14,
    marginBottom: 4,
  },
  countNum: { fontSize: 52, fontWeight: '800', color: '#4f6ef7' },
  countSub: { fontSize: 14, color: '#888', marginTop: 4 },
  track: {
    width: '80%', height: 8, backgroundColor: '#e8e8e8',
    borderRadius: 4, overflow: 'hidden', marginBottom: 10,
  },
  fill: { height: '100%', backgroundColor: '#4f6ef7', borderRadius: 4 },
  recordingLabel: { fontSize: 14, color: '#555' },
  doneText: { fontSize: 18, fontWeight: '700', color: '#27ae60', marginBottom: 8 },
  reRecord: { fontSize: 14, color: '#4f6ef7', fontWeight: '600' },
  btn: {
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

// ---- AddSheet ----
function AddSheet({ onSaved, onBusyChange }) {
  const [word, setWord] = useState('');
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  const [recordPhase, setRecordPhase] = useState('idle');

  useEffect(() => {
    console.log('[AddSheet] mounted');
    return () => console.log('[AddSheet] unmounted');
  }, []);

  useEffect(() => {
    console.log('[AddSheet] state: word=', JSON.stringify(word), 'dataLen=', data?.length, 'saving=', saving);
  }, [word, data, saving]);

  useEffect(() => {
    const isBusy = recordPhase === 'countdown' || recordPhase === 'recording';
    onBusyChange?.(isBusy);
  }, [recordPhase, onBusyChange]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  async function handleSave() {
    Keyboard.dismiss();
    console.log('[gesture] handleSave word=', word, 'dataLen=', data?.length);
    if (!word.trim() || !data) return;
    setSaving(true);
    try {
      const id = await addGesture(word.trim(), JSON.stringify(data));
      console.log('[gesture] saved with id', id);
      onSaved();
    } catch (e) {
      console.warn('[gesture] save error', e);
      Alert.alert('Error', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>Word *</Text>
      <TextInput
        style={[styles.fieldInput, { marginBottom: 20 }]}
        value={word}
        onChangeText={setWord}
        placeholder="e.g. Cough"
        placeholderTextColor="#bbb"
        autoCapitalize="words"
      />

      <Text style={styles.fieldLabel}>Gesture</Text>
      <Text style={styles.hint}>Press record, then perform your gesture</Text>
      <RecordWidget
        key={widgetKey}
        onDone={d => { console.log('[AddSheet] onDone called with', d?.length, 'samples'); setData(d); }}
        onPhaseChange={setRecordPhase}
      />

      {data && (
        <TouchableOpacity onPress={() => { setData(null); setWidgetKey(k => k + 1); }}>
          <Text style={styles.reRecordLink}>Re-record</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, (!word.trim() || !data || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!word.trim() || !data || saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? 'Saving…' : !word.trim() ? 'Enter a word above' : !data ? 'Record a gesture above' : 'Save Gesture'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---- TestSheet ----
function TestSheet({ gestures }) {
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null); // undefined = not run yet, null = no match, obj = match
  const [widgetKey, setWidgetKey] = useState(0);

  function handleRecorded(d) {
    setData(d);
    const match = matchGesture(d, gestures);
    setResult(match ?? null);
  }

  function reset() {
    setData(null);
    setResult(null);
    setWidgetKey(k => k + 1);
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.hint}>
        {gestures.length === 0
          ? 'No gestures saved yet. Add one first.'
          : `Testing against ${gestures.length} saved gesture${gestures.length !== 1 ? 's' : ''}`}
      </Text>

      <RecordWidget key={widgetKey} onDone={handleRecorded} />

      {data && (
        result ? (
          <View style={styles.resultMatch}>
            <Text style={styles.resultLabel}>Detected</Text>
            <Text style={styles.resultWord}>{result.word.toUpperCase()}</Text>
          </View>
        ) : (
          <View style={styles.resultNone}>
            <Text style={styles.resultNoneText}>✗ No match</Text>
            <Text style={styles.resultNoneSub}>Try a clearer gesture, or lower the threshold</Text>
          </View>
        )
      )}

      {data && (
        <TouchableOpacity onPress={reset}>
          <Text style={styles.reRecordLink}>Try Again</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ---- Main Screen ----
export default function ManageGesturesScreen({ navigation }) {
  const [gestures, setGestures] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [testVisible, setTestVisible] = useState(false);
  const [addSheetBusy, setAddSheetBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getGestures();
      console.log('[gesture] load returned', rows.length, 'rows');
      setGestures(rows);
    } catch (e) {
      console.warn('[gesture] load error', e);
      Alert.alert('Could not load gestures', String(e?.message ?? e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!addVisible) setAddSheetBusy(false);
  }, [addVisible]);

  function handleDelete(g) {
    Alert.alert('Delete Gesture', `Remove "${g.word}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteGesture(g.id);
          setGestures(prev => prev.filter(x => x.id !== g.id));
        },
      },
    ]);
  }

  function handleCloseAddSheet() {
    if (addSheetBusy) return;
    setAddVisible(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Test card */}
        <TouchableOpacity style={styles.testCard} onPress={() => setTestVisible(true)} activeOpacity={0.8}>
          <Text style={styles.testCardIcon}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.testCardTitle}>Test a Gesture</Text>
            <Text style={styles.testCardSub}>Record a gesture and see what it matches</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Gesture list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Gestures</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {gestures.length === 0 ? (
          <Text style={styles.empty}>No gestures yet. Tap + Add to create one.</Text>
        ) : (
          gestures.map(g => (
            <View key={g.id} style={styles.gestureRow}>
              <Text style={styles.gestureIcon}>👋</Text>
              <Text style={styles.gestureWord}>{g.word}</Text>
              <TouchableOpacity onPress={() => handleDelete(g)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.deleteIcon}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add sheet */}
      <BottomSheet
        visible={addVisible}
        onClose={handleCloseAddSheet}
        title="Add Gesture"
        closeDisabled={addSheetBusy}
      >
        <AddSheet
          onSaved={() => { setAddSheetBusy(false); setAddVisible(false); load(); }}
          onBusyChange={setAddSheetBusy}
        />
      </BottomSheet>

      {/* Test sheet */}
      <BottomSheet
        visible={testVisible}
        onClose={() => setTestVisible(false)}
        title="Test Gesture"
      >
        <TestSheet gestures={gestures} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 20, paddingBottom: 40 },

  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f6ef7',
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
    gap: 12,
  },
  testCardIcon: { fontSize: 28 },
  testCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  testCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  chevron: { fontSize: 22, color: 'rgba(255,255,255,0.6)' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  addBtn: {
    backgroundColor: '#4f6ef7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  empty: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 24 },

  gestureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  gestureIcon: { fontSize: 22 },
  gestureWord: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  deleteIcon: { fontSize: 18 },

  // Shared form styles
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: '#555',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  hint: { fontSize: 13, color: '#999', marginBottom: 12 },
  reRecordLink: {
    color: '#4f6ef7', fontWeight: '600', fontSize: 14,
    textAlign: 'center', marginTop: 12, marginBottom: 4,
  },
  saveBtn: {
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: {
    backgroundColor: '#c5cdf5',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Test results
  resultMatch: {
    alignItems: 'center',
    backgroundColor: '#eafaf1',
    borderRadius: 14,
    paddingVertical: 20,
    marginTop: 16,
  },
  resultLabel: { fontSize: 13, color: '#27ae60', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultWord: { fontSize: 36, fontWeight: '800', color: '#1a1a2e', marginTop: 6 },
  resultNone: {
    alignItems: 'center',
    backgroundColor: '#fef9f0',
    borderRadius: 14,
    paddingVertical: 20,
    marginTop: 16,
  },
  resultNoneText: { fontSize: 18, fontWeight: '700', color: '#e67e22' },
  resultNoneSub: { fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' },
});
