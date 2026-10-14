import React from 'react';
import {
  View,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { CSVImporter } from '../CSVImporter';

interface CSVTextImporterModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (summary: string) => void;
  initialCsvText?: string;
  onOpenExamplesGallery?: () => void;
}

export function CSVTextImporterModal({
  visible,
  onClose,
  onSuccess,
  initialCsvText,
  onOpenExamplesGallery,
}: CSVTextImporterModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isWide && styles.modalContainerWide]}>
          <CSVImporter
            initialCsvText={initialCsvText}
            onOpenExamplesGallery={onOpenExamplesGallery}
            onSuccess={() => {
              onSuccess('Importação in-place concluída com sucesso!');
            }}
            onCancel={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 500,
    overflow: 'hidden',
  },
  modalContainerWide: {
    maxWidth: 680,
  },
});
