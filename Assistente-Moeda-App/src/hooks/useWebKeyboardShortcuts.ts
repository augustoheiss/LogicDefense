/**
 * useWebKeyboardShortcuts — Assistente Moeda
 *
 * Global Desktop / Web keyboard shortcuts for workstation productivity:
 *   - Ctrl+Z / Cmd+Z: Undo last operation (via OpLog)
 *   - Ctrl+Y / Cmd+Shift+Z: Redo last operation (via OpLog)
 *   - Alt+P: Toggle Street / Privacy Mode (blur monetary values)
 *   - N or + (outside inputs): Open Quick Add Row modal
 *   - / (outside inputs): Focus search input
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';

export interface WebKeyboardShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onTogglePrivacy?: () => void;
  onQuickAdd?: () => void;
  onFocusSearch?: () => void;
  onOpenBuilder?: () => void;
}

function isEditableElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

export function useWebKeyboardShortcuts(handlers: WebKeyboardShortcutHandlers): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl+Z / Cmd+Z (Undo) and Ctrl+Shift+Z / Ctrl+Y (Redo) — when not typing inside an input
      if (isCtrlOrCmd && !isEditableElementFocused()) {
        if (key === 'z' && !e.shiftKey && handlers.onUndo) {
          e.preventDefault();
          handlers.onUndo();
          return;
        }
        if (((key === 'z' && e.shiftKey) || key === 'y') && handlers.onRedo) {
          e.preventDefault();
          handlers.onRedo();
          return;
        }
        if (key === 'k' && handlers.onOpenBuilder) {
          e.preventDefault();
          handlers.onOpenBuilder();
          return;
        }
      }

      // Alt+P: Toggle Street / Privacy Mode anywhere
      if (e.altKey && key === 'p' && handlers.onTogglePrivacy) {
        e.preventDefault();
        handlers.onTogglePrivacy();
        return;
      }

      // Single-key shortcuts only when no input/textarea is focused
      if (!isCtrlOrCmd && !e.altKey && !isEditableElementFocused()) {
        if ((key === 'n' || e.key === '+') && handlers.onQuickAdd) {
          e.preventDefault();
          handlers.onQuickAdd();
          return;
        }
        if (e.key === '/' && handlers.onFocusSearch) {
          e.preventDefault();
          handlers.onFocusSearch();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
