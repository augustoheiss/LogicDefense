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
  type VerticalFilterOption,
} from '@sekundo/core';
import { scheduleWebOptionAlignment } from '@sekundo/coin-engine';

const ESTIMATED_OPTION_ROW_HEIGHT = 64;
const getOptionItemLayout = (
  _data: ArrayLike<VerticalFilterOption> | null | undefined,
  index: number
) => ({
  length: ESTIMATED_OPTION_ROW_HEIGHT,
  offset: ESTIMATED_OPTION_ROW_HEIGHT * index,
  index,
});

export interface SearchableVerticalFilterProps {
  /** Rótulo descritivo do filtro (ex.: "Território", "Candidato", "Subárvore"). */
  label?: string;
  /** Lista completa de opções filtráveis. */
  options: VerticalFilterOption[];
  /** ID selecionado quando `multiSelect === false` (ou ausente). */
  selectedId?: string | null;
  /** IDs selecionados quando `multiSelect === true`. */
  selectedIds?: string[];
  /** Permite selecionar múltiplos itens mantendo a lista aberta até clicar em "Concluir". */
  multiSelect?: boolean;
  /** Callback de seleção única. */
  onSelect?: (id: string, option: VerticalFilterOption) => void;
  /** Callback de seleção múltipla. */
  onChangeSelectedIds?: (ids: string[]) => void;
  /** Exibe botão rápido de limpeza ("×" / voltar ao padrão). */
  allowClear?: boolean;
  /** ID aplicado ao limpar seleção única (padrão: `'all'`, ou vazio se ausente). */
  clearValueId?: string;
  /** Texto auxiliar dentro do campo de busca vazio. */
  placeholder?: string;
  /** Texto exibido quando nenhum item combina com a busca digitada. */
  emptyMessage?: string;
  /** Abre expandido por padrão (útil em painéis dedicados). */
  defaultExpanded?: boolean;
  /** Desabilita interação. */
  disabled?: boolean;
  /** Altura máxima da lista vertical rolável. */
  listMaxHeight?: number;
  /** Permite ação "Selecionar filtrados" quando `multiSelect === true`. */
  showSelectFilteredAction?: boolean;
  /** TestID base para testes automatizados e Playwright. */
  testID?: string;
}

/**
 * `<SearchableVerticalFilter />` (Combobox Vertical Acessível)
 *
 * - Campo inicialmente vazio onde o usuário pode clicar/tocar ou digitar:
 *   - Ao clicar/focar com o campo vazio, exibe TODA a lista vertical imediatamente.
 *   - Ao digitar, filtra ao vivo (insensível a acentos e maiúsculas/minúsculas).
 *   - Se nada corresponder, exibe feedback explícito com botão para limpar a busca.
 * - Implementado como lista expansível inline (`nestedScrollEnabled` + virtualização
 *   automática via `FlatList` acima de 50 itens) para nunca aninhar `<Modal>` sobre `<Modal>`.
 * - Conforme WCAG 2.2 AA: alvos táteis >= 44px, contraste >= 4.5:1 e navegação por teclado na Web.
 */
