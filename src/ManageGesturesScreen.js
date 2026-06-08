import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import GesturePad from './GesturePad';
import { GESTURE_KINDS } from './gestureKinds';
import {
  addExpansion,
  addGlyphGesture,
  addSequenceGesture,
  deleteGesture,
  getGestures,
} from './database';
import { GESTURE_GUIDE_SECTIONS, GESTURE_GUIDE_TITLE } from './gestureInstructions';
import { buildTouchSequence } from './gestureRecognizer';
import { flatPressableRow, flatRow, flatSection, screenColors, screenContent } from './screenLayout';

const ADD_MODES = [
  { id: GESTURE_KINDS.GLYPH, label: 'Symbol' },
  { id: GESTURE_KINDS.EXPANSION, label: 'Phrase' },
  { id: GESTURE_KINDS.SEQUENCE, label: 'Shortcut' },
];

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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },
});

export function formatGestureLabel(gesture) {
  const kind = gesture.kind || GESTURE_KINDS.SEQUENCE;
  if (kind === GESTURE_KINDS.GLYPH) {
    return gesture.symbol?.trim() || 'Symbol';
  }
  if (kind === GESTURE_KINDS.EXPANSION) {
    return `${gesture.code?.trim() || '?'} → ${gesture.word}`;
  }
  if (gesture.code?.trim()) {
    return `${gesture.code.trim()} → ${gesture.word} (shortcut)`;
  }
  return gesture.word;
}

