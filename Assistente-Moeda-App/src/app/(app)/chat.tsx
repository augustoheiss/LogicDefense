/**
 * AI Chat Screen — Assistente Moeda
 *
 * Full-screen chat interface accessible from a floating action button.
 * Sends financial context (metrics, goals, scenario projections) with every message
 * to give the AI full awareness of the user's financial state.
 *
 * Features:
 *   - Message bubble UI (user = right/purple, assistant = left/dark)
 *   - Auto-scroll to latest message
 *   - Typing indicator while waiting for AI response
 *   - Quick suggestion chips for common questions
 *   - Persistent message history in state (per session)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import { useSubscription } from '@/hooks/useSubscription';
import {
  sendChatMessage,
  buildFinancialContext,
  createMessage,
  type ChatMessage,
} from '@/services/aiChatService';

const QUICK_PROMPTS = [
  '📊 Como estou financeiramente?',
  '🎯 Vou bater a meta este mês?',
  '💡 Sugestões para economizar',
  '📈 Projeção para os próximos 3 meses',
  '⏱️ Quantas semanas de crédito tenho?',
];

export default function AIChatScreen() {
  const router = useRouter();
  const db = useCoinDB();
  const { isPro, subscriptionType, setShowPaywall } = useSubscription();

  // Safeguard screen: if not pro, redirect back and trigger paywall modal
  useEffect(() => {
    if (!isPro) {
      router.replace('/(app)/(tabs)');
      setTimeout(() => {
        setShowPaywall(true);
      }, 100);
    }
  }, [isPro, router, setShowPaywall]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage('assistant', 
      'Olá! 🪙 Sou seu assistente financeiro. Tenho acesso aos seus dados e métricas. Pergunte qualquer coisa sobre suas finanças!'
    ),
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Build financial context on every send
  const getContext = useCallback(() => {
    if (!db.activeTable) return 'Nenhuma tabela ativa.';
    return buildFinancialContext(
      db.activeTable.rows,
      db.activeTable.goals,
      db.metrics,
      db.activeTable.name,
    );
  }, [db.activeTable, db.metrics]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    // Check limit
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const activeCost = db.aiCostLastReset === currentMonthStr ? db.aiCostCurrentMonth : 0;
    const limit = subscriptionType === 'yearly' ? 10.0 : subscriptionType === 'monthly' ? 20.0 : 5.0;

    if (activeCost >= limit) {
      const warningMsg = "⚠️ Cota Mensal Excedida: O seu limite de uso da Inteligência Artificial para este mês foi atingido. Para continuar utilizando, aguarde a renovação do mês ou adquira um pacote extra.";
      if (Platform.OS === 'web') {
        window.alert(warningMsg);
      } else {
        Alert.alert("Limite Excedido", warningMsg);
      }
      return;
    }

    const userMsg = createMessage('user', msg);
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const context = getContext();
      const result = await sendChatMessage(msg, context, newMessages);

      if (result.error) {
        setMessages([...newMessages, createMessage('assistant', `⚠️ ${result.error}`)]);
      } else {
        setMessages([...newMessages, createMessage('assistant', result.response)]);
        const promptTokens = result.promptTokens ?? 0;
        const completionTokens = result.completionTokens ?? 0;
        const costUSD = (promptTokens * 0.15 + completionTokens * 0.60) / 1000000;
        const costBRL = costUSD * 5.5;
        db.addAICost(costBRL);
      }
    } catch {
      setMessages([
        ...newMessages,
        createMessage('assistant', '⚠️ Erro ao conectar com o servidor de IA.'),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, getContext, db, subscriptionType]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🤖 Assistente IA</Text>
          <Text style={styles.headerSubtitle}>
            {db.activeTable?.name ?? 'Sem tabela'}
          </Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        ItemSeparatorComponent={() => <View style={styles.messageSeparator} />}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <View style={styles.quickPrompts}>
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              style={({ pressed }) => [
                styles.quickChip,
                pressed && styles.quickChipPressed,
              ]}
              onPress={() => handleSend(prompt)}
            >
              <Text style={styles.quickChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Typing indicator */}
      {isLoading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.accent.purple} />
          <Text style={styles.typingText}>Analisando seus dados...</Text>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte sobre suas finanças..."
            placeholderTextColor={colors.text.disabled}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            editable={!isLoading}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && styles.sendBtnPressed,
              (!input.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!input.trim() || isLoading}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && <Text style={styles.botAvatar}>🤖</Text>}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isUser && styles.bubbleTextUser,
          ]}
          selectable
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize: 14,
    color: colors.accent.purple,
    fontWeight: '500',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Messages
  messageList: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  messageSeparator: {
    height: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    maxWidth: '85%',
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botAvatar: {
    fontSize: 20,
    marginBottom: 2,
  },
  bubble: {
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: colors.accent.purple,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  bubbleTextUser: {
    color: '#fff',
  },

  // Quick prompts
  quickPrompts: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickChip: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  quickChipPressed: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  quickChipText: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  // Typing
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  typingText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.secondary,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnPressed: {
    backgroundColor: colors.accent.purpleHover,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 16,
  },
});
