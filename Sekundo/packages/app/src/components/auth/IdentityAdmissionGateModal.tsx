/**
 * Component: IdentityAdmissionGateModal
 *
 * Implements the Zero-Trust Roster-Backed Identity Confirmation Gate:
 * 1. First-Time Registration Confirmation:
 *    - Asks for Full Name (`Nome Completo`), Operational Group (`Grupo`), and PIN (`PIN de Cadastro`).
 *    - Validates against the event's Privilege Matrix (`ParticipantProfile[]`).
 *    - If the person's name is NOT in the Privilege List OR has 0 active privileges, blocks spreadsheet
 *      visualization completely (`🚫 ACESSO NEGADO`) and records `IDENTITY_REJECTED` in the Activity Log.
 * 2. Quick PIN Unlock Mode (`isPinLocked === true`):
 *    - For shared phones/computers where a registered user clicked "🔒 Bloquear Tela":
 *      asks ONLY for their PIN (without asking for Name and Group again), or allows clicking
 *      "🚪 Sair (Logout)" so another person can confirm their own registration.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  type ParticipantProfile,
  type AuthenticatedSessionPrincipal,
  type AdmissionVerificationResult,
  listOperationalGroups,
  verifyParticipantAdmission,
} from '@sekundo/core';

export interface IdentityAdmissionGateModalProps {
  visible: boolean;
  eventName: string;
  eventId: string;
  privilegeRoster: ParticipantProfile[];
  lockedPrincipal?: AuthenticatedSessionPrincipal | null;
  onAdmissionConfirmed: (principal: AuthenticatedSessionPrincipal) => void;
  onAdmissionRejected: (result: AdmissionVerificationResult, attemptedName: string, attemptedGroup: string) => void;
  onUnlockWithPin?: (pin: string) => Promise<{ unlocked: boolean; errorMessage?: string }>;
  onLogoutLockedUser?: () => void;
}

export function IdentityAdmissionGateModal({
  visible,
  eventName,
  eventId,
  privilegeRoster,
  lockedPrincipal,
  onAdmissionConfirmed,
  onAdmissionRejected,
  onUnlockWithPin,
  onLogoutLockedUser,
}: IdentityAdmissionGateModalProps) {
  const availableGroups = useMemo(() => {
    const groups = listOperationalGroups(privilegeRoster);
    return groups.length > 0 ? groups : ['Grupo 1', 'Grupo 2', 'Grupo 3'];
  }, [privilegeRoster]);

  const [fullName, setFullName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>(availableGroups[0] || 'Grupo 1');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rejectionState, setRejectionState] = useState<AdmissionVerificationResult | null>(null);

  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  if (!visible) return null;

  const handleConfirmRegistration = () => {
    setErrorMsg(null);
    setRejectionState(null);

    const result = verifyParticipantAdmission(
      {
        fullName,
        groupTag: selectedGroup,
        pin,
        eventId,
      },
      privilegeRoster
    );

    if (!result.allowed || !result.principal) {
      setErrorMsg(result.errorMessage || 'Não foi possível validar seu cadastro.');
      if (result.rejectionReason !== 'EMPTY_FIELDS') {
        setRejectionState(result);
        onAdmissionRejected(result, fullName.trim(), selectedGroup);
      }
      return;
    }

    setFullName('');
    setPin('');
    onAdmissionConfirmed(result.principal);
  };

  const handleQuickPinUnlock = async () => {
    if (!onUnlockWithPin || !unlockPin.trim()) return;
    setUnlockError(null);
    const res = await onUnlockWithPin(unlockPin.trim());
    if (!res.unlocked) {
      setUnlockError(res.errorMessage || 'PIN incorreto.');
    } else {
      setUnlockPin('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Mode A: Quick PIN Unlock for already-registered user on shared device */}
          {lockedPrincipal && lockedPrincipal.isPinLocked ? (
            <View>
              <View style={styles.badgeHeader}>
                <Text style={styles.lockIcon}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Sessão Bloqueada por PIN</Text>
                  <Text style={styles.subtitle}>
                    Planilha: {eventName}
                  </Text>
                </View>
              </View>

              <View style={styles.registeredUserBox}>
                <Text style={styles.registeredUserLabel}>PESSOA REGISTRADA NESTE APARELHO</Text>
                <Text style={styles.registeredUserName}>
                  {lockedPrincipal.hasAdminSeal ? '👑 ' : '👁️ '}
                  {lockedPrincipal.fullName} ({lockedPrincipal.groupTag})
                </Text>
                <Text style={styles.registeredUserRole}>
                  {lockedPrincipal.hasAdminSeal
                    ? 'Selo Admin Ativo — Pode Editar e Exportar'
                    : 'Modo Consultor — Somente Visualização'}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>DIGITE SEU PIN PARA DESBLOQUEAR</Text>
              <TextInput
                testID="gate-quick-unlock-pin-input"
                style={styles.input}
                value={unlockPin}
                onChangeText={setUnlockPin}
                placeholder="Ex: 1001"
                placeholderTextColor="#64748B"
                secureTextEntry
                keyboardType="default"
              />

              {unlockError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {unlockError}</Text>
                </View>
              ) : null}

              <Pressable
                testID="gate-quick-unlock-submit-btn"
                onPress={handleQuickPinUnlock}
                style={[styles.primaryBtn, !unlockPin.trim() && styles.btnDisabled]}
              >
                <Text style={styles.primaryBtnText}>🔓 Desbloquear Planilha</Text>
              </Pressable>

              <Pressable
                testID="gate-switch-user-logout-btn"
                onPress={() => {
                  setUnlockPin('');
                  setUnlockError(null);
                  onLogoutLockedUser?.();
                }}
                style={styles.secondaryLogoutBtn}
              >
                <Text style={styles.secondaryLogoutText}>
                  🚪 Outra pessoa neste aparelho? Fazer Logout e Confirmar Novo Cadastro
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Mode B: First-Time Registration Confirmation (Full Name + Group + PIN) */
            <ScrollView style={{ maxHeight: 620 }} showsVerticalScrollIndicator={false}>
              <View style={styles.badgeHeader}>
                <Text style={styles.lockIcon}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Confirmação de Cadastro</Text>
                  <Text style={styles.subtitle}>
                    Planilha Compartilhada: {eventName}
                  </Text>
                </View>
              </View>

              <View style={styles.policyNotice}>
                <Text style={styles.policyNoticeTitle}>
                  🔐 Verificação Única de Primeiro Acesso
                </Text>
                <Text style={styles.policyNoticeText}>
                  • Confirme seu <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Nome Completo, Grupo e PIN</Text> cadastrados na Lista de Privilégios.{'\n'}
                  • Pessoas fora da Lista de Privilégios (ou sem privilégio ativo) <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>não podem visualizar a planilha</Text>.{'\n'}
                  • Apenas quem possui o <Text style={{ color: '#FFB800', fontWeight: '700' }}>👑 Selo Admin</Text> pode editar ou exportar; os demais entram em <Text style={{ color: '#38BDF8', fontWeight: '700' }}>👁️ Somente Consulta</Text>.{'\n'}
                  • Após confirmar uma vez, este aparelho lembrará de você até que você clique em <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>🚪 Sair (Logout)</Text>.
                </Text>
              </View>

              {/* 1. Full Name */}
              <Text style={styles.fieldLabel}>1. NOME COMPLETO (CONFORME LISTA DE PRIVILÉGIOS)</Text>
              <TextInput
                testID="gate-fullname-input"
                style={styles.input}
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  setErrorMsg(null);
                }}
                placeholder="Ex: Participante 01"
                placeholderTextColor="#64748B"
                autoCapitalize="words"
              />

              {/* 2. Operational Group */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>2. GRUPO DE CADASTRO</Text>
              <View style={styles.groupRow}>
                {availableGroups.map((grp) => {
                  const active = selectedGroup === grp;
                  return (
                    <Pressable
                      key={grp}
                      testID={`gate-group-chip-${grp}`}
                      onPress={() => {
                        setSelectedGroup(grp);
                        setErrorMsg(null);
                      }}
                      style={[styles.groupChip, active && styles.groupChipActive]}
                    >
                      <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>
                        👥 {grp}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 3. Individual PIN */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>3. PIN DE CONFIRMAÇÃO</Text>
              <TextInput
                testID="gate-pin-input"
                style={styles.input}
                value={pin}
                onChangeText={(v) => {
                  setPin(v);
                  setErrorMsg(null);
                }}
                placeholder="PIN individual de 4 dígitos (Ex: 1001)"
                placeholderTextColor="#64748B"
                secureTextEntry
              />

              {/* Rejection / Access Denied Banner */}
              {errorMsg ? (
                <View
                  testID="gate-access-denied-banner"
                  style={[
                    styles.errorBox,
                    rejectionState?.rejectionReason === 'NOT_IN_PRIVILEGE_LIST' ||
                    rejectionState?.rejectionReason === 'ZERO_ACTIVE_PRIVILEGES'
                      ? styles.hardBlockedBox
                      : null,
                  ]}
                >
                  <Text style={styles.errorTitle}>
                    {rejectionState?.rejectionReason === 'NOT_IN_PRIVILEGE_LIST'
                      ? '🚫 VISUALIZAÇÃO BLOQUEADA — NOME NÃO CADASTRADO'
                      : rejectionState?.rejectionReason === 'ZERO_ACTIVE_PRIVILEGES'
                      ? '🚫 VISUALIZAÇÃO BLOQUEADA — SEM PRIVILÉGIO ATIVO'
                      : '⚠️ FALHA NA CONFIRMAÇÃO DE CADASTRO'}
                  </Text>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                  <Text style={styles.auditWarningText}>
                    📜 Esta tentativa foi registrada no Log de Atividades da planilha.
                  </Text>
                </View>
              ) : null}

              <Pressable
                testID="gate-confirm-registration-btn"
                onPress={handleConfirmRegistration}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  ✅ Confirmar Cadastro e Acessar Planilha
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 18, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 22,
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  lockIcon: {
    fontSize: 28,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  policyNotice: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 16,
  },
  policyNoticeTitle: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  policyNoticeText: {
    color: '#CBD5E1',
    fontSize: 11.5,
    lineHeight: 17,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0B0F19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: '#334155',
  },
  groupChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  groupChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  groupChipTextActive: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    padding: 12,
  },
  hardBlockedBox: {
    backgroundColor: 'rgba(185, 28, 28, 0.22)',
    borderColor: '#EF4444',
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 12,
    lineHeight: 17,
  },
  auditWarningText: {
    color: '#94A3B8',
    fontSize: 10.5,
    marginTop: 6,
    fontStyle: 'italic',
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: '#FFB800',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  registeredUserBox: {
    backgroundColor: '#0B0F19',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 16,
  },
  registeredUserLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  registeredUserName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  registeredUserRole: {
    color: '#FFB800',
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '600',
  },
  secondaryLogoutBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  secondaryLogoutText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
