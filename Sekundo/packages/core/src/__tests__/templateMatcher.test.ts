import { describe, it, expect } from 'vitest';
import {
  computeTemplateFingerprint,
  classifyFieldSemantics,
  autoRecognizePDFFields,
  stringSimilarity,
} from '../pdf/templateMatcher';
import type { PDFFormField } from '../pdf/types';
import type { FlatSkeletonEntry } from '../skeleton/types';

describe('PDF Template Matcher & Field Auto-Recognizer', () => {
  it('computes deterministic binary fingerprints', () => {
    const bytes1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const bytes2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const bytes3 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9]);

    const fp1 = computeTemplateFingerprint(bytes1);
    const fp2 = computeTemplateFingerprint(bytes2);
    const fp3 = computeTemplateFingerprint(bytes3);

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });

  it('classifies semantic fields in Portuguese, English and Spanish', () => {
    expect(classifyFieldSemantics('Nome_Estudante')?.semanticKey).toBe('person_name');
    expect(classifyFieldSemantics('StudentName')?.semanticKey).toBe('person_name');
    expect(classifyFieldSemantics('Data_Designacao')?.semanticKey).toBe('event_date');
    expect(classifyFieldSemantics('MeetingDate')?.semanticKey).toBe('event_date');
    expect(classifyFieldSemantics('Sala_Ou_Classe')?.semanticKey).toBe('room_or_hall');
    expect(classifyFieldSemantics('Ajudante_Nome')?.semanticKey).toBe('assistant_name');
    expect(classifyFieldSemantics('Tema_Discurso')?.semanticKey).toBe('part_title');
    expect(classifyFieldSemantics('Numero_Territorio')?.semanticKey).toBe('territory_number');
  });

  it('calculates string similarity with Levenshtein tolerance', () => {
    expect(stringSimilarity('estudante', 'estudante')).toBe(1.0);
    expect(stringSimilarity('estudante', 'estudant')).toBeGreaterThan(0.85);
    expect(stringSimilarity('casa', 'computador')).toBeLessThan(0.3);
  });

  it('auto-recognizes PDF form fields and generates mapping candidate reports', () => {
    const mockFields: PDFFormField[] = [
      {
        fieldId: 'f1',
        fieldName: 'Nome_Do_Estudante',
        fieldType: 'text',
        page: 1,
        x: 10,
        y: 20,
        width: 100,
        height: 20,
      },
      {
        fieldId: 'f2',
        fieldName: 'Data_Reuniao',
        fieldType: 'text',
        page: 1,
        x: 120,
        y: 20,
        width: 60,
        height: 20,
      },
      {
        fieldId: 'f3',
        fieldName: 'Sala_Designada',
        fieldType: 'text',
        page: 1,
        x: 190,
        y: 20,
        width: 80,
        height: 20,
      },
      {
        fieldId: 'f4',
        fieldName: 'CampoDesconhecido_123',
        fieldType: 'text',
        page: 1,
        x: 280,
        y: 20,
        width: 50,
        height: 20,
      },
    ];

    const mockPdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
    const sampleEntries: FlatSkeletonEntry[] = [
      {
        key: '01-01',
        type: 'slot',
        label: 'Primeira Conversa',
        value: 'Carlos Drummond',
        meta: {
          date: '15/10/2026',
          room: 'Sala B',
        },
      },
    ];

    const result = autoRecognizePDFFields(mockFields, mockPdfBytes, sampleEntries);

    expect(result.totalFieldsDetected).toBe(4);
    expect(result.autoMatchedCount).toBe(3);
    expect(result.overallConfidence).toBeGreaterThan(0.7);

    const f1 = result.mappings.find((m) => m.pdfFieldName === 'Nome_Do_Estudante');
    expect(f1?.matchedAttribute).toBe('value');
    expect(f1?.suggestedValue).toBe('Carlos Drummond');

    const f2 = result.mappings.find((m) => m.pdfFieldName === 'Data_Reuniao');
    expect(f2?.matchedAttribute).toBe('meta.date');
    expect(f2?.suggestedValue).toBe('15/10/2026');

    const f3 = result.mappings.find((m) => m.pdfFieldName === 'Sala_Designada');
    expect(f3?.matchedAttribute).toBe('meta.room');
    expect(f3?.suggestedValue).toBe('Sala B');
  });
});
