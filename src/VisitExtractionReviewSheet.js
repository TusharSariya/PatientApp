import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { buildDefaultSelection, buildReviewSections } from './visitExtraction/applyExtractedVisit';
import { flatSection, screenColors } from './screenLayout';

export default function VisitExtractionReviewSheet({
  visible,
  extraction,
  onClose,
  onApply,
}) {
  const fields = extraction?.fields ?? {};
  const warnings = extraction?.warnings ?? [];
  const [selection, setSelection] = useState(() => buildDefaultSelection(fields));

  const sections = useMemo(() => buildReviewSections(fields), [fields]);

  React.useEffect(() => {
    if (visible) {
      setSelection(buildDefaultSelection(fields));
    }
  }, [visible, fields]);

  function toggleItem(id, enabled) {
    if (id.startsWith('medicine-')) {
      setSelection((current) => ({ ...current, medicines: enabled }));
      return;
    }
    setSelection((current) => ({ ...current, [id]: enabled }));
  }

  function handleApply() {
    onApply?.({ fields, selection, transcript: extraction?.transcript ?? '' });
    onClose?.();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Review extracted visit</Text>
          <Text style={styles.subtitle}>Confirm which fields to apply to the form.</Text>
          {warnings.length > 0 ? (
            <View style={styles.warningBox}>
              {warnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>
                  {warning}
                </Text>
              ))}
            </View>
          ) : null}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.length === 0 ? (
                  <Text style={styles.emptyText}>Nothing extracted.</Text>
                ) : (
                  section.items.map((item) => {
                    const enabled = item.id.startsWith('medicine-')
                      ? selection.medicines
                      : selection[item.id];
                    return (
                      <View key={item.id} style={styles.row}>
                        <View style={styles.rowText}>
                          <Text style={styles.rowLabel}>{item.label}</Text>
                          <Text style={styles.rowValue}>{item.value || '—'}</Text>
                        </View>
                        <Switch
                          testID={`review-toggle-${item.id}`}
                          value={Boolean(enabled)}
                          onValueChange={(value) => toggleItem(item.id, value)}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            ))}
            {extraction?.transcript ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Transcript</Text>
                <Text style={styles.transcript}>{extraction.transcript}</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="apply-extracted-visit" style={styles.primaryButton} onPress={handleApply}>
              <Text style={styles.primaryButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#5f6d8a',
  },
  warningBox: {
    marginTop: 12,
    ...flatSection({ tinted: true, paddingVertical: 10 }),
  },
  warningText: {
    color: '#8a5a00',
    fontSize: 13,
    marginBottom: 4,
  },
  scroll: {
    marginTop: 12,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8ebf5',
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  rowValue: {
    marginTop: 2,
    fontSize: 13,
    color: '#5f6d8a',
  },
  transcript: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4f6ef7',
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
