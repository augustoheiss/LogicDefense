import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';

export interface CadToolDefinition {
  /** Identificador único da ferramenta (usado também em testID="cad-tool-btn-{id}") */
  id: string;
  /** Ícone puro autoexplicativo (emoji ou símbolo gráfico) exibido no botão 40x40 */
  icon: string;
  /** Nome completo da ferramenta (exibido apenas dentro do Popover no 1º clique) */
  label: string;
  /** Atalho de teclado opcional exibido como badge no Popover */
  shortcut?: string;
  /** Explicação didática do que a ferramenta faz e quando utilizá-la */
  description: string;
  /** Texto do botão de confirmação (2º clique) no Popover */
  confirmLabel?: string;
  /** Cor de destaque do ícone/borda e do botão de confirmação */
  accentColor?: string;
  /** Indica se a ferramenta/modo está ativa no momento */
  isActive?: boolean;
  /** Badge curto opcional no canto superior direito do ícone (ex: contador) */
  badge?: string | number;
  /** Desabilita a execução no 2º clique (mas ainda permite abrir o Popover no 1º clique para explicar o motivo) */
  disabled?: boolean;
  /** Motivo exibido quando disabled=true */
  disabledReason?: string;
  /** Callback executado no 2º clique (botão de confirmação dentro do Popover) */
  onConfirm?: () => void;
  /** Mantém o Popover aberto após clicar em confirmar (útil para toggles de inspeção) */
  keepOpenOnConfirm?: boolean;
  /** Controles interativos rápidos renderizados dentro do Popover antes do botão de confirmação */
  renderCustomControls?: (closePopover: () => void) => React.ReactNode;
}

export interface CadToolDockProps {
  /** Lista de ferramentas exibidas apenas como ícones na doca */
  tools: CadToolDefinition[];
  /** Identificador opcional da doca para testes automatizados */
  testID?: string;
  /** Slot opcional à esquerda da doca (ex: botão voltar compacto ou título curto) */
  leftSlot?: React.ReactNode;
  /** Slot opcional à direita da doca (ex: indicador compacto de progresso) */
  rightSlot?: React.ReactNode;
}

/**
 * `<CadToolDock />` & `<ToolActionPopover />`
 *
 * Implementa o paradigma AutoCAD / Photoshop de barra de ferramentas enxuta:
 * - Botões na barra exibem SOMENTE o ícone (40x40px no Desktop, 42x42px no Mobile), sem rótulos de texto.
 * - Fluxo interativo estrito em 2 tempos:
 *   1º Clique no ícone -> abre o `<ToolActionPopover />` ancorado e contido nos limites da viewport,
 *      exibindo título, atalho, explicação didática, parâmetros rápidos e botão de confirmação.
 *   2º Clique no botão de ação do Popover -> confirma e executa a funcionalidade.
 * - Garante `zIndex >= 1500` para nunca ficar atrás dos panes cartográficos do Leaflet (`z-index: 400..1000`).
 */
