import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getGestures } from './database';
import GesturePad from './GesturePad';
import { isTouchGestureData, matchGesture } from './gestureRecognizer';

const GestureInputContext = createContext(null);

let nextFieldId = 1;

function getDefaultSelection(text) {
  const position = text?.length ?? 0;
  return { start: position, end: position };
}

function clampSelection(selection, text) {
  const length = text?.length ?? 0;
  if (!selection) return { start: length, end: length };

  return {
    start: Math.max(0, Math.min(selection.start, length)),
    end: Math.max(0, Math.min(selection.end, length)),
  };
}

function insertWordAtSelection(text, word, selection) {
  const safeText = text ?? '';
  const safeSelection = clampSelection(selection, safeText);
  const before = safeText.slice(0, safeSelection.start);
  const after = safeText.slice(safeSelection.end);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);
  const token = `${needsLeadingSpace ? ' ' : ''}${word}${needsTrailingSpace ? ' ' : ''}`;
  const nextText = `${before}${token}${after}`;
  const cursor = before.length + token.length;

  return {
    text: nextText,
    selection: { start: cursor, end: cursor },
  };
}

export function GestureInputProvider({ children }) {
  const [activeField, setActiveField] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [loadingGestures, setLoadingGestures] = useState(false);
  const [gestures, setGestures] = useState([]);
  const [padResetKey, setPadResetKey] = useState(0);
  const [resultState, setResultState] = useState('idle');
  const [lastMatchedWord, setLastMatchedWord] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);

  const activeFieldRef = useRef(null);
  const overlayVisibleRef = useRef(false);
  const blurTimeoutRef = useRef(null);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  useEffect(() => {
    overlayVisibleRef.current = overlayVisible;
  }, [overlayVisible]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!overlayVisible) return undefined;

    let active = true;

    async function loadGestures() {
      setLoadingGestures(true);
      try {
        const rows = await getGestures();
        if (!active) return;
        setGestures(rows.filter(gesture => isTouchGestureData(gesture.data)));
      } catch {
        if (active) setGestures([]);
      } finally {
        if (active) setLoadingGestures(false);
      }
    }

    loadGestures();

    return () => {
      active = false;
    };
  }, [overlayVisible]);

  function clearBlurTimer() {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }

  function focusField(field) {
    clearBlurTimer();
    setActiveField(field);
  }

  function blurField(fieldId) {
    clearBlurTimer();
    blurTimeoutRef.current = setTimeout(() => {
      if (overlayVisibleRef.current) return;
      setActiveField(current => (current?.id === fieldId ? null : current));
    }, 140);
  }

  function releaseField(fieldId) {
    clearBlurTimer();
    setActiveField(current => (current?.id === fieldId ? null : current));
    if (activeFieldRef.current?.id === fieldId && overlayVisibleRef.current) {
      setOverlayVisible(false);
      setResultState('idle');
      setIsDrawing(false);
      setPadResetKey(previous => previous + 1);
    }
  }

  function openFieldOverlay(field) {
    if (!field) return;
    clearBlurTimer();
    activeFieldRef.current = field;
    setActiveField(field);
    setPadResetKey(previous => previous + 1);
    setResultState('idle');
    setLastMatchedWord('');
    setIsDrawing(false);
    setOverlayVisible(true);
    Keyboard.dismiss();
  }

  function resetOverlayState() {
    setResultState('idle');
    setLastMatchedWord('');
    setIsDrawing(false);
    setPadResetKey(previous => previous + 1);
  }

  function closeOverlay({ blurField = true } = {}) {
    setOverlayVisible(false);
    resetOverlayState();

    if (blurField) {
      const field = activeFieldRef.current;
      setTimeout(() => field?.blur?.(), 0);
    }
  }

  function clearResult() {
    resetOverlayState();
  }

  function switchToKeyboard() {
    const field = activeFieldRef.current;
    if (!field) {
      closeOverlay({ blurField: false });
      return;
    }

    clearBlurTimer();
    field.armKeyboardFocus?.();
    setOverlayVisible(false);
    resetOverlayState();

    field.blur?.();
    setTimeout(() => {
      field.focus?.();
    }, Platform.OS === 'ios' ? 180 : 80);
  }

  function insertMatchedWord(word) {
    const field = activeFieldRef.current;
    if (!field) return;

    const currentValue = field.getValue?.() ?? '';
    const currentSelection = field.getSelection?.() ?? getDefaultSelection(currentValue);
    const next = insertWordAtSelection(currentValue, word, currentSelection);

    field.setValue?.(next.text);
    field.setSelection?.(next.selection);
  }

  function handleDrawingChange(drawing) {
    setIsDrawing(drawing);
    if (drawing) setResultState('idle');
  }

  function handleGestureComplete(gesture) {
    setIsDrawing(false);

    if (!gesture) {
      setLastMatchedWord('');
      setResultState('invalid');
      return;
    }

    const match = matchGesture(gesture, gestures);
    if (!match) {
      setLastMatchedWord('');
      setResultState('no-match');
      return;
    }

    insertMatchedWord(match.word);
    setLastMatchedWord(match.word);
    setResultState('matched');
    setPadResetKey(previous => previous + 1);
  }

  const hasGestures = gestures.length > 0;

  return (
    <GestureInputContext.Provider value={{ focusField, blurField, releaseField, openFieldOverlay }}>
      <View style={styles.root}>
        {children}

        <Modal visible={overlayVisible} transparent animationType="slide" onRequestClose={() => closeOverlay()}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => closeOverlay()} />
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Gesture Input</Text>
                  <Text style={styles.title}>Insert into {activeField?.label ?? 'Field'}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={() => closeOverlay()}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
  
              {loadingGestures ? (
                <ActivityIndicator size="large" color="#4f6ef7" style={styles.loader} />
              ) : (
                <>
                  <Text style={styles.subhead}>
                    {hasGestures
                      ? 'Draw a saved gesture to insert its word. The sheet stays open until you close it.'
                      : 'No touch gestures are available yet. Add them in Manage Gestures first.'}
                  </Text>

                  <GesturePad
                    disabled={!hasGestures}
                    resetKey={padResetKey}
                    onGestureComplete={handleGestureComplete}
                    onDrawingChange={handleDrawingChange}
                  />

                  <View
                    style={[
                      styles.resultPanel,
                      resultState === 'matched' && styles.resultSuccess,
                      resultState === 'no-match' && styles.resultWarn,
                      resultState === 'invalid' && styles.resultWarn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultLabel,
                        resultState === 'matched' && styles.resultLabelSuccess,
                        (resultState === 'no-match' || resultState === 'invalid') && styles.resultLabelWarn,
                      ]}
                    >
                      {isDrawing
                        ? 'Drawing'
                        : resultState === 'matched'
                          ? 'Inserted'
                        : resultState === 'no-match'
                          ? 'No Matching Gesture'
                          : resultState === 'invalid'
                            ? 'Gesture Too Small'
                            : 'Ready'}
                    </Text>
                    <Text style={styles.resultText}>
                      {isDrawing
                        ? 'Lift your fingers to finish.'
                        : resultState === 'matched'
                          ? `"${lastMatchedWord}" inserted. Draw the next gesture or close when done.`
                        : resultState === 'no-match'
                          ? 'Try again with a more consistent gesture.'
                          : resultState === 'invalid'
                            ? 'Draw a larger gesture before lifting your fingers.'
                            : hasGestures
                              ? 'Open gesture mode only when you want to insert a saved word.'
                              : 'You can create gestures from Settings → Manage Gestures.'}
                    </Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={clearResult}>
                      <Text style={styles.secondaryButtonText}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryButton} onPress={switchToKeyboard}>
                      <Text style={styles.primaryButtonText}>Use Keyboard</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </GestureInputContext.Provider>
  );
}

