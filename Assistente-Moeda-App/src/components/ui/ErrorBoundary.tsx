/**
 * ErrorBoundary Component — Assistente Moeda
 *
 * Catches JavaScript runtime errors anywhere in its child component tree,
 * logs the error, and displays a graceful, self-healing recovery UI instead of
 * the dreaded blank white screen (White Screen of Death).
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.handleReset();
    }
  };

  private handleSanitizeAndRepair = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem('coin_assistant_db');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.tables)) {
            // Remove corrupt rows, sanitize dates and values
            parsed.tables = parsed.tables.map((t: any) => {
              if (!t || !Array.isArray(t.rows)) return t;
              t.rows = t.rows.filter((r: any) => r && typeof r === 'object').map((r: any) => ({
                ...r,
                date: r.date && typeof r.date === 'string' ? r.date : new Date().toISOString().slice(0, 10),
                value: typeof r.value === 'number' && !isNaN(r.value) ? r.value : 0,
                description: r.description || 'Lançamento Recuperado',
                id: r.id || `rec_${Math.random().toString(36).slice(2, 9)}`,
              }));
              return t;
            });
            window.localStorage.setItem('coin_assistant_db', JSON.stringify(parsed));
          }
        }
        window.alert('✓ Banco de dados local sanitizado com sucesso! Recarregando...');
        window.location.reload();
      } catch (e) {
        window.alert('Falha ao sanitizar: ' + String(e));
      }
    } else {
      this.handleReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Erro inesperado na renderização';
      const componentLabel = this.props.componentName ? ` em [${this.props.componentName}]` : '';

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🛡️</Text>
            </View>

            <Text style={styles.title}>
              {this.props.fallbackTitle || 'Proteção Ativa do Assistente Moeda'}
            </Text>

            <Text style={styles.subtitle}>
              Evitamos uma tela branca{componentLabel}. Os seus dados locais estão protegidos no navegador.
            </Text>

            <View style={styles.errorBanner}>
              <Text style={styles.errorText} numberOfLines={2}>
                ⚠️ {errorMsg}
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={this.handleReload}
              >
                <Text style={styles.primaryButtonText}>🔄 Recarregar Página</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={this.handleSanitizeAndRepair}
              >
                <Text style={styles.secondaryButtonText}>🩹 Reparar e Sanitizar Planilha</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
                onPress={this.handleReset}
              >
                <Text style={styles.outlineButtonText}>↩ Tentar Renderizar Novamente</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => this.setState({ showDetails: !this.state.showDetails })}
              style={styles.detailsToggle}
            >
              <Text style={styles.detailsToggleText}>
                {this.state.showDetails ? '▲ Ocultar detalhes técnicos' : '▼ Ver detalhes técnicos do erro'}
              </Text>
            </Pressable>

            {this.state.showDetails && (
              <ScrollView style={styles.detailsBox} nestedScrollEnabled>
                <Text style={styles.detailsStackText}>
                  {this.state.error?.stack || 'Sem stack trace disponível'}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={[styles.detailsStackText, { marginTop: 8, color: '#94a3b8' }]}>
                    Component Stack:
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    padding: spacing.xl,
    maxWidth: 580,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: radius.xs || 6,
    padding: spacing.sm,
    width: '100%',
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 12,
    color: '#f87171',
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actions: {
    width: '100%',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xs || 6,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xs || 6,
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs || 6,
    alignItems: 'center',
    width: '100%',
  },
  outlineButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.8,
  },
  detailsToggle: {
    paddingVertical: spacing.xs,
  },
  detailsToggleText: {
    fontSize: 11,
    color: colors.text.tertiary,
    textDecorationLine: 'underline',
  },
  detailsBox: {
    marginTop: spacing.xs,
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.xs || 4,
    padding: spacing.sm,
    maxHeight: 140,
    width: '100%',
  },
  detailsStackText: {
    fontSize: 10,
    color: '#f87171',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});