export function CadToolDock({
  tools,
  testID = 'cad-tool-dock',
  leftSlot,
  rightSlot,
}: CadToolDockProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth < 640;
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [anchorX, setAnchorX] = useState<number>(16);

  const activeTool = tools.find((t) => t.id === activeToolId) || null;

  const closePopover = useCallback(() => {
    setActiveToolId(null);
  }, []);

  const handleIconPress = useCallback(
    (tool: CadToolDefinition, index: number, event?: any) => {
      if (activeToolId === tool.id) {
        setActiveToolId(null);
        return;
      }
      // Estimate horizontal anchor inside viewport bounds
      let pageX = index * 46 + 16;
      if (event?.nativeEvent?.pageX && typeof event.nativeEvent.pageX === 'number') {
        pageX = event.nativeEvent.pageX;
      }
      setAnchorX(pageX);
      setActiveToolId(tool.id);
    },
    [activeToolId]
  );

  const handleConfirmPress = useCallback(() => {
    if (!activeTool || activeTool.disabled) return;
    if (activeTool.onConfirm) {
      activeTool.onConfirm();
    }
    if (!activeTool.keepOpenOnConfirm) {
      setActiveToolId(null);
    }
  }, [activeTool]);

  // Compute clamped popover width & left position so it never overflows [8px, viewportWidth - 8px]
  const popoverWidth = Math.min(340, Math.max(260, viewportWidth - 16));
  const minLeft = 8;
  const maxLeft = Math.max(8, viewportWidth - popoverWidth - 8);
  const clampedLeft = Math.min(maxLeft, Math.max(minLeft, anchorX - popoverWidth / 2));

  return (
    <View style={styles.dockWrapper} testID={testID}>
      <View style={[styles.dockBar, isMobile && styles.dockBarMobile]}>
        {leftSlot ? <View style={styles.slotContainer}>{leftSlot}</View> : null}

        <View style={styles.iconsRow}>
          {tools.map((tool, index) => {
            const isPopoverOpen = activeToolId === tool.id;
            const accent = tool.accentColor || '#38BDF8';
            return (
              <Pressable
                key={tool.id}
                testID={`cad-tool-btn-${tool.id}`}
                accessibilityRole="button"
                accessibilityLabel={tool.label}
                onPress={(e) => handleIconPress(tool, index, e)}
                style={[
                  styles.iconBtn,
                  isMobile && styles.iconBtnMobile,
                  tool.isActive && {
                    borderColor: accent,
                    backgroundColor: 'rgba(56, 189, 248, 0.16)',
                  },
                  isPopoverOpen && {
                    borderColor: '#FFB800',
                    backgroundColor: 'rgba(255, 184, 0, 0.22)',
                    transform: [{ scale: 1.04 }],
                  },
                  tool.disabled && styles.iconBtnDisabled,
                ]}
              >
                <Text style={styles.iconGlyph}>{tool.icon}</Text>
                {tool.isActive ? (
                  <View style={[styles.activeDot, { backgroundColor: accent }]} />
                ) : null}
                {tool.badge !== undefined && tool.badge !== null && tool.badge !== '' ? (
                  <View style={[styles.badgePill, { borderColor: accent }]}>
                    <Text style={styles.badgeText}>{String(tool.badge)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {rightSlot ? <View style={styles.slotContainer}>{rightSlot}</View> : null}
      </View>

      {activeTool ? (
        <>
          <Pressable
            testID="cad-tool-popover-backdrop"
            style={styles.backdrop}
            onPress={closePopover}
          />
          <View
            testID="cad-tool-popover"
            style={[
              styles.popoverCard,
              {
                width: popoverWidth,
                left: clampedLeft,
                borderColor: activeTool.accentColor || '#38BDF8',
              },
            ]}
          >
            <View style={styles.popoverHeader}>
              <View style={styles.popoverTitleGroup}>
                <View
                  style={[
                    styles.popoverIconBadge,
                    { borderColor: activeTool.accentColor || '#38BDF8' },
                  ]}
                >
                  <Text style={styles.popoverIconText}>{activeTool.icon}</Text>
                </View>
                <View style={styles.popoverTitleTextWrap}>
                  <Text style={styles.popoverTitle} numberOfLines={2}>
                    {activeTool.label}
                  </Text>
                  <Text style={styles.popoverStepHint}>
                    Fluxo CAD em 2 etapas • Inspecione ou confirme abaixo
                  </Text>
                </View>
              </View>

              <View style={styles.popoverRightMeta}>
                {activeTool.shortcut ? (
                  <View style={styles.shortcutBadge}>
                    <Text style={styles.shortcutText}>{activeTool.shortcut}</Text>
                  </View>
                ) : null}
                <Pressable
                  testID="cad-tool-popover-close"
                  onPress={closePopover}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.popoverDescription}>{activeTool.description}</Text>

            {activeTool.disabled && activeTool.disabledReason ? (
              <View style={styles.disabledWarningBox}>
                <Text style={styles.disabledWarningText}>{activeTool.disabledReason}</Text>
              </View>
            ) : null}

            {activeTool.renderCustomControls ? (
              <View style={styles.customControlsBox}>
                {activeTool.renderCustomControls(closePopover)}
              </View>
            ) : null}

            {activeTool.onConfirm ? (
              <Pressable
                testID={`cad-tool-popover-confirm-${activeTool.id}`}
                disabled={activeTool.disabled}
                onPress={handleConfirmPress}
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: activeTool.disabled
                      ? 'rgba(100, 116, 139, 0.25)'
                      : activeTool.accentColor || '#38BDF8',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confirmBtnText,
                    activeTool.disabled && { color: '#94A3B8' },
                  ]}
                >
                  {activeTool.confirmLabel || `Confirmar: ${activeTool.label}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'relative',
    zIndex: 1500,
    backgroundColor: '#0B101D',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dockBar: {
    position: 'relative',
    zIndex: 1580,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  dockBarMobile: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  slotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    flexShrink: 1,
    maxWidth: '100%',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBtnMobile: {
    width: 35,
    height: 35,
  },
  iconBtnDisabled: {
    opacity: 0.55,
  },
  iconGlyph: {
    fontSize: 17,
    textAlign: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
  },
  backdrop: {
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1550,
          backgroundColor: 'rgba(2, 6, 23, 0.25)',
        } as any)
      : {
          position: 'absolute',
          top: 0,
          left: -1000,
          right: -1000,
          height: 2000,
          zIndex: 1550,
        }),
  },
  popoverCard: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    zIndex: 1600,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 24,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  popoverTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  popoverIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverIconText: {
    fontSize: 18,
  },
  popoverTitleTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  popoverTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  popoverStepHint: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  popoverRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortcutBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shortcutText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  popoverDescription: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  disabledWarningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 8,
    padding: 8,
  },
  disabledWarningText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '600',
  },
  customControlsBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 8,
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  confirmBtnText: {
    color: '#020617',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
