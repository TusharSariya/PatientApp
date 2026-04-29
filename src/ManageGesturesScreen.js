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
import { addGesture, deleteGesture, getGestures } from './database';

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

function AddSheet({ onSaved, onBusyChange }) {
  const [word, setWord] = useState('');
  const [data, setData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [padResetKey, setPadResetKey] = useState(0);

  async function handleSave() {
    Keyboard.dismiss();
    if (!word.trim() || !data) return;

    setSaving(true);
    try {
      await addGesture(word.trim(), JSON.stringify(data));
      onSaved();
    } catch (error) {
      Alert.alert('Error', String(error?.message ?? error));
    } finally {
      setSaving(false);
    }
  }

  function handleClearGesture() {
    setData(null);
    setPadResetKey(previous => previous + 1);
  }

  function handleDrawingChange(drawing) {
    setIsDrawing(drawing);
    if (drawing) setData(null);
    onBusyChange?.(drawing);
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!isDrawing}
    >
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
      <Text style={styles.hint}>Draw the gesture using one or more fingers, then lift them to capture it.</Text>
      <GesturePad
        resetKey={padResetKey}
        onGestureComplete={gesture => setData(gesture)}
        onDrawingChange={handleDrawingChange}
      />

      <View style={styles.captureCard}>
        <Text style={styles.captureLabel}>
          {isDrawing ? 'Drawing' : data ? 'Captured' : 'Awaiting Gesture'}
        </Text>
        <Text style={styles.captureValue}>
          {isDrawing
            ? 'Lift your fingers to capture this gesture.'
            : data
              ? `${data.maxTouches} finger${data.maxTouches === 1 ? '' : 's'} · ${data.points.length} normalized samples`
              : 'Draw a gesture large enough to enable saving.'}
        </Text>
      </View>

      <View style={styles.linkSlot}>
        {data ? (
          <TouchableOpacity onPress={handleClearGesture}>
            <Text style={styles.reRecordLink}>Clear Gesture</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, (!word.trim() || !data || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!word.trim() || !data || saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? 'Saving…' : !word.trim() ? 'Enter a word above' : !data ? 'Capture a gesture above' : 'Save Gesture'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
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
    Alert.alert('Delete Gesture', `Remove "${gesture.word}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGesture(gesture.id);
          setGestures(previous => previous.filter(item => item.id !== gesture.id));
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
        <TouchableOpacity
          style={styles.testCard}
          onPress={() => navigation.navigate('TestGesture')}
          activeOpacity={0.8}
        >
          <Text style={styles.testCardIcon}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.testCardTitle}>Test a Gesture</Text>
            <Text style={styles.testCardSub}>Draw a saved gesture and see the associated word</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Gestures</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {gestures.length === 0 ? (
          <Text style={styles.empty}>No gestures yet. Tap + Add to create one.</Text>
        ) : (
          gestures.map(gesture => (
            <View key={gesture.id} style={styles.gestureRow}>
              <Text style={styles.gestureIcon}>👋</Text>
              <Text style={styles.gestureWord}>{gesture.word}</Text>
              <TouchableOpacity
                onPress={() => handleDelete(gesture)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.deleteIcon}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    padding: 16,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
  },
  captureLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f6ef7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  captureValue: {
    fontSize: 15,
    color: '#1a1a2e',
    marginTop: 6,
    textAlign: 'center',
  },
  linkSlot: {
    minHeight: 28,
    justifyContent: 'center',
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
