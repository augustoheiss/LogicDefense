import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

export interface PresenceBadgesProps {
  nodeId: string;
  opsCount: number;
  onExportDelta: () => string;
  onImportDelta: (envelopeStr: string) => void;
}

export function PresenceBadges({
  nodeId,
  opsCount,
  onExportDelta,
  onImportDelta,
}: PresenceBadgesProps) {
  const [expanded, setExpanded] = useState(false);
  const [deltaText, setDeltaText] = useState('');
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  const handleGenerateDelta = () => {
    const encoded = onExportDelta();
    setDeltaText(encoded);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(encoded).catch(() => {});
      setCopiedMsg('Delta HLC copiado!');
    } else {
      setCopiedMsg('Delta HLC gerado abaixo.');
    }
  };

  const handleApplyDelta = () => {
    if (!deltaText.trim()) return;
    onImportDelta(deltaText.trim());
    setCopiedMsg('Delta HLC reconciliado (LWW)!✨');
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.badgeRow}>
        <View style={styles.nodePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.nodeText}>HLC {nodeId}</Text>
        </View>
        <TouchableOpacity
          testID="studio-hlc-sync-toggle-btn"
          style={styles.syncBtn}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.syncBtnText}>
            🔄 Sync HLC ({opsCount} ops)
          </Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.drawer} testID="studio-hlc-sync-drawer">
          <Text style={styles.drawerTitle}>
            🤝 Colaboração Assíncrona HLC (QR / Link / WhatsApp)
          </Text>
          <View style={styles.drawerActions}>
            <TouchableOpacity
              testID="studio-hlc-export-btn"
              style={styles.actionBtn}
              onPress={handleGenerateDelta}
            >
              <Text style={styles.actionBtnText}>📤 Gerar / Copiar Delta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="studio-hlc-import-btn"
              style={[styles.actionBtn, styles.applyBtn]}
              onPress={handleApplyDelta}
            >
              <Text style={styles.actionBtnText}>📥 Mesclar Delta HLC</Text>
            </TouchableOpacity>
          </View>
          {copiedMsg && <Text style={styles.feedbackText}>{copiedMsg}</Text>}
          <TextInput
            testID="studio-hlc-delta-input"
            style={styles.input}
            value={deltaText}
            onChangeText={setDeltaText}
            placeholder="Cole SEKUNDO_DOC_DELTA_v2:... aqui"
            placeholderTextColor="#64748B"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  nodeText: { color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
  syncBtn: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  syncBtnText: { color: '#C7D2FE', fontSize: 10.5, fontWeight: '700' },
  drawer: {
    marginTop: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 7,
    padding: 8,
    gap: 6,
  },
  drawerTitle: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  drawerActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 5,
  },
  applyBtn: { backgroundColor: '#059669' },
  actionBtnText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  feedbackText: { color: '#34D399', fontSize: 10.5 },
  input: {
    backgroundColor: '#090D16',
    color: '#E2E8F0',
    fontSize: 10.5,
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
});