function ModeTabs({ mode, onChange }) {
  return (
    <View style={styles.modeTabs}>
      {ADD_MODES.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.modeTab, mode === item.id && styles.modeTabActive]}
          onPress={() => onChange(item.id)}
        >
          <Text style={[styles.modeTabText, mode === item.id && styles.modeTabTextActive]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function GlyphAddSheet({ onSaved, onBusyChange }) {
  const [symbol, setSymbol] = useState('');
  const [stroke, setStroke] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [padResetKey, setPadResetKey] = useState(0);

  async function handleSave() {
    Keyboard.dismiss();
    if (!symbol.trim() || !stroke) return;

    setSaving(true);
    try {
      await addGlyphGesture(symbol.trim(), JSON.stringify(stroke));
      onSaved();
    } catch (error) {
      Alert.alert('Error', String(error?.message ?? error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEnabled={!isDrawing}>
      <Text style={styles.fieldLabel}>Symbol *</Text>
      <TextInput
        style={[styles.fieldInput, { marginBottom: 16 }]}
        value={symbol}
        onChangeText={setSymbol}
        placeholder="e.g. U"
        placeholderTextColor="#bbb"
        autoCapitalize="characters"
      />
      <Text style={styles.hint}>Draw one stroke for this symbol. Symbols chain into codes like U, UR, URI.</Text>
      <GesturePad
        resetKey={padResetKey}
        onStrokeComplete={(nextStroke) => {
          if (!nextStroke) return;
          setStroke(nextStroke);
          setPadResetKey((previous) => previous + 1);
        }}
        onDrawingChange={(drawing) => {
          setIsDrawing(drawing);
          onBusyChange?.(drawing);
        }}
      />
      <View style={styles.captureCard}>
        <Text style={styles.captureValue}>
          {stroke ? `Captured symbol stroke for ${symbol.trim() || '?'}` : 'Draw one stroke above'}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.saveBtn, (!symbol.trim() || !stroke || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!symbol.trim() || !stroke || saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Symbol'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ExpansionAddSheet({ onSaved, onBusyChange }) {
  const [code, setCode] = useState('');
  const [inserts, setInserts] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    Keyboard.dismiss();
    if (!code.trim() || !inserts.trim()) return;

    setSaving(true);
    onBusyChange?.(true);
    try {
      await addExpansion(code.trim(), inserts.trim());
      onSaved();
    } catch (error) {
      Alert.alert('Error', String(error?.message ?? error));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>Code *</Text>
      <TextInput
        style={[styles.fieldInput, { marginBottom: 16 }]}
        value={code}
        onChangeText={setCode}
        placeholder="e.g. URI"
        placeholderTextColor="#bbb"
        autoCapitalize="characters"
      />
      <Text style={styles.fieldLabel}>Inserts *</Text>
      <TextInput
        style={[styles.fieldInput, { marginBottom: 20 }]}
        value={inserts}
        onChangeText={setInserts}
        placeholder="e.g. Upper Respiratory Infection"
        placeholderTextColor="#bbb"
        autoCapitalize="words"
      />
      <Text style={styles.hint}>No drawing needed. Add U → urine and URI → Upper Respiratory Infection for retroactive expansion.</Text>
      <TouchableOpacity
        style={[styles.saveBtn, (!code.trim() || !inserts.trim() || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!code.trim() || !inserts.trim() || saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Phrase'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SequenceAddSheet({ onSaved, onBusyChange }) {
  const [code, setCode] = useState('');
  const [inserts, setInserts] = useState('');
  const [strokes, setStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [padResetKey, setPadResetKey] = useState(0);

  const sequence = buildTouchSequence(strokes);

  async function handleSave() {
    Keyboard.dismiss();
    if (!inserts.trim() || !sequence) return;

    setSaving(true);
    try {
      await addSequenceGesture(inserts.trim(), JSON.stringify(sequence), code.trim() || null);
      onSaved();
    } catch (error) {
      Alert.alert('Error', String(error?.message ?? error));
    } finally {
      setSaving(false);
    }
  }

  function handleStrokeComplete(stroke) {
    if (!stroke) return;
    setStrokes((previous) => [...previous, stroke]);
    setPadResetKey((previous) => previous + 1);
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEnabled={!isDrawing}>
      <Text style={styles.fieldLabel}>Shortcut label</Text>
      <TextInput
        style={[styles.fieldInput, { marginBottom: 16 }]}
        value={code}
        onChangeText={setCode}
        placeholder="e.g. URI"
        placeholderTextColor="#bbb"
        autoCapitalize="characters"
      />
      <Text style={styles.fieldLabel}>Inserts *</Text>
      <TextInput
        style={[styles.fieldInput, { marginBottom: 20 }]}
        value={inserts}
        onChangeText={setInserts}
        placeholder="e.g. Upper Respiratory Infection"
        placeholderTextColor="#bbb"
        autoCapitalize="words"
      />
      <Text style={styles.fieldLabel}>Gesture Strokes</Text>
      <Text style={styles.hint}>Optional multi-stroke shortcut that inserts in one sequence without spelling symbols.</Text>
      <GesturePad
        resetKey={padResetKey}
        strokeIndex={strokes.length}
        sessionActive={strokes.length > 0}
        onStrokeComplete={handleStrokeComplete}
        onDrawingChange={(drawing) => {
          setIsDrawing(drawing);
          onBusyChange?.(drawing);
        }}
      />
      <View style={styles.captureCard}>
        <Text style={styles.captureValue}>
          {strokes.length > 0
            ? `${strokes.length} stroke${strokes.length === 1 ? '' : 's'} captured`
            : 'Draw at least one stroke above'}
        </Text>
      </View>
      {strokes.length > 0 ? (
        <View style={styles.strokeActions}>
          <TouchableOpacity onPress={() => { setStrokes((previous) => previous.slice(0, -1)); setPadResetKey((previous) => previous + 1); }}>
            <Text style={styles.reRecordLink}>Remove Last Stroke</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStrokes([]); setPadResetKey((previous) => previous + 1); }}>
            <Text style={styles.reRecordLink}>Clear All Strokes</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.saveBtn, (!inserts.trim() || !sequence || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!inserts.trim() || !sequence || saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Shortcut'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function AddSheet({ onSaved, onBusyChange }) {
  const [mode, setMode] = useState(GESTURE_KINDS.GLYPH);

  return (
    <View>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === GESTURE_KINDS.GLYPH ? (
        <GlyphAddSheet onSaved={onSaved} onBusyChange={onBusyChange} />
      ) : null}
      {mode === GESTURE_KINDS.EXPANSION ? (
        <ExpansionAddSheet onSaved={onSaved} onBusyChange={onBusyChange} />
      ) : null}
      {mode === GESTURE_KINDS.SEQUENCE ? (
        <SequenceAddSheet onSaved={onSaved} onBusyChange={onBusyChange} />
      ) : null}
    </View>
  );
}

export default function ManageGesturesScreen({ navigation }) {
  const [gestures, setGestures] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [addSheetBusy, setAddSheetBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getGestures();
      setGestures(rows);
    } catch (error) {
      Alert.alert('Could not load gestures', String(error?.message ?? error));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!addVisible) setAddSheetBusy(false);
  }, [addVisible]);

  function handleDelete(gesture) {
    Alert.alert('Delete Gesture', `Remove "${formatGestureLabel(gesture)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGesture(gesture.id);
          setGestures((previous) => previous.filter((item) => item.id !== gesture.id));
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
        <View style={styles.guideCard} testID="gesture-guide-card">
          <Text style={styles.guideTitle}>{GESTURE_GUIDE_TITLE}</Text>
          <Text style={styles.guideBody}>{GESTURE_GUIDE_SECTIONS.overview}</Text>
          {GESTURE_GUIDE_SECTIONS.setup.map((step, index) => (
            <Text key={step} style={styles.guideStep}>
              {`${index + 1}. ${step}`}
            </Text>
          ))}
          <Text style={styles.guideNote}>{GESTURE_GUIDE_SECTIONS.usingInFields}</Text>
        </View>

        <View style={styles.testBanner}>
          <TouchableOpacity
            style={flatPressableRow({ last: true })}
            onPress={() => navigation.navigate('TestGesture')}
            activeOpacity={0.8}
          >
            <Text style={styles.testCardIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.testCardTitle}>Test a Gesture</Text>
              <Text style={styles.testCardSub}>Draw symbols or shortcuts and see live expansion</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gesturesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Gestures</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {gestures.length === 0 ? (
            <Text style={styles.empty}>No gestures yet. Tap + Add to create one.</Text>
          ) : (
            gestures.map((gesture, index) => (
              <View
                key={gesture.id}
                style={[styles.gestureRow, index === gestures.length - 1 && styles.gestureRowLast]}
              >
                <Text style={styles.gestureIcon}>👋</Text>
                <Text style={styles.gestureWord}>{formatGestureLabel(gesture)}</Text>
                <TouchableOpacity
                  onPress={() => handleDelete(gesture)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={addVisible}
        onClose={handleCloseAddSheet}
        title="Add Gesture"
        closeDisabled={addSheetBusy}
      >
        <AddSheet
          onSaved={() => {
            setAddSheetBusy(false);
            setAddVisible(false);
            load();
          }}
          onBusyChange={setAddSheetBusy}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenColors.bg },
  content: screenContent(40),
  guideCard: {
    ...flatSection({ marginBottom: 12, paddingVertical: 14 }),
    paddingHorizontal: 16,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  guideBody: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 10,
  },
  guideStep: {
    fontSize: 13,
    color: '#555',
    lineHeight: 19,
    marginBottom: 6,
  },
  guideNote: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    marginTop: 4,
  },
  testBanner: {
    ...flatSection({ tinted: true, marginBottom: 12 }),
    backgroundColor: '#4f6ef7',
    borderColor: '#4f6ef7',
  },
  testCardIcon: { fontSize: 28, marginRight: 12 },
  testCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  testCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  chevron: { fontSize: 22, color: 'rgba(255,255,255,0.6)' },
  gesturesSection: flatSection(),
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
    ...flatRow(),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gestureRowLast: {
    borderBottomWidth: 0,
  },
  gestureIcon: { fontSize: 22 },
  gestureWord: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  deleteIcon: { fontSize: 18 },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#eef2ff',
  },
  modeTabActive: {
    backgroundColor: '#4f6ef7',
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f6ef7',
  },
  modeTabTextActive: {
    color: '#fff',
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
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  hint: { fontSize: 13, color: '#999', marginBottom: 12, lineHeight: 18 },
  captureCard: {
    marginTop: 14,
    backgroundColor: screenColors.tint,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: screenColors.border,
    padding: 16,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  captureValue: {
    fontSize: 15,
    color: '#1a1a2e',
    textAlign: 'center',
  },
  strokeActions: {
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  reRecordLink: {
    color: '#4f6ef7',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
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
});
