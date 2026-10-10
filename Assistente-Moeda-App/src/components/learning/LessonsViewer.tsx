import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { FINANCIAL_LESSONS, type MicroLesson } from '@/learning/lessons';

export function LessonsViewer() {
  const [selectedLesson, setSelectedLesson] = useState<MicroLesson | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Aprenda em 2 Minutos 📚</Text>
        <Text style={styles.sectionSubtitle}>Dicas práticas e sem jargões para sua família</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsScroll}
      >
        {FINANCIAL_LESSONS.map(lesson => (
          <Pressable
            key={lesson.id}
            style={({ pressed }) => [
              styles.lessonCard,
              pressed && styles.lessonCardPressed,
            ]}
            onPress={() => setSelectedLesson(lesson)}
          >
            <View style={styles.cardTop}>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>⏱️ {lesson.readingMinutes} min</Text>
              </View>
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {lesson.title}
            </Text>

            <Text style={styles.cardSummary} numberOfLines={3}>
              {lesson.summary}
            </Text>

            <View style={styles.readMoreRow}>
              <Text style={styles.readMoreText}>Ler lição ›</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Lesson Details Modal */}
      <Modal
        visible={selectedLesson !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedLesson(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedLesson && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeBadgeText}>
                      ⏱️ Leitura de {selectedLesson.readingMinutes} min
                    </Text>
                  </View>
                  <Pressable
                    style={styles.closeBtn}
                    onPress={() => setSelectedLesson(null)}
                  >
                    <Text style={styles.closeBtnText}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitle}>{selectedLesson.title}</Text>
                  <Text style={styles.modalText}>{selectedLesson.content}</Text>

                  {/* Takeaway Box */}
                  <View style={styles.takeawayBox}>
                    <Text style={styles.takeawayLabel}>💡 PONTO PRINCIPAL:</Text>
                    <Text style={styles.takeawayText}>{selectedLesson.keyTakeaway}</Text>
                  </View>

                  {/* Action Challenge Box */}
                  <View style={styles.challengeBox}>
                    <Text style={styles.challengeLabel}>🎯 DESAFIO PRÁTICO:</Text>
                    <Text style={styles.challengeText}>
                      {selectedLesson.actionChallenge}
                    </Text>
                  </View>
                </ScrollView>

                <Pressable
                  style={styles.finishBtn}
                  onPress={() => setSelectedLesson(null)}
                >
                  <Text style={styles.finishBtnText}>Entendi, aplicar na rotina</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  headerRow: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  cardsScroll: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  lessonCard: {
    width: 220,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'space-between',
  },
  lessonCardPressed: {
    borderColor: colors.accent.purpleBorder,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  timeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.tertiary,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
    lineHeight: 18,
  },
  cardSummary: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    flex: 1,
    marginBottom: spacing.sm,
  },
  readMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  modalBody: {
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  modalText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  takeawayBox: {
    backgroundColor: colors.accent.purpleLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.purple,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  takeawayLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  takeawayText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '600',
    lineHeight: 18,
  },
  challengeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.success.main,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  challengeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success.main,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  challengeText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '600',
    lineHeight: 18,
  },
  finishBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
