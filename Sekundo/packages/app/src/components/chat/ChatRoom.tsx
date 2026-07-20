/**
 * Component: ChatRoom
 *
 * Volatile ephemeral chat box.
 * Messages exist strictly in component memory state. No disk writes.
 * Wipes automatically when P2P connection closes.
 */

import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import type { ChatMessage } from '@sekundo/core';

interface ChatRoomProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: string;
}

export function ChatRoom({ messages, onSendMessage, currentUser }: ChatRoomProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
    
    // Auto scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Volatile Ephemeral Chat</Text>
        <Text style={styles.subtitle}>🔒 Volatile local memory only • Zero persistent trace</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messageScroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages in this P2P channel yet.</Text>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderName === currentUser;
            return (
              <View
                key={msg.id}
                style={[styles.msgWrapper, isMe ? styles.msgMe : styles.msgOther]}
              >
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                  <Text style={styles.senderName}>{msg.senderName}</Text>
                  <Text style={styles.msgText}>{msg.text}</Text>
                  <Text style={styles.timeText}>{new Date(msg.timestamp).toLocaleTimeString()}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input panel */}
      <View style={styles.inputPanel}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type message..."
          placeholderTextColor="#4F5E74"
          onSubmitEditing={handleSend}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            !inputText.trim() && styles.sendBtnDisabled,
            pressed && styles.sendPressed,
          ]}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#161922',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8B5CF6', // Purple privacy indicator
    fontSize: 11,
    marginTop: 2,
  },
  messageScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
  },
  emptyText: {
    color: '#6F7E94',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginBottom: 10,
    width: '100%',
  },
  msgMe: {
    justifyContent: 'flex-end',
  },
  msgOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 8,
    padding: 10,
  },
  bubbleMe: {
    backgroundColor: '#8B5CF6', // Purple for admin/me
  },
  bubbleOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  senderName: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  msgText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  timeText: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputPanel: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sendBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 6,
    paddingHorizontal: 16,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendPressed: {
    opacity: 0.9,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