export function useGestureTextInput({ label, value, setValue, inputRef }) {
  const context = useContext(GestureInputContext);
  const localRef = useRef(null);
  const resolvedRef = inputRef ?? localRef;
  const fieldIdRef = useRef(`gesture-input-${nextFieldId++}`);
  const releaseFieldRef = useRef(context?.releaseField);
  const focusModeRef = useRef('gesture');
  const valueRef = useRef(value ?? '');
  const [showSoftInputOnFocus, setShowSoftInputOnFocus] = useState(false);
  const [selection, setSelection] = useState(getDefaultSelection(value ?? ''));
  const selectionRef = useRef(selection);
  const controllerRef = useRef({
    id: fieldIdRef.current,
    label,
    getValue: () => valueRef.current,
    setValue,
    getSelection: () => selectionRef.current,
    setSelection: nextSelection => {
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
    },
    focus: () => resolvedRef.current?.focus?.(),
    blur: () => resolvedRef.current?.blur?.(),
    armKeyboardFocus: () => {
      focusModeRef.current = 'keyboard';
      setShowSoftInputOnFocus(true);
    },
  });

  useEffect(() => {
    valueRef.current = value ?? '';
    setSelection(previous => {
      const nextSelection = clampSelection(previous, valueRef.current);
      selectionRef.current = nextSelection;
      return nextSelection;
    });
  }, [value]);

  useEffect(() => {
    controllerRef.current.label = label;
    controllerRef.current.setValue = setValue;
    controllerRef.current.focus = () => resolvedRef.current?.focus?.();
  }, [label, setValue]);

  useEffect(() => {
    releaseFieldRef.current = context?.releaseField;
  }, [context]);

  useEffect(() => {
    return () => releaseFieldRef.current?.(fieldIdRef.current);
  }, []);

  function handleFocus(event) {
    context?.focusField?.(controllerRef.current);
    const focusMode = focusModeRef.current;
    focusModeRef.current = 'gesture';
    if (focusMode === 'keyboard') {
      setShowSoftInputOnFocus(false);
      return event;
    }
    context?.openFieldOverlay?.(controllerRef.current);
    return event;
  }

  function handleBlur(event) {
    context?.blurField?.(fieldIdRef.current);
    return event;
  }

  function handleSelectionChange(event) {
    const nextSelection = event.nativeEvent.selection;
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    return event;
  }

  return {
    ref: resolvedRef,
    selection,
    showSoftInputOnFocus,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onSelectionChange: handleSelectionChange,
    openGestureInput: () => context?.openFieldOverlay?.(controllerRef.current),
  };
}

export function GestureTriggerButton({ onPress, title = 'Use Gesture', style }) {
  return (
    <TouchableOpacity style={[styles.gestureTrigger, style]} onPress={onPress} activeOpacity={0.82}>
      <Text style={styles.gestureTriggerText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,18,37,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#7d8597',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f3f5fb',
  },
  closeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4f6ef7',
  },
  loader: {
    marginVertical: 48,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    color: '#61708a',
    marginBottom: 16,
  },
  resultPanel: {
    minHeight: 108,
    borderRadius: 16,
    backgroundColor: '#f3f5fb',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultWarn: {
    backgroundColor: '#fef9f0',
  },
  resultSuccess: {
    backgroundColor: '#eafaf1',
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#61708a',
  },
  resultLabelWarn: {
    color: '#e67e22',
  },
  resultLabelSuccess: {
    color: '#27ae60',
  },
  resultText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#61708a',
    textAlign: 'center',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#edf1ff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4f6ef7',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#4f6ef7',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  gestureTrigger: {
    borderWidth: 1,
    borderColor: '#cfd6fb',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gestureTriggerText: {
    color: '#4f6ef7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
