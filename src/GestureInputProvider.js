import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
const SWIPE_CLOSE_DISTANCE = 92;

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

function cloneSelection(selection, text) {
  const safe = clampSelection(selection, text);
  return { start: safe.start, end: safe.end };
}

function clampRange(range, text) {
  const length = text?.length ?? 0;
  const start = Math.max(0, Math.min(range?.start ?? 0, length));
  const end = Math.max(start, Math.min(range?.end ?? start, length));
  return { start, end };
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
  const insertedWordStart = before.length + (needsLeadingSpace ? 1 : 0);
  const insertedWordEnd = insertedWordStart + word.length;

  return {
    text: nextText,
    selection: { start: cursor, end: cursor },
    insertedWord: word,
    insertedWordRange: { start: insertedWordStart, end: insertedWordEnd },
  };
}

function replaceTextRange(text, range, replacement) {
  const safeText = text ?? '';
  const safeRange = clampRange(range, safeText);
  const before = safeText.slice(0, safeRange.start);
  const after = safeText.slice(safeRange.end);
  const nextText = `${before}${replacement}${after}`;
  const replacedLength = safeRange.end - safeRange.start;
  const delta = replacement.length - replacedLength;

  return {
    text: nextText,
    range: { start: safeRange.start, end: safeRange.start + replacement.length },
    delta,
  };
}

