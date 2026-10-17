/**
 * Component: PinStyleModal
 *
 * Sovereign & Cartographic Pin Style Customizer.
 * Allows users to choose:
 * - Pin icon shape: Circle, Triangle, Square, Hexagon, Diamond, Star, Pin (Teardrop)
 * - Pin color: Curated 16-color vibrant palette + custom Hex color code
 * - Application scope:
 *   1. Individual Address ('single')
 *   2. Entire Territory ('territory')
 *   3. Entire Neighborhood ('neighborhood')
 *   4. Entire City ('city')
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

export type PinShape = 'circle' | 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'diamond' | 'star' | 'pin';

export interface PinStyleOption {
  id: PinShape;
  label: string;
  icon: string;
}

export const PIN_SHAPES: PinStyleOption[] = [
  { id: 'circle', label: 'Círculo', icon: '●' },
  { id: 'triangle', label: 'Triângulo', icon: '▲' },
  { id: 'square', label: 'Quadrado', icon: '■' },
  { id: 'pentagon', label: 'Pentágono', icon: '⬠' },
  { id: 'hexagon', label: 'Hexágono', icon: '⬢' },
  { id: 'diamond', label: 'Losango', icon: '◆' },
  { id: 'star', label: 'Estrela', icon: '★' },
  { id: 'pin', label: 'Alfinete', icon: '📍' },
];

export const COLOR_PALETTE = [
  '#3B82F6', // Azul Real
  '#10B981', // Verde Esmeralda
  '#F59E0B', // Âmbar Dourado
  '#8B5CF6', // Roxo Violeta
  '#EC4899', // Rosa Neon
  '#06B6D4', // Ciano
  '#F97316', // Laranja Vivo
  '#14B8A6', // Verde Petróleo
  '#A855F7', // Magenta Suave
  '#E11D48', // Vermelho Rubi
  '#84CC16', // Verde Limão
  '#EAB308', // Dourado Intenso
  '#6366F1', // Índigo
  '#D946EF', // Fúcsia
  '#0EA5E9', // Azul Céu
  '#64748B', // Ardósia Neutro
];

export interface PinStyleModalProps {
  visible: boolean;
  initialPinKey?: string | null;
  initialPinLabel?: string;
  initialTerritory?: string;
  initialNeighborhood?: string;
  initialCity?: string;
  initialShape?: PinShape;
  initialColor?: string;
  territoryList: string[];
  neighborhoodList: string[];
  cityList: string[];
  onClose: () => void;
  onApply: (params: {
    scope: 'single' | 'territory' | 'neighborhood' | 'city';
    shape: PinShape;
    color: string;
    targetPinKey?: string;
    targetTerritory?: string;
    targetNeighborhood?: string;
    targetCity?: string;
  }) => Promise<void>;
}

export function PinStyleModal({
  visible,
  initialPinKey,
  initialPinLabel,
  initialTerritory,
  initialNeighborhood,
  initialCity,
  initialShape = 'circle',
  initialColor = '#3B82F6',
  territoryList,
  neighborhoodList,
  cityList,
  onClose,
  onApply,
}: PinStyleModalProps) {
  const [scope, setScope] = useState<'single' | 'territory' | 'neighborhood' | 'city'>('single');
  const [shape, setShape] = useState<PinShape>(initialShape);
  const [color, setColor] = useState<string>(initialColor);
  const [customHex, setCustomHex] = useState<string>(initialColor);
  const [selectedTerritory, setSelectedTerritory] = useState<string>(initialTerritory || territoryList[0] || 'T01');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>(initialNeighborhood || neighborhoodList[0] || '');
  const [selectedCity, setSelectedCity] = useState<string>(initialCity || cityList[0] || '');
  const [saving, setSaving] = useState(false);

  // Sync with initial props whenever modal opens
  useEffect(() => {
    if (visible) {
      setShape(initialShape || 'circle');
      setColor(initialColor || '#3B82F6');
      setCustomHex(initialColor || '#3B82F6');
      if (initialPinKey) {
        setScope('single');
      } else {
        setScope('territory');
      }
      if (initialTerritory) setSelectedTerritory(initialTerritory);
      if (initialNeighborhood) setSelectedNeighborhood(initialNeighborhood);
      if (initialCity) setSelectedCity(initialCity);
    }
  }, [visible, initialPinKey, initialTerritory, initialNeighborhood, initialCity, initialShape, initialColor]);

  if (!visible) return null;

  const handleColorSelect = (c: string) => {
    setColor(c);
    setCustomHex(c);
  };

  const handleHexChange = (text: string) => {
    setCustomHex(text);
    if (/^#[0-9A-Fa-f]{6}$/.test(text.trim())) {
      setColor(text.trim());
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onApply({
        scope,
        shape,
        color,
        targetPinKey: initialPinKey || undefined,
        targetTerritory: selectedTerritory,
        targetNeighborhood: selectedNeighborhood,
        targetCity: selectedCity,
      });
      onClose();
    } catch (err) {
      console.error('[PinStyleModal] Erro ao aplicar estilo:', err);
    } finally {
      setSaving(false);
    }
  };

  // Preview badge CSS shape emulation
  const getShapeClip = (s: PinShape) => {
    if (s === 'circle') return { borderRadius: 18 };
    if (s === 'square') return { borderRadius: 4 };
    if (s === 'triangle') return { borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 0 };
    if (s === 'diamond') return { transform: [{ rotate: '45deg' }], borderRadius: 4 };
    if (s === 'hexagon') return { borderRadius: 8 };
    if (s === 'star') return { borderRadius: 6 };
    if (s === 'pin') return { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 2, transform: [{ rotate: '-45deg' }] };
    return { borderRadius: 18 };
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🎨 Personalizar Ícones dos Alfinetes</Text>
              <Text style={styles.subtitle}>
                Escolha o formato geométrico e a cor. Aplique por endereço, território, bairro ou cidade.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ gap: 18 }}>
            {/* Live Preview Card */}
            <View style={styles.previewCard}>
              <Text style={styles.sectionLabel}>PRÉ-VISUALIZAÇÃO NO MAPA</Text>
              <View style={styles.previewRow}>
                <View
                  style={[
                    styles.previewPinBox,
                    { backgroundColor: color, borderColor: '#FFFFFF' },
                    getShapeClip(shape),
                  ]}
                >
                  <Text
                    style={[
                      styles.previewBadgeText,
                      shape === 'pin' && { transform: [{ rotate: '45deg' }] },
                      shape === 'diamond' && { transform: [{ rotate: '-45deg' }] },
                    ]}
                  >
                    ✓
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>
                    {PIN_SHAPES.find((p) => p.id === shape)?.icon} Formato: {PIN_SHAPES.find((p) => p.id === shape)?.label}
                  </Text>
                  <Text style={styles.previewColor}>
                    Cor: <Text style={{ color, fontWeight: '700' }}>{color}</Text>
                  </Text>
                  <Text style={styles.previewScope}>
                    Escopo:{' '}
                    {scope === 'single'
                      ? `Apenas este endereço (${initialPinLabel || 'selecionado'})`
                      : scope === 'territory'
                      ? `Todo o Território ${selectedTerritory}`
                      : scope === 'neighborhood'
                      ? `Todo o Bairro ${selectedNeighborhood || '(selecionado)'}`
                      : `Toda a Cidade ${selectedCity || '(selecionada)'}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* 1. Escolha a Forma */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>1. FORMATO DO ÍCONE (FORMA GEOMÉTRICA)</Text>
              <View style={styles.shapesGrid}>
                {PIN_SHAPES.map((item) => {
                  const active = shape === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setShape(item.id)}
                      style={[styles.shapeBtn, active && styles.shapeBtnActive]}
                    >
                      <Text style={[styles.shapeIcon, active && { color: '#FFB800' }]}>{item.icon}</Text>
                      <Text style={[styles.shapeLabel, active && styles.shapeLabelActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Escolha a Cor */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>2. COR DO ÍCONE</Text>
              <View style={styles.colorsGrid}>
                {COLOR_PALETTE.map((c) => {
                  const active = color.toLowerCase() === c.toLowerCase();
                  return (
                    <Pressable
                      key={c}
                      onPress={() => handleColorSelect(c)}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        active && styles.colorDotActive,
                      ]}
                    />
                  );
                })}
              </View>
              {/* Hex Input */}
              <View style={styles.hexInputRow}>
                <Text style={styles.hexLabel}>Código Hexadecimal:</Text>
                <TextInput
                  style={styles.hexInput}
                  value={customHex}
                  onChangeText={handleHexChange}
                  placeholder="#3B82F6"
                  placeholderTextColor="#6F7E94"
                  maxLength={7}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* 3. Escopo de Aplicação */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>3. ESCOPO DE APLICAÇÃO</Text>
              <View style={styles.scopeTabs}>
                {initialPinKey ? (
                  <Pressable
                    onPress={() => setScope('single')}
                    style={[styles.scopeTab, scope === 'single' && styles.scopeTabActive]}
                  >
                    <Text style={[styles.scopeTabText, scope === 'single' && styles.scopeTabTextActive]}>
                      📍 Este Endereço
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setScope('territory')}
                  style={[styles.scopeTab, scope === 'territory' && styles.scopeTabActive]}
                >
                  <Text style={[styles.scopeTabText, scope === 'territory' && styles.scopeTabTextActive]}>
                    🗺️ Por Território
                  </Text>
                </Pressable>
                {neighborhoodList.length > 0 ? (
                  <Pressable
                    onPress={() => setScope('neighborhood')}
                    style={[styles.scopeTab, scope === 'neighborhood' && styles.scopeTabActive]}
                  >
                    <Text style={[styles.scopeTabText, scope === 'neighborhood' && styles.scopeTabTextActive]}>
                      🏘️ Por Bairro
                    </Text>
                  </Pressable>
                ) : null}
                {cityList.length > 0 ? (
                  <Pressable
                    onPress={() => setScope('city')}
                    style={[styles.scopeTab, scope === 'city' && styles.scopeTabActive]}
                  >
                    <Text style={[styles.scopeTabText, scope === 'city' && styles.scopeTabTextActive]}>
                      🏙️ Por Cidade
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Scope specific sub-selector */}
              {scope === 'territory' ? (
                <View style={styles.subSelectorBox}>
                  <Text style={styles.subSelectorLabel}>Selecione o Território:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {territoryList.map((tNum) => {
                      const active = selectedTerritory === tNum;
                      return (
                        <Pressable
                          key={tNum}
                          onPress={() => setSelectedTerritory(tNum)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{tNum}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : scope === 'neighborhood' ? (
                <View style={styles.subSelectorBox}>
                  <Text style={styles.subSelectorLabel}>Selecione o Bairro:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {neighborhoodList.map((neigh) => {
                      const active = selectedNeighborhood === neigh;
                      return (
                        <Pressable
                          key={neigh}
                          onPress={() => setSelectedNeighborhood(neigh)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{neigh}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : scope === 'city' ? (
                <View style={styles.subSelectorBox}>
                  <Text style={styles.subSelectorLabel}>Selecione a Cidade:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {cityList.map((cName) => {
                      const active = selectedCity === cName;
                      return (
                        <Pressable
                          key={cName}
                          onPress={() => setSelectedCity(cName)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{cName}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.singleAddressNotice}>
                  <Text style={styles.singleAddressNoticeText}>
                    O estilo será aplicado unicamente a: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{initialPinLabel || 'Endereço atual'}</Text>
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={styles.applyBtn}>
              {saving ? (
                <ActivityIndicator color="#062016" size="small" />
              ) : (
                <Text style={styles.applyBtnText}>✓ Salvar & Aplicar Estilo</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    backgroundColor: '#161A24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#8A94A6',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 18,
  },
  previewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  previewPinBox: {
    width: 36,
    height: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewColor: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 2,
  },
  previewScope: {
    color: '#60A5FA',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  shapesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shapeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  shapeBtnActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderColor: '#FFB800',
  },
  shapeIcon: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  shapeLabel: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  shapeLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  hexLabel: {
    color: '#8A94A6',
    fontSize: 12,
  },
  hexInput: {
    backgroundColor: '#12151C',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontFamily: 'monospace',
    width: 90,
    textAlign: 'center',
  },
  scopeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scopeTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scopeTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  scopeTabText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  scopeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subSelectorBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
    marginTop: 4,
  },
  subSelectorLabel: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    borderColor: '#FFB800',
  },
  chipText: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFB800',
    fontWeight: '700',
  },
  singleAddressNotice: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  singleAddressNoticeText: {
    color: '#8A94A6',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelBtnText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '600',
  },
  applyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#FFB800',
  },
  applyBtnText: {
    color: '#062016',
    fontSize: 13,
    fontWeight: '800',
  },
});