export function SearchableVerticalFilter({
  label,
  options,
  selectedId,
  selectedIds,
  multiSelect = false,
  onSelect,
  onChangeSelectedIds,
  allowClear = true,
  clearValueId,
  placeholder = '🔍 Clique para ver toda a lista ou digite para filtrar...',
  emptyMessage = 'Nenhum item encontrado para essa pesquisa.',
  defaultExpanded = false,
  disabled = false,
  listMaxHeight = 260,
  showSelectFilteredAction = true,
  testID = 'searchable-vertical-filter',
}: SearchableVerticalFilterProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<TextInput | null>(null);
  const rootRef = useRef<View | null>(null);
  const flatListRef = useRef<FlatList<VerticalFilterOption> | null>(null);
  const suppressFocusOpenRef = useRef(false);
  const suppressNextEscapeKeyUpRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const rawReactId = useId();
  const domBaseId = useMemo(
    () => `${testID}-${rawReactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [testID, rawReactId]
  );
  const listboxId = `${domBaseId}-listbox`;
  const getOptionDomId = (index: number) => `${domBaseId}-option-${index}`;

  const safeOptions = useMemo(
    () =>
      Array.isArray(options)
        ? options.filter((o): o is VerticalFilterOption => Boolean(o && typeof o === 'object'))
        : [],
    [options]
  );

  const filteredResult = useMemo(
    () =>
      filterAndRankVerticalOptions(safeOptions, query, {
        keepPinnedOnSearch: false,
      }),
    [safeOptions, query]
  );

  const activeSet = useMemo(() => {
    if (multiSelect) {
      return new Set(selectedIds || []);
    }
    return new Set(selectedId !== null && selectedId !== undefined ? [selectedId] : []);
  }, [multiSelect, selectedIds, selectedId]);

  const selectedOptions = useMemo(
    () => safeOptions.filter((opt) => activeSet.has(opt.id)),
    [safeOptions, activeSet]
  );

  const summaryText = useMemo(() => {
    if (selectedOptions.length === 0) return 'Nenhum selecionado';
    if (multiSelect) {
      if (selectedOptions.length === safeOptions.length && safeOptions.length > 1) {
        return `Todos (${selectedOptions.length})`;
      }
      if (selectedOptions.length === 1) {
        return selectedOptions[0].label;
      }
      return `${selectedOptions.length} selecionados (${selectedOptions
        .slice(0, 2)
        .map((o) => o.label)
        .join(', ')}${selectedOptions.length > 2 ? '…' : ''})`;
    }
    return selectedOptions[0].label;
  }, [selectedOptions, multiSelect, safeOptions.length]);

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

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query]);

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
        // Always scrollToIndex (with getItemLayout) rather than scrollToEnd so
        // unmeasured tail items render cleanly when jumping via End/Arrow keys.
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
  }, [highlightedIndex, isOpen, filteredResult.items.length, testID]);

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

  // Na Web, fecha com clique externo, Tab para fora (focusin) ou tecla Escape enquanto foco/alvo estiver dentro do combobox
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen || typeof document === 'undefined') return;
    const isTargetInsideRoot = (target: unknown) => {
      const node = rootRef.current as unknown as { contains?: (t: unknown) => boolean } | null;
      return Boolean(node && typeof node.contains === 'function' && target && node.contains(target));
    };
    const handleOutsideClick = (ev: MouseEvent) => {
      if (ev.target && !isTargetInsideRoot(ev.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    const handleFocusIn = (ev: FocusEvent) => {
      if (ev.target && !isTargetInsideRoot(ev.target)) {
        setIsOpen(false);
        setQuery('');
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
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        setQuery('');
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
      return next;
    });
  };

  const handlePickOption = (option: VerticalFilterOption) => {
    if (disabled || option.disabled) return;
    if (multiSelect) {
      const current = Array.isArray(selectedIds) ? [...selectedIds] : [];
      const exists = current.includes(option.id);
      const next = exists ? current.filter((id) => id !== option.id) : [...current, option.id];
      onChangeSelectedIds?.(next);
      return;
    }

    onSelect?.(option.id, option);
    setQuery('');
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    if (disabled) return;
    setQuery('');
    if (multiSelect) {
      onChangeSelectedIds?.([]);
      return;
    }
    const targetId =
      clearValueId !== undefined
        ? clearValueId
        : safeOptions.find((o) => o.id === 'all' || o.pinned)?.id ?? '';
    const found = safeOptions.find((o) => o.id === targetId);
    if (found) {
      onSelect?.(found.id, found);
    } else if (targetId !== undefined) {
      onSelect?.(targetId, { id: targetId, label: '' });
    }
  };

  const handleSelectAllFiltered = () => {
    if (!multiSelect || disabled) return;
    const nextIds = Array.from(
      new Set([...(selectedIds || []), ...filteredResult.items.filter((i) => !i.disabled).map((i) => i.id)])
    );
    onChangeSelectedIds?.(nextIds);
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
      setQuery('');
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
      const targetOpt =
        highlightedIndex >= 0
          ? filteredResult.items[highlightedIndex]
          : filteredResult.items.find((o) => !o.disabled) ?? filteredResult.items[0];
      if (targetOpt && !targetOpt.disabled) {
        handlePickOption(targetOpt);
      }
    }
  };

  const canClearSelection =
    allowClear &&
    (multiSelect
      ? (selectedIds?.length || 0) > 0
      : Boolean(
          selectedId &&
            selectedId !==
              (clearValueId !== undefined
                ? clearValueId
                : safeOptions.find((o) => o.id === 'all' || o.pinned)?.id)
        ));
  const canShowClearBtn = query.length > 0 || canClearSelection;

  const renderOptionRow = (item: VerticalFilterOption, index: number) => {
    const isSelected = activeSet.has(item.id);
    const isHighlighted = index === highlightedIndex;
    return (
      <Pressable
        key={item.id}
        testID={`${testID}-option-${item.id}`}
        disabled={Boolean(item.disabled)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: Boolean(item.disabled) }}
        {...(Platform.OS === 'web'
          ? ({
              nativeID: getOptionDomId(index),
              role: 'option',
              tabIndex: -1,
              'aria-selected': isSelected,
              'aria-disabled': Boolean(item.disabled),
            } as any)
          : {})}
        onPress={() => handlePickOption(item)}
        style={({ pressed }) => [
          styles.optionRow,
          isSelected && styles.optionRowSelected,
          isHighlighted && !isSelected && styles.optionRowHighlighted,
          pressed && styles.optionRowPressed,
          item.disabled && styles.optionRowDisabled,
        ]}
      >
        <View
          style={[
            multiSelect ? styles.checkboxIndicator : styles.radioIndicator,
            isSelected && styles.indicatorActive,
          ]}
        >
          <Text style={styles.indicatorText}>{isSelected ? '✓' : ''}</Text>
        </View>

        {item.dotColor ? (
          <View style={[styles.colorDot, { backgroundColor: item.dotColor }]} />
        ) : null}

        <View style={styles.optionTextCol}>
          <Text
            style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}
            numberOfLines={2}
          >
            {item.label}
          </Text>
          {item.subtitle ? (
            <Text style={styles.optionSubtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        {item.badge ? (
          <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
            <Text
              style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]}
              numberOfLines={1}
            >
              {item.badge}
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
          'aria-label': label || 'Opções disponíveis',
          'aria-multiselectable': multiSelect || undefined,
        }
      : {};

  return (
    <View ref={rootRef} style={[styles.container, disabled && styles.containerDisabled]} testID={testID}>
      {/* Cabeçalho com rótulo e resumo atual da seleção */}
      <View style={styles.headerRow}>
        {label ? <Text style={styles.label}>{label}</Text> : <View />}
        <Pressable
          testID={`${testID}-summary-toggle`}
          onPress={handleToggleOpen}
          accessibilityRole="button"
          accessibilityLabel={`${label || 'Filtro'}: ${summaryText}`}
          accessibilityState={{ expanded: isOpen }}
          style={styles.selectedPill}
        >
          {selectedOptions[0]?.dotColor ? (
            <View style={[styles.colorDot, { backgroundColor: selectedOptions[0].dotColor }]} />
          ) : null}
          <Text style={styles.selectedPillText} numberOfLines={1}>
            {summaryText}
          </Text>
          <Text style={styles.selectedCountText}>({safeOptions.length})</Text>
        </Pressable>
      </View>

      {/* Campo de busca inicialmente vazio para abrir lista vertical */}
      <View style={[styles.inputShell, isOpen && styles.inputShellOpen]}>
        <TextInput
          ref={inputRef}
          testID={`${testID}-input`}
          value={query}
          editable={!disabled}
          blurOnSubmit={false}
          onFocus={() => {
            if (suppressFocusOpenRef.current) {
              suppressFocusOpenRef.current = false;
              return;
            }
            if (!disabled) setIsOpen(true);
          }}
          onTouchStart={() => {
            if (!disabled && !isOpen) setIsOpen(true);
          }}
          onChangeText={(txt) => {
            setQuery(txt);
            if (!isOpen) setIsOpen(true);
          }}
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
                  if (!disabled && !isOpen) setIsOpen(true);
                },
              } as any)
            : {})}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          style={styles.textInput}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={label ? `Buscar em ${label}` : 'Buscar opção na lista'}
        />

        {canShowClearBtn ? (
          <Pressable
            testID={`${testID}-clear-btn`}
            onPress={() => {
              if (query.length > 0) {
                setQuery('');
              } else if (allowClear) {
                handleClearSelection();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={query.length > 0 ? 'Limpar texto da busca' : 'Limpar filtro'}
            style={styles.iconActionBtn}
          >
            <Text style={styles.iconActionText}>✕</Text>
          </Pressable>
        ) : null}

        <Pressable
          testID={`${testID}-toggle-btn`}
          onPress={handleToggleOpen}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? 'Recolher lista de opções' : 'Abrir lista completa'}
          accessibilityState={{ expanded: isOpen }}
          style={styles.iconActionBtn}
        >
          <Text style={styles.chevronText}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {/* Lista Vertical Expandida (inline, sem aninhar Modal e sem cortar dentro de ScrollView) */}
      {isOpen ? (
        <View
          testID={`${testID}-dropdown`}
          style={styles.dropdownPanel}
        >
          <View style={styles.dropdownToolbar}>
            <Text style={styles.dropdownCount}>
              {filteredResult.isQueryActive
                ? `${filteredResult.matchedCount} de ${filteredResult.totalCount} encontrado(s)`
                : `Mostrando todos os ${filteredResult.totalCount} itens`}
            </Text>

            <View style={styles.toolbarActions}>
              {multiSelect && showSelectFilteredAction && filteredResult.items.length > 0 ? (
                <Pressable
                  testID={`${testID}-select-filtered-btn`}
                  onPress={handleSelectAllFiltered}
                  style={styles.toolbarLinkBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar todos os ${filteredResult.items.length} itens filtrados`}
                >
                  <Text style={styles.toolbarLinkText}>
                    Selecionar ({filteredResult.items.length})
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                testID={`${testID}-done-btn`}
                onPress={() => {
                  focusInputWithoutReopen();
                  setIsOpen(false);
                  setQuery('');
                }}
                style={styles.doneBtn}
                accessibilityRole="button"
                accessibilityLabel="Fechar lista de seleção"
              >
                <Text style={styles.doneBtnText}>
                  {multiSelect ? `Concluir (${selectedOptions.length})` : 'Fechar'}
                </Text>
              </Pressable>
            </View>
          </View>

          {filteredResult.items.length === 0 ? (
            <>
              <View testID={`${testID}-empty`} style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {query.trim()
                    ? `Nenhum item encontrado para "${query.trim()}"`
                    : emptyMessage}
                </Text>
                <Text style={styles.emptyHint}>
                  Tente outro termo ou toque abaixo para exibir toda a lista novamente.
                </Text>
                {query.trim().length > 0 ? (
                  <Pressable
                    testID={`${testID}-reset-query-btn`}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar pesquisa e mostrar todos"
                    onPress={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    style={styles.resetQueryBtn}
                  >
                    <Text style={styles.resetQueryBtnText}>Limpar pesquisa e mostrar todos</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ width: '100%' }} {...(listboxWebProps as any)} />
            </>
          ) : (
            <View style={{ width: '100%' }} {...(listboxWebProps as any)}>
              {filteredResult.items.length > 50 ? (
                <FlatList
                  ref={flatListRef}
                  data={filteredResult.items}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => renderOptionRow(item, index)}
                  initialNumToRender={30}
                  maxToRenderPerBatch={30}
                  windowSize={11}
                  getItemLayout={getOptionItemLayout}
                  style={[styles.listScroll, { maxHeight: listMaxHeight }]}
                  contentContainerStyle={styles.listContent}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
                  onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                      offset: Math.max(0, (info.averageItemLength || ESTIMATED_OPTION_ROW_HEIGHT) * info.index),
                      animated: false,
                    });
                    setTimeout(() => {
                      try {
                        flatListRef.current?.scrollToIndex({
                          index: info.index,
                          animated: false,
                          viewPosition: info.index === filteredResult.items.length - 1 ? 1 : 0.5,
                        });
                      } catch {
                        // noop
                      }
                    }, 30);
                  }}
                />
              ) : (
                <ScrollView
                  style={[styles.listScroll, { maxHeight: listMaxHeight }]}
                  contentContainerStyle={styles.listContent}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
                >
                  {filteredResult.items.map((item, idx) => renderOptionRow(item, idx))}
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
  containerDisabled: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  label: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(3, 105, 161, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  selectedPillText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  selectedCountText: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  inputShellOpen: {
    borderColor: '#38BDF8',
  },
  textInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
  },
  iconActionBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#1E293B',
  },
  iconActionText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  chevronText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
  },
  dropdownPanel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
    backgroundColor: '#0B1120',
    overflow: 'hidden',
  },
  dropdownToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
    flexWrap: 'wrap',
  },
  dropdownCount: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarLinkBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
  },
  toolbarLinkText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  doneBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0369A1',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  listScroll: {
    width: '100%',
  },
  listContent: {
    padding: 8,
    gap: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#111827',
  },
  optionRowSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(3, 105, 161, 0.30)',
  },
  optionRowHighlighted: {
    borderColor: '#94A3B8',
    backgroundColor: '#1E293B',
  },
  optionRowPressed: {
    opacity: 0.85,
  },
  optionRowDisabled: {
    opacity: 0.45,
  },
  checkboxIndicator: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  indicatorActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0369A1',
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTextCol: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  optionSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  optionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionBadgeSelected: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  optionBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  optionBadgeTextSelected: {
    color: '#FFFFFF',
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyHint: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
  },
  resetQueryBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0369A1',
    justifyContent: 'center',
  },
  resetQueryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
