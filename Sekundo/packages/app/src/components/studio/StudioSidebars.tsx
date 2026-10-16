import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SdocDocument, SdocPrimitive } from '@sekundo/core';

export interface StudioInspectorProps {
  sdoc: SdocDocument | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdatePrimitive: (id: string, patch: Record<string, unknown>) => void;
  onAddPrimitive: (prim: SdocPrimitive) => void;
}

export function collectAllPrimitives(sdoc: SdocDocument | null): SdocPrimitive[] {
  if (!sdoc) return [];
  const list: SdocPrimitive[] = [];
  if (Array.isArray(sdoc.layers)) {
    for (const layer of sdoc.layers) {
      if (Array.isArray(layer.items)) {
        list.push(...layer.items);
      }
    }
  }
  if (Array.isArray(sdoc.fields)) {
    for (const f of sdoc.fields) {
      list.push({
        type: 'text',
        id: f.id,
        x: f.rect[0],
        y: f.rect[1],
        w: f.rect[2],
        h: f.rect[3],
        text: `{{${f.bind}}}`,
        size: f.size ?? 10,
        weight: f.weight ?? 'normal',
        align: f.align ?? 'left',
      });
    }
  }
  return list;
}

export function StudioInspectorPanel({
  sdoc,
  selectedId,
  onSelect,
  onUpdatePrimitive,
  onAddPrimitive,
}: StudioInspectorProps) {
  const primitives = collectAllPrimitives(sdoc);
  const selectedPrim = primitives.find((p) => p.id === selectedId) || null;

  const handleQuickAdd = (type: SdocPrimitive['type']) => {
    const suffix = Math.floor(100 + Math.random() * 899);
    if (type === 'text') {
      onAddPrimitive({
        id: `txt_${suffix}`,
        type: 'text',
        x: 15,
        y: 25,
        w: 80,
        h: 8,
        text: 'Novo Texto Editável',
        size: 10,
        weight: 'bold',
        color: '#0F172A',
      });
    } else if (type === 'rect') {
      onAddPrimitive({
        id: `box_${suffix}`,
        type: 'rect',
        x: 15,
        y: 35,
        w: 60,
        h: 25,
        stroke: '#1E293B',
        strokeWidth: 0.4,
        fill: '#F8FAFC',
      });
    } else if (type === 'line') {
      onAddPrimitive({
        id: `lin_${suffix}`,
        type: 'line',
        x1: 15,
        y1: 65,
        x2: 95,
        y2: 65,
        stroke: '#0F172A',
        strokeWidth: 0.5,
      });
    } else if (type === 'path') {
      onAddPrimitive({
        id: `pth_${suffix}`,
        type: 'path',
        points: [
          [20, 75],
          [45, 70],
          [70, 80],
        ],
        closed: false,
        stroke: '#2563EB',
        strokeWidth: 0.5,
      });
    } else if (type === 'table') {
      onAddPrimitive({
        id: `tbl_${suffix}`,
        type: 'table',
        x: 12,
        y: 85,
        cols: [50, 70, 50],
        rows: [7, 7, 7],
        stroke: '#334155',
        strokeWidth: 0.3,
        headerFill: '#E2E8F0',
        fontSize: 8,
        cells: {
          '0,0': 'Código',
          '0,1': 'Designado',
          '0,2': 'Sala / Data',
          '1,0': '{{key}}',
          '1,1': '{{value}}',
          '1,2': '{{room}}',
        },
      });
    }
  };

  const renderPropertyEditor = (prim: SdocPrimitive) => {
    const p = prim as any;
    const numField = (label: string, key: string) => (
      <View style={styles.propCol} key={key}>
        <Text style={styles.propLabel}>{label} (mm)</Text>
        <TextInput
          testID={`prop-input-${key}`}
          style={styles.propInput}
          keyboardType="numeric"
          value={String(p[key] ?? 0)}
          onChangeText={(txt) => {
            const parsed = parseFloat(txt);
            if (!Number.isNaN(parsed)) onUpdatePrimitive(prim.id, { [key]: parsed });
          }}
        />
      </View>
    );

    return (
      <View style={styles.inspectorCard} testID="studio-property-inspector">
        <View style={styles.inspectorHeader}>
          <Text style={styles.inspectorTitle}>
            🎯 {prim.id} ({prim.type.toUpperCase()})
          </Text>
        </View>

        {typeof p.x === 'number' && typeof p.y === 'number' && (
          <View style={styles.propRow}>
            {numField('X', 'x')}
            {numField('Y', 'y')}
            {typeof p.w === 'number' && numField('L (w)', 'w')}
            {typeof p.h === 'number' && numField('A (h)', 'h')}
          </View>
        )}

        {prim.type === 'line' && (
          <View style={styles.propRow}>
            {numField('X1', 'x1')}
            {numField('Y1', 'y1')}
            {numField('X2', 'x2')}
            {numField('Y2', 'y2')}
          </View>
        )}

        {prim.type === 'text' && (
          <>
            <Text style={styles.propLabel}>Texto / Bind Mustache</Text>
            <TextInput
              testID="prop-input-text"
              style={styles.propInputFull}
              value={String(prim.text ?? '')}
              onChangeText={(val) => onUpdatePrimitive(prim.id, { text: val })}
              placeholder="{{value}}"
              placeholderTextColor="#64748B"
            />
            <View style={styles.propRow}>
              <View style={styles.propCol}>
                <Text style={styles.propLabel}>Tam (pt)</Text>
                <TextInput
                  testID="prop-input-size"
                  style={styles.propInput}
                  keyboardType="numeric"
                  value={String(prim.size ?? 9)}
                  onChangeText={(txt) => {
                    const n = parseFloat(txt);
                    if (!Number.isNaN(n)) onUpdatePrimitive(prim.id, { size: n });
                  }}
                />
              </View>
              <View style={styles.propCol}>
                <Text style={styles.propLabel}>Peso</Text>
                <TouchableOpacity
                  style={styles.propToggleBtn}
                  onPress={() =>
                    onUpdatePrimitive(prim.id, {
                      weight: prim.weight === 'bold' ? 'normal' : 'bold',
                    })
                  }
                >
                  <Text style={styles.propToggleText}>
                    {prim.weight === 'bold' ? 'Negrito (B)' : 'Normal'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.propCol}>
                <Text style={styles.propLabel}>Cor Hex</Text>
                <TextInput
                  style={styles.propInput}
                  value={String(prim.color ?? '#0F172A')}
                  onChangeText={(val) => onUpdatePrimitive(prim.id, { color: val })}
                />
              </View>
            </View>
          </>
        )}

        {(prim.type === 'rect' || prim.type === 'line' || prim.type === 'path') && (
          <View style={styles.propRow}>
            <View style={styles.propCol}>
              <Text style={styles.propLabel}>Traço (Hex)</Text>
              <TextInput
                style={styles.propInput}
                value={String((prim as any).stroke ?? '#0F172A')}
                onChangeText={(val) => onUpdatePrimitive(prim.id, { stroke: val })}
              />
            </View>
            {(prim.type === 'rect' || prim.type === 'path') && (
              <View style={styles.propCol}>
                <Text style={styles.propLabel}>Preenchimento</Text>
                <TextInput
                  style={styles.propInput}
                  value={String((prim as any).fill ?? '')}
                  placeholder="transparente"
                  placeholderTextColor="#64748B"
                  onChangeText={(val) => onUpdatePrimitive(prim.id, { fill: val })}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>➕ Adicionar Primitiva Vetorial</Text>
      <View style={styles.addRow}>
        {(
          [
            ['text', '+ Texto'],
            ['rect', '+ Retângulo'],
            ['line', '+ Reta'],
            ['path', '+ Polilinha'],
            ['table', '+ Tabela'],
          ] as const
        ).map(([kind, label]) => (
          <TouchableOpacity
            key={kind}
            testID={`add-prim-${kind}`}
            style={styles.addBtn}
            onPress={() => handleQuickAdd(kind)}
          >
            <Text style={styles.addBtnText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedPrim ? (
        renderPropertyEditor(selectedPrim)
      ) : (
        <View style={styles.emptyInspector}>
          <Text style={styles.emptyInspectorText}>
            Clique em qualquer elemento no Canvas ou na árvore abaixo para editar em mm.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>📑 Camadas & Elementos ({primitives.length})</Text>
      <ScrollView style={styles.layerList}>
        {primitives.map((prim) => {
          const isSel = prim.id === selectedId;
          return (
            <TouchableOpacity
              key={prim.id}
              testID={`layer-item-${prim.id}`}
              style={[styles.layerItem, isSel && styles.layerItemSelected]}
              onPress={() => onSelect(prim.id)}
            >
              <Text style={[styles.layerItemTitle, isSel && styles.layerItemTitleSelected]}>
                [{prim.type}] {prim.id}
              </Text>
              <Text style={styles.layerCoord}>
                {prim.type === 'line'
                  ? `${prim.x1},${prim.y1}→${prim.x2},${prim.y2}`
                  : prim.type === 'path'
                  ? `${prim.points.length} pts`
                  : `${(prim as any).x ?? 0},${(prim as any).y ?? 0} mm`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#0F172A' },
  sectionTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginVertical: 6 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  addBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  addBtnText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600' },
  inspectorCard: { backgroundColor: '#1E293B', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#3B82F6', marginBottom: 10 },
  inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  inspectorTitle: { color: '#60A5FA', fontSize: 12, fontWeight: '700' },
  propRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  propCol: { flex: 1 },
  propLabel: { color: '#94A3B8', fontSize: 10, marginBottom: 2 },
  propInput: { backgroundColor: '#0F172A', color: '#F8FAFC', borderWidth: 1, borderColor: '#334155', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4, fontSize: 11 },
  propInputFull: { backgroundColor: '#0F172A', color: '#F8FAFC', borderWidth: 1, borderColor: '#334155', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, marginBottom: 6 },
  propToggleBtn: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 4, paddingVertical: 5, alignItems: 'center' },
  propToggleText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600' },
  emptyInspector: { backgroundColor: '#1E293B', borderRadius: 6, padding: 10, marginBottom: 10 },
  emptyInspectorText: { color: '#64748B', fontSize: 11 },
  layerList: { flex: 1 },
  layerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 5, marginBottom: 3, backgroundColor: '#1E293B' },
  layerItemSelected: { backgroundColor: '#1E3A8A', borderWidth: 1, borderColor: '#60A5FA' },
  layerItemTitle: { color: '#CBD5E1', fontSize: 11, fontFamily: 'monospace' },
  layerItemTitleSelected: { color: '#FFFFFF', fontWeight: '700' },
  layerCoord: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
});
