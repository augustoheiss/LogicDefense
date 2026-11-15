/**
 * Autocomplete binding input (Combobox Vertical Acessível).
 * Searches the active FlatRegistry by label or path key to dynamically resolve structure indices.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  computeNextHighlightedIndex,
  filterAndRankVerticalOptions,
  type FlatSkeletonEntry,
  type VerticalFilterOption,
} from '@sekundo/core';
import { scheduleWebOptionAlignment } from '@sekundo/coin-engine';

const ESTIMATED_OPTION_ROW_HEIGHT = 48;
const getOptionItemLayout = (
  _data: ArrayLike<VerticalFilterOption<FlatSkeletonEntry>> | null | undefined,
  index: number
) => ({
  length: ESTIMATED_OPTION_ROW_HEIGHT,
  offset: ESTIMATED_OPTION_ROW_HEIGHT * index,
  index,
});

export interface FieldAutoCompleteProps {
  flatRegistry: FlatSkeletonEntry[];
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (entry: FlatSkeletonEntry) => void;
  placeholder?: string;
}

export function FieldAutoComplete({
  flatRegistry,
  value,
  onChangeText,
  onSelect,
  placeholder = '🔍 Clique para listar ou digite o campo/chave...',
}: FieldAutoCompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<TextInput | null>(null);
  const rootRef = useRef<View | null>(null);
  const flatListRef = useRef<FlatList<VerticalFilterOption<FlatSkeletonEntry>> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingOptionRef = useRef(false);
  const suppressFocusOpenRef = useRef(false);
  const suppressNextEscapeKeyUpRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const rawReactId = useId();
  const domBaseId = useMemo(
    () => `field-autocomplete-${rawReactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawReactId]
  );
  const listboxId = `${domBaseId}-listbox`;
  const getOptionDomId = (index: number) => `${domBaseId}-option-${index}`;

  const clearPendingBlurTimer = () => {
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  const clearSelectingOptionFlag = () => {
    selectingOptionRef.current = false;
    if (selectingResetTimerRef.current !== null) {
      clearTimeout(selectingResetTimerRef.current);
      selectingResetTimerRef.current = null;
    }
  };

  const markSelectingInteraction = () => {
    selectingOptionRef.current = true;
    clearPendingBlurTimer();
    if (selectingResetTimerRef.current !== null) {
      clearTimeout(selectingResetTimerRef.current);
    }
    selectingResetTimerRef.current = setTimeout(() => {
      selectingOptionRef.current = false;
      selectingResetTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      clearPendingBlurTimer();
      clearSelectingOptionFlag();
      if (scrollRetryTimerRef.current !== null) {
        clearTimeout(scrollRetryTimerRef.current);
        scrollRetryTimerRef.current = null;
      }
    };
  }, []);

  const focusInputWithoutReopen = () => {
    suppressFocusOpenRef.current = true;
    if (Platform.OS === 'web') {
      inputRef.current?.focus();
    }
    setTimeout(() => {
      if (Platform.OS !== 'web') {
        inputRef.current?.focus();
      }
      suppressFocusOpenRef.current = false;
    }, 0);
  };

  // Na Web, RNW <Modal> fecha no evento document 'keyup' de Escape; absorve o keyup pareado ao keydown que fechou este dropdown.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleEscapeKeyDownGuard = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !isOpenRef.current && !ev.repeat) {
        suppressNextEscapeKeyUpRef.current = false;
      }
    };
    const handleEscapeKeyUpCapture = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !suppressNextEscapeKeyUpRef.current) return;
      suppressNextEscapeKeyUpRef.current = false;
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', handleEscapeKeyDownGuard, true);
    document.addEventListener('keyup', handleEscapeKeyUpCapture, true);
    return () => {
      document.removeEventListener('keydown', handleEscapeKeyDownGuard, true);
      document.removeEventListener('keyup', handleEscapeKeyUpCapture, true);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen || typeof document === 'undefined') return;
    const isTargetInsideRoot = (target: unknown) => {
      const node = rootRef.current as unknown as { contains?: (t: unknown) => boolean } | null;
      return Boolean(node && typeof node.contains === 'function' && target && node.contains(target));
    };
    const handleOutsideMouseDown = (ev: MouseEvent) => {
      if (ev.target && !isTargetInsideRoot(ev.target)) {
        setIsOpen(false);
      }
    };
    const handleFocusIn = (ev: FocusEvent) => {
      if (ev.target && !isTargetInsideRoot(ev.target)) {
        setIsOpen(false);
      }
    };
    const handleDocumentKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const target = ev.target ?? document.activeElement;
      if (isTargetInsideRoot(target)) {
        suppressNextEscapeKeyUpRef.current = true;
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === 'function') {
          ev.stopImmediatePropagation();
        }
        focusInputWithoutReopen();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [isOpen]);

  const orderedOptions = useMemo<Array<VerticalFilterOption<FlatSkeletonEntry>>>(() => {
    const safeRegistry = Array.isArray(flatRegistry) ? flatRegistry : [];
    const sorted = [...safeRegistry].sort((a, b) =>
      String(a?.label || a?.key || '').localeCompare(String(b?.label || b?.key || ''), 'pt-BR')
    );
    return sorted
      .filter((entry): entry is FlatSkeletonEntry => Boolean(entry && entry.key))
      .map((entry) => ({
        id: entry.key,
        label: entry.label || entry.key,
        subtitle: `${entry.key} • ${String(entry.type || 'text').toUpperCase()}`,
        badge: entry.value ? String(entry.value).slice(0, 18) : undefined,
        keywords: [entry.key, entry.type, String(entry.value ?? '')],
        meta: entry,
      }));
  }, [flatRegistry]);

  const filteredResult = useMemo(
    () => filterAndRankVerticalOptions<FlatSkeletonEntry>(orderedOptions, value),
    [orderedOptions, value]
  );

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (prev < 0) return prev;
      return filteredResult.items.length === 0
        ? -1
        : Math.min(prev, filteredResult.items.length - 1);
    });
  }, [filteredResult.items.length]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const isLast = highlightedIndex === filteredResult.items.length - 1;
    if (filteredResult.items.length > 50 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({
          index: highlightedIndex,
          animated: false,
          viewPosition: isLast ? 1 : 0.5,
        });
      } catch {
        // Fallback caso o item virtualizado ainda nao tenha sido medido
      }
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const domId = getOptionDomId(highlightedIndex);
      return scheduleWebOptionAlignment({
        domId,
        getRootEl: () => rootRef.current as unknown as HTMLElement | null,
        alignToEnd: isLast,
        onEndNotMounted: () => {
          try {
            flatListRef.current?.scrollToEnd({ animated: false });
          } catch {
            // Ignora se a lista ainda nao tiver layout medido
          }
        },
        onFallbackScrollIntoView: (el) => {
          (
            el as { scrollIntoView?: (opts?: ScrollIntoViewOptions) => void }
          ).scrollIntoView?.({ block: 'nearest' });
        },
      });
    }
  }, [highlightedIndex, isOpen, filteredResult.items.length]);

  const handleSelectEntry = (entry: FlatSkeletonEntry) => {
    clearPendingBlurTimer();
    clearSelectingOptionFlag();
    onSelect(entry);
    setIsOpen(false);
  };

  const handleBlur = (e: any) => {
    clearPendingBlurTimer();
    if (selectingOptionRef.current) {
      clearSelectingOptionFlag();
      return;
    }
    const node = rootRef.current as unknown as { contains?: (t: unknown) => boolean } | null;
    const relatedTarget = e?.nativeEvent?.relatedTarget ?? e?.relatedTarget;
    if (relatedTarget && node && typeof node.contains === 'function' && node.contains(relatedTarget)) {
      return;
    }
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      if (
        Platform.OS === 'web' &&
        typeof document !== 'undefined' &&
        node &&
        typeof node.contains === 'function' &&
        document.activeElement &&
        node.contains(document.activeElement)
      ) {
        return;
      }
      setIsOpen(false);
    }, 120);
  };

  const handleKeyDownWeb = (e: any) => {
    if (Platform.OS !== 'web') return;
    const key = e?.nativeEvent?.key ?? e?.key;
    if (!key) return;

    if (key === 'Escape') {
      if (!isOpen) return;
      suppressNextEscapeKeyUpRef.current = true;
      e?.preventDefault?.();
      e?.stopPropagation?.();
      e?.nativeEvent?.stopImmediatePropagation?.();
      setIsOpen(false);
      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      e?.preventDefault?.();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex((prev) =>
        computeNextHighlightedIndex(prev, key, filteredResult.items.length)
      );
      return;
    }

    if (key === 'Enter' && isOpen && filteredResult.items.length > 0) {
      e?.preventDefault?.();
      const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
      const opt = filteredResult.items[idx];
      if (opt?.meta) {
        handleSelectEntry(opt.meta);
      }
    }
  };

  const renderSuggestionRow = (opt: VerticalFilterOption<FlatSkeletonEntry>, idx: number) => {
    const entry = opt.meta;
    if (!entry) return null;
    const isHighlighted = idx === highlightedIndex;
    return (
      <Pressable
        key={entry.key}
        testID={`field-autocomplete-option-${entry.key}`}
        accessibilityRole="button"
        {...(Platform.OS === 'web'
          ? ({
              nativeID: getOptionDomId(idx),
              role: 'option',
              tabIndex: -1,
              'aria-selected': isHighlighted,
            } as any)
          : {})}
        onPressIn={markSelectingInteraction}
        onPress={() => handleSelectEntry(entry)}
        style={({ pressed }) => [
          styles.item,
          isHighlighted && styles.itemHighlighted,
          pressed && styles.itemPressed,
        ]}
      >
        <View style={styles.itemTextCol}>
          <Text style={styles.itemLabel}>{entry.label}</Text>
          <Text style={styles.itemKey}>
            {entry.key} • {String(entry.type || 'text').toUpperCase()}
          </Text>
        </View>
        {opt.badge ? (
          <View style={styles.valueBadge}>
            <Text style={styles.valueBadgeText} numberOfLines={1}>
              {opt.badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const listboxWebProps: Record<string, unknown> =
    Platform.OS === 'web'
      ? {
          nativeID: listboxId,
          role: 'listbox',
          'aria-label': 'Campos disponíveis',
        }
      : {};

  return (
    <View ref={rootRef} style={styles.container}>
      <View style={[styles.inputShell, isOpen && styles.inputShellOpen]}>
        <TextInput
          ref={inputRef}
          testID="field-autocomplete-input"
          style={styles.input}
          value={value}
          blurOnSubmit={false}
          onChangeText={(txt) => {
            onChangeText(txt);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            clearPendingBlurTimer();
            if (suppressFocusOpenRef.current) {
              suppressFocusOpenRef.current = false;
              return;
            }
            setIsOpen(true);
          }}
          onTouchStart={() => {
            clearPendingBlurTimer();
            if (!isOpen) setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyPress={handleKeyDownWeb}
          {...(Platform.OS === 'web'
            ? ({
                role: 'combobox',
                'aria-expanded': isOpen,
                'aria-controls': isOpen ? listboxId : undefined,
                'aria-autocomplete': 'list',
                'aria-activedescendant':
                  isOpen && highlightedIndex >= 0 && filteredResult.items[highlightedIndex]
                    ? getOptionDomId(highlightedIndex)
                    : undefined,
                onClick: () => {
                  clearPendingBlurTimer();
                  if (!isOpen) setIsOpen(true);
                },
              } as any)
            : {})}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          accessibilityLabel={placeholder || 'Selecionar campo do formulário'}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {value.length > 0 ? (
          <Pressable
            testID="field-autocomplete-clear-btn"
            onPressIn={markSelectingInteraction}
            onPress={() => {
              clearSelectingOptionFlag();
              onChangeText('');
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            accessibilityRole="button"
            accessibilityLabel="Limpar busca de campo"
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="field-autocomplete-toggle-btn"
          onPressIn={markSelectingInteraction}
          onPress={() => {
            clearSelectingOptionFlag();
            setIsOpen((prev) => {
              const next = !prev;
              if (next) {
                setTimeout(() => inputRef.current?.focus(), 0);
              }
              return next;
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? 'Recolher sugestões' : 'Mostrar todas as sugestões'}
          accessibilityState={{ expanded: isOpen }}
          style={styles.iconBtn}
        >
          <Text style={styles.chevronText}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {isOpen ? (
        <View
          testID="field-autocomplete-dropdown"
          style={styles.dropdown}
        >
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownHeaderText}>
              {value.trim()
                ? `${filteredResult.matchedCount} de ${filteredResult.totalCount} campos`
                : `Todos os campos (${filteredResult.totalCount})`}
            </Text>
            <Pressable
              testID="field-autocomplete-close-btn"
              onPressIn={markSelectingInteraction}
              onPress={() => {
                clearSelectingOptionFlag();
                focusInputWithoutReopen();
                setIsOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Fechar sugestões"
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Fechar</Text>
            </Pressable>
          </View>

          {filteredResult.items.length === 0 ? (
            <>
              <View testID="field-autocomplete-empty" style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {`Nenhum campo encontrado para "${value.trim()}".`}
                </Text>
                <Pressable
                  testID="field-autocomplete-reset-query-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Limpar pesquisa e mostrar todos"
                  onPressIn={markSelectingInteraction}
                  onPress={() => {
                    clearSelectingOptionFlag();
                    onChangeText('');
                    inputRef.current?.focus();
                  }}
                  style={styles.clearSearchBtn}
                >
                  <Text style={styles.clearSearchBtnText}>Limpar pesquisa</Text>
                </Pressable>
              </View>
              <View style={{ width: '100%' }} {...(listboxWebProps as any)} />
            </>
          ) : (
            <View style={{ width: '100%' }} {...(listboxWebProps as any)}>
              {filteredResult.items.length > 50 ? (
                <FlatList
                  ref={flatListRef}
                  data={filteredResult.items}
                  keyExtractor={(opt) => opt.id}
                  renderItem={({ item, index }) => renderSuggestionRow(item, index)}
                  getItemLayout={getOptionItemLayout}
                  style={styles.scroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={100}
                  maxToRenderPerBatch={30}
                  windowSize={11}
                  {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
                  onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                      offset: Math.max(0, info.averageItemLength * info.index),
                      animated: false,
                    });
                    if (scrollRetryTimerRef.current !== null) {
                      clearTimeout(scrollRetryTimerRef.current);
                    }
                    scrollRetryTimerRef.current = setTimeout(() => {
                      scrollRetryTimerRef.current = null;
                      try {
                        flatListRef.current?.scrollToIndex({
                          index: info.index,
                          animated: false,
                          viewPosition:
                            info.index >= filteredResult.items.length - 1 ? 1 : 0.5,
                        });
                      } catch {
                        // Best-effort retry if list unmounted meanwhile
                      }
                    }, 50);
                  }}
                />
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  style={styles.scroll}
                  showsVerticalScrollIndicator
                  {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
                >
                  {filteredResult.items.map((opt, idx) => renderSuggestionRow(opt, idx))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: '#1E232F',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputShellOpen: {
    borderColor: '#38BDF8',
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#2B3544',
  },
  iconBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  chevronText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
  },
  dropdown: {
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  dropdownHeaderText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0369A1',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  scroll: {
    maxHeight: 240,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  itemHighlighted: {
    backgroundColor: '#1E293B',
  },
  itemPressed: {
    backgroundColor: 'rgba(3, 105, 161, 0.30)',
  },
  itemTextCol: {
    flex: 1,
    gap: 2,
  },
  itemLabel: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
  },
  itemKey: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  valueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  valueBadgeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyBox: {
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  clearSearchBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0369A1',
    justifyContent: 'center',
  },
  clearSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
