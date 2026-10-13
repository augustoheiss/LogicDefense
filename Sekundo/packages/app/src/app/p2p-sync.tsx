/**
 * Page: p2p-sync
 *
 * Ephemeral WebRTC synchronization panel.
 * Establishes client-to-client P2P data channels to stream historical event archives
 * and open transient chat rooms with zero database presence.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePeerChat } from '../hooks/usePeerChat';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { useSkeleton } from '../hooks/useSkeleton';
import { ChatRoom } from '../components/chat/ChatRoom';
import * as Clipboard from 'expo-clipboard';

export default function P2PSyncPage() {
  const router = useRouter();
  const { id, role } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';
  const isWebAdmin = role === 'admin';

  const { events, updateEventState } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry } = useSkeleton(eventId);

  const [currentUser, setCurrentUser] = useState(isWebAdmin ? 'Admin' : 'Convidado');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleHistorySync = async (historyData: any[]) => {
    if (!event) return;

    // Auto-Merge incoming archive history
    const mergedArchive = [...event.archive];
    for (const incomingSnapshot of historyData) {
      const existingIdx = mergedArchive.findIndex((item) => item.date === incomingSnapshot.date);
      if (existingIdx !== -1) {
        mergedArchive[existingIdx].values = {
          ...mergedArchive[existingIdx].values,
          ...incomingSnapshot.values,
        };
      } else {
        mergedArchive.push(incomingSnapshot);
      }
    }

    const updatedState = { ...event, archive: mergedArchive };
    await updateEventState(eventId, updatedState);
    alert('Sincronização descentralizada concluída! Histórico mesclado com sucesso.');
  };

  const {
    connectionState,
    messages,
    roomId,
    error,
    setError,
    startAdminHandshake,
    joinViewerHandshake,
    sendMessage,
    streamHistory,
    closeConnection,
  } = usePeerChat({
    eventId,
    role: isWebAdmin ? 'admin' : 'viewer',
    onHistorySync: handleHistorySync,
  });

  const handleStartHost = () => {
    startAdminHandshake();
  };

  const handleJoin = () => {
    if (!joinRoomId.trim()) return;
    joinViewerHandshake(joinRoomId.trim());
  };

  const handleCopyLink = async () => {
    if (!roomId) return;
    await Clipboard.setStringAsync(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              closeConnection();
              router.replace(`/skeleton-editor?id=${eventId}`);
            }}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Voltar ao Editor</Text>
          </Pressable>
          <Text style={styles.title}>Decentralized P2P Sync</Text>
          <Text style={styles.subtitle}>
            Evento: {event.config.name} • Perfil: {isWebAdmin ? 'HOST (Admin)' : 'GUEST (Convidado)'}
          </Text>
        </View>

        {/* Error Notification Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                closeConnection();
              }}
              style={styles.errorDismissBtn}
            >
              <Text style={styles.errorDismissText}>Fechar</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Connection Setup Dashboard */}
        {connectionState === 'disconnected' ? (
          <View style={styles.setupDeck}>
            <Text style={styles.sectionLabel}>ESTABELECER CONEXÃO P2P DESCENTRALIZADA</Text>
            {isWebAdmin ? (
              <View style={styles.setupCard}>
                <Text style={styles.cardHelp}>
                  Iniciar como Host cria uma sala efêmera de sinalização. Compartilhe o código de 8 dígitos
                  com seu convidado para abrir o túnel P2P direto no navegador.
                </Text>
                <Pressable onPress={handleStartHost} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Start Hosting Room</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.setupCard}>
                <Text style={styles.cardHelp}>
                  Insira o código de 8 dígitos da sala fornecido pelo Host para conectar a ponte de sinalização.
                </Text>
                <TextInput
                  style={styles.input}
                  value={joinRoomId}
                  onChangeText={setJoinRoomId}
                  placeholder="Código da Sala (ex: e4a5c6d7)"
                  placeholderTextColor="#4F5E74"
                  maxLength={8}
                />
                <Pressable
                  disabled={!joinRoomId.trim()}
                  onPress={handleJoin}
                  style={[styles.primaryBtn, !joinRoomId.trim() && styles.btnDisabled]}
                >
                  <Text style={styles.primaryBtnText}>Entrar na Sala Peer</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {/* Handshake Connecting State */}
        {connectionState === 'connecting' ? (
          <View style={styles.connectingDeck}>
            <ActivityIndicator size="large" color="#8B5CF6" style={{ marginBottom: 16 }} />
            <Text style={styles.connectingTitle}>Estabelecendo Handshake WebRTC P2P</Text>
            {roomId ? (
              <View style={styles.roomIdCard}>
                <Text style={styles.roomIdLabel}>Código da Sala (Room ID):</Text>
                <View style={styles.roomIdRow}>
                  <Text style={styles.roomIdVal}>{roomId}</Text>
                  <Pressable onPress={handleCopyLink} style={styles.copyBtn}>
                    <Text style={styles.copyBtnText}>{copied ? '✓ Copiado' : 'Copiar'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Text style={styles.connectingSub}>Aguardando conexão do peer remoto...</Text>
            <Pressable
              onPress={() => {
                closeConnection();
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancelar Conexão</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Connection Open: Ephemeral Workspace */}
        {connectionState === 'connected' ? (
          <View style={styles.connectedWorkspace}>
            {/* Control Bar */}
            <View style={styles.controlBar}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>PONTE P2P CONECTADA</Text>
              </View>

              {isWebAdmin ? (
                <Pressable
                  onPress={() => streamHistory(event.archive)}
                  style={styles.syncHistoryBtn}
                >
                  <Text style={styles.syncHistoryBtnText}>Transmitir Histórico</Text>
                </Pressable>
              ) : (
                <Text style={styles.viewerSyncText}>Aguardando transmissão do host...</Text>
              )}
            </View>

            {/* Chat Room */}
            <View style={styles.chatWrapper}>
              <ChatRoom
                messages={messages}
                onSendMessage={(text) => sendMessage(text, currentUser)}
                currentUser={currentUser}
              />
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 600,
    height: '100%',
    maxHeight: 700,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: 16,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  errorDismissBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  errorDismissText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  setupDeck: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  setupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardHelp: {
    color: '#A9B4C5',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  connectingDeck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  roomIdCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    width: '100%',
    maxWidth: 260,
    marginBottom: 16,
    alignItems: 'center',
  },
  roomIdLabel: {
    color: '#6F7E94',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  roomIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomIdVal: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  copyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 12,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  connectingSub: {
    color: '#6F7E94',
    fontSize: 12,
    marginBottom: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '500',
  },
  connectedWorkspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981', // Green
    marginRight: 8,
  },
  statusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  syncHistoryBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  syncHistoryBtnText: {
    color: '#12151C',
    fontSize: 12,
    fontWeight: '600',
  },
  viewerSyncText: {
    color: '#8A94A6',
    fontSize: 11,
  },
  chatWrapper: {
    flex: 1,
  },
});