function shiftSelectionAfterReplace(selection, range, delta, replacementLength) {
  const safeSelection = selection ?? { start: 0, end: 0 };

  function shiftPoint(point) {
    if (point <= range.start) return point;
    if (point >= range.end) return point + delta;
    return range.start + replacementLength;
  }

  const start = shiftPoint(safeSelection.start);
  const end = shiftPoint(safeSelection.end);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function invertPhrase(phrase) {
  const trimmed = (phrase ?? '').trim();
  if (!trimmed) return '';
  if (/^no\s+/i.test(trimmed)) {
    return trimmed.replace(/^no\s+/i, '');
  }
  return `no ${trimmed}`;
}

export function GestureInputProvider({ children }) {
  const [activeField, setActiveField] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [loadingGestures, setLoadingGestures] = useState(false);
  const [gestures, setGestures] = useState([]);
  const [padResetKey, setPadResetKey] = useState(0);
  const [resultState, setResultState] = useState('idle');
  const [lastMatchedWord, setLastMatchedWord] = useState('');
  const [fieldPreviewText, setFieldPreviewText] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const [lastInsertion, setLastInsertion] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const activeFieldRef = useRef(null);
  const overlayVisibleRef = useRef(false);
  const blurTimeoutRef = useRef(null);
  const historyRef = useRef([]);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const swipeStartYRef = useRef(null);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  useEffect(() => {
    overlayVisibleRef.current = overlayVisible;
  }, [overlayVisible]);

  useEffect(() => {
    if (!overlayVisible) return;
    setFieldPreviewText(activeField?.getValue?.() ?? '');
  }, [overlayVisible, activeField]);

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

  function resetGestureHistory() {
    historyRef.current = [];
    setCanUndo(false);
    setLastInsertion(null);
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
      sheetTranslateY.setValue(0);
      setOverlayVisible(false);
      setResultState('idle');
      setLastMatchedWord('');
      setIsDrawing(false);
      setFieldPreviewText('');
      setPadResetKey(previous => previous + 1);
      resetGestureHistory();
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
    setFieldPreviewText(field.getValue?.() ?? '');
    setIsDrawing(false);
    resetGestureHistory();
    sheetTranslateY.setValue(0);
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
    sheetTranslateY.setValue(0);
    setOverlayVisible(false);
    resetOverlayState();
    setFieldPreviewText('');
    resetGestureHistory();

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
    sheetTranslateY.setValue(0);
    setOverlayVisible(false);
    resetOverlayState();
    setFieldPreviewText('');
    resetGestureHistory();

    field.blur?.();
    setTimeout(() => {
      field.focus?.();
    }, Platform.OS === 'ios' ? 180 : 80);
  }

  function insertMatchedWord(word) {
    const field = activeFieldRef.current;
    if (!field) return null;

    const currentValue = field.getValue?.() ?? '';
    const currentSelection = cloneSelection(
      field.getSelection?.() ?? getDefaultSelection(currentValue),
      currentValue
    );
    const next = insertWordAtSelection(currentValue, word, currentSelection);

    field.setValue?.(next.text);
    field.setSelection?.(next.selection);

    historyRef.current.push({
      beforeText: currentValue,
      beforeSelection: currentSelection,
      lastInsertionBefore: lastInsertion,
      lastInsertionAfter: { word: next.insertedWord, range: next.insertedWordRange },
    });

    setCanUndo(historyRef.current.length > 0);
    setLastInsertion({ word: next.insertedWord, range: next.insertedWordRange });
    setFieldPreviewText(next.text);
    return next;
  }

  function handleUndoGesture() {
    const field = activeFieldRef.current;
    if (!field || historyRef.current.length === 0) return;

    const previous = historyRef.current.pop();
    field.setValue?.(previous.beforeText);
    field.setSelection?.(previous.beforeSelection);

    setCanUndo(historyRef.current.length > 0);
    setLastInsertion(previous.lastInsertionBefore ?? null);
    setLastMatchedWord('');
    setResultState('ready');
    setFieldPreviewText(previous.beforeText);
    setPadResetKey(previousKey => previousKey + 1);
  }

  function handleInvertGesture() {
    const field = activeFieldRef.current;
    if (!field || !lastInsertion?.range) return;

    const currentValue = field.getValue?.() ?? '';
    const currentSelection = cloneSelection(
      field.getSelection?.() ?? getDefaultSelection(currentValue),
      currentValue
    );
    const range = clampRange(lastInsertion.range, currentValue);
    const phrase = currentValue.slice(range.start, range.end);
    const inverted = invertPhrase(phrase);
    if (!inverted || inverted === phrase) return;

    const replaced = replaceTextRange(currentValue, range, inverted);
    const nextSelection = shiftSelectionAfterReplace(
      currentSelection,
      range,
      replaced.delta,
      inverted.length
    );

    field.setValue?.(replaced.text);
    field.setSelection?.(nextSelection);

    historyRef.current.push({
      beforeText: currentValue,
      beforeSelection: currentSelection,
      lastInsertionBefore: lastInsertion,
      lastInsertionAfter: { word: inverted, range: replaced.range },
    });

    setCanUndo(historyRef.current.length > 0);
    setLastInsertion({ word: inverted, range: replaced.range });
    setLastMatchedWord(inverted);
    setResultState('inverted');
    setFieldPreviewText(replaced.text);
  }

  function handleDrawingChange(drawing) {
    setIsDrawing(drawing);
    if (drawing) setResultState('ready');
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

    const inserted = insertMatchedWord(match.word);
    if (!inserted) return;
    setLastMatchedWord(inserted.insertedWord);
    setResultState('inserted');
    setPadResetKey(previous => previous + 1);
  }

  function resetSheetPosition() {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      speed: 26,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }

  function getTouchY(event) {
    const pageY = event?.nativeEvent?.pageY;
    if (typeof pageY === 'number') return pageY;
    const locationY = event?.nativeEvent?.locationY;
    if (typeof locationY === 'number') return locationY;
    return 0;
  }

  function handleSheetGestureStart(event) {
    swipeStartYRef.current = getTouchY(event);
    sheetTranslateY.stopAnimation();
  }

  function handleSheetGestureMove(event) {
    const startY = swipeStartYRef.current ?? getTouchY(event);
    const currentY = getTouchY(event);
    const deltaY = Math.max(0, currentY - startY);
    sheetTranslateY.setValue(deltaY);
  }

  function handleSheetGestureFinish(event) {
    const startY = swipeStartYRef.current;
    const currentY = getTouchY(event);
    const deltaY = startY == null ? 0 : Math.max(0, currentY - startY);
    swipeStartYRef.current = null;

    if (deltaY > SWIPE_CLOSE_DISTANCE) {
      closeOverlay();
      return;
    }

    resetSheetPosition();
  }

  const hasGestures = gestures.length > 0;

  return (
    <GestureInputContext.Provider value={{ focusField, blurField, releaseField, openFieldOverlay }}>
      <View style={styles.root}>
        {children}

        <Modal visible={overlayVisible} transparent animationType="slide" onRequestClose={() => closeOverlay()}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => closeOverlay()} />
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              <View
                testID="gesture-sheet-drag-handle"
                style={styles.handleTouchTarget}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={handleSheetGestureStart}
                onResponderMove={handleSheetGestureMove}
                onResponderRelease={handleSheetGestureFinish}
                onResponderTerminate={handleSheetGestureFinish}
              >
                <View style={styles.handle} />
              </View>
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

                  <View style={styles.previewPanel}>
                    <Text style={styles.previewLabel}>Live Field Preview</Text>
                    <Text style={styles.previewText}>
                      {fieldPreviewText || 'Nothing inserted yet.'}
                    </Text>
                  </View>

                  <GesturePad
                    disabled={!hasGestures}
                    resetKey={padResetKey}
                    onGestureComplete={handleGestureComplete}
                    onDrawingChange={handleDrawingChange}
                  />

                  <View
                    style={[
                      styles.resultPanel,
                      (resultState === 'inserted' || resultState === 'inverted') && styles.resultSuccess,
                      resultState === 'no-match' && styles.resultWarn,
                      resultState === 'invalid' && styles.resultWarn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultLabel,
                        (resultState === 'inserted' || resultState === 'inverted') && styles.resultLabelSuccess,
                        (resultState === 'no-match' || resultState === 'invalid') && styles.resultLabelWarn,
                      ]}
                    >
                      {isDrawing
                        ? 'Drawing'
                        : resultState === 'inserted'
                          ? 'Inserted'
                        : resultState === 'inverted'
                          ? 'Inverted'
                        : resultState === 'no-match'
                          ? 'No Matching Gesture'
                        : resultState === 'invalid'
                            ? 'Gesture Too Small'
                            : 'Ready'}
                    </Text>
                    <Text style={styles.resultText}>
                      {isDrawing
                        ? 'Lift your fingers to finish.'
                        : resultState === 'inserted'
                          ? `"${lastMatchedWord}" inserted. Draw the next gesture or close when done.`
                        : resultState === 'inverted'
                          ? `"${lastMatchedWord}" applied.`
                        : resultState === 'no-match'
                          ? 'Try again with a more consistent gesture.'
                        : resultState === 'invalid'
                            ? 'Draw a larger gesture before lifting your fingers.'
                            : hasGestures
                              ? 'Open gesture mode only when you want to insert a saved word.'
                              : 'You can create gestures from Settings → Manage Gestures.'}
                    </Text>
                  </View>

                  <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleUndoGesture} disabled={!canUndo}>
                      <Text style={[styles.secondaryButtonText, !canUndo && styles.buttonTextDisabled]}>Undo Gesture</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleInvertGesture} disabled={!lastInsertion}>
                      <Text style={[styles.secondaryButtonText, !lastInsertion && styles.buttonTextDisabled]}>Invert Gesture</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryButton} onPress={switchToKeyboard}>
                      <Text style={styles.primaryButtonText}>Use Keyboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={clearResult}>
                      <Text style={styles.secondaryButtonText}>Clear Pad</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
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

  function handleSetSelection(nextSelection) {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }

  return {
    ref: resolvedRef,
    selection,
    setSelection: handleSetSelection,
    showSoftInputOnFocus,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onSelectionChange: handleSelectionChange,
    openGestureInput: () => context?.openFieldOverlay?.(controllerRef.current),
  };
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
    marginBottom: 6,
  },
  handleTouchTarget: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 10,
    marginBottom: 8,
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
    marginBottom: 12,
  },
  previewPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce3ff',
    backgroundColor: '#f7f9ff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#627194',
    marginBottom: 6,
  },
  previewText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#1a1a2e',
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
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 12,
    marginTop: 16,
  },
  secondaryButton: {
    width: '48%',
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
    width: '48%',
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
  buttonTextDisabled: {
    color: '#9facdb',
  },
});
