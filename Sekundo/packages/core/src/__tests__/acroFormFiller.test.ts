import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  inspectPDFForm,
  fillAcroForm,
  fillS89Assignments4Up,
  type S89Assignment,
} from '../pdf/acroFormFiller';

async function createSyntheticPDFWithFields(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const form = pdfDoc.getForm();

  const nameField = form.createTextField('Student_Name');
  nameField.addToPage(page, { x: 50, y: 300, width: 200, height: 25 });

  const activeCheck = form.createCheckBox('Is_Active');
  activeCheck.addToPage(page, { x: 50, y: 250, width: 20, height: 20 });

  return pdfDoc.save();
}

async function createSyntheticS89Template(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const form = pdfDoc.getForm();

  // Create 4 quadrants with 4-Up canonical field codes
  for (let q = 1; q <= 4; q++) {
    const studentField = form.createTextField(`900_${q}_Text_SanSerif`);
    studentField.addToPage(page, { x: 50, y: 800 - q * 180, width: 200, height: 20 });

    const dateField = form.createTextField(`900_${q}_Text_SanSerif_Date`);
    dateField.addToPage(page, { x: 260, y: 800 - q * 180, width: 100, height: 20 });

    const partField = form.createTextField(`900_${q}_Text_SanSerif_Part`);
    partField.addToPage(page, { x: 370, y: 800 - q * 180, width: 150, height: 20 });
  }

  return pdfDoc.save();
}

describe('AcroForm Inspector & Injector Engine', () => {
  it('should inspect form fields accurately', async () => {
    const pdfBytes = await createSyntheticPDFWithFields();
    const fields = await inspectPDFForm(pdfBytes);

    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.fieldName)).toContain('Student_Name');
    expect(fields.map((f) => f.fieldName)).toContain('Is_Active');
    expect(fields.find((f) => f.fieldName === 'Student_Name')?.fieldType).toBe('text');
    expect(fields.find((f) => f.fieldName === 'Is_Active')?.fieldType).toBe('checkbox');
  });

  it('should fill native AcroForm fields deterministically', async () => {
    const pdfBytes = await createSyntheticPDFWithFields();
    const result = await fillAcroForm(pdfBytes, {
      Student_Name: 'Alex Nogueira',
      Is_Active: true,
    });

    expect(result.filledFieldCount).toBe(2);
    expect(result.matchedFields).toContain('Student_Name');
    expect(result.matchedFields).toContain('Is_Active');

    // Verify injected values by re-inspecting with pdf-lib
    const loadedDoc = await PDFDocument.load(result.pdfBytes);
    const form = loadedDoc.getForm();
    expect(form.getTextField('Student_Name').getText()).toBe('Alex Nogueira');
    expect(form.getCheckBox('Is_Active').isChecked()).toBe(true);
  });

  it('should inject 4-Up assignment slips across 4 quadrants', async () => {
    const s89Template = await createSyntheticS89Template();

    const assignments: S89Assignment[] = [
      {
        studentName: 'Alex Nogueira',
        date: '2026-10-14',
        partTitle: 'Apresentação Inicial',
      },
      {
        studentName: 'Bianca Moreira',
        date: '2026-10-14',
        partTitle: 'Oficina Prática',
      },
      {
        studentName: 'Caio Cavalcanti',
        date: '2026-10-14',
        partTitle: 'Painel Temático',
      },
      {
        studentName: 'Daniela Peixoto',
        date: '2026-10-14',
        partTitle: 'Conclusão de Módulo',
      },
    ];

    const result = await fillS89Assignments4Up(s89Template, assignments);

    expect(result.filledFieldCount).toBe(12); // 4 quadrants x 3 fields (student, date, part)
    expect(result.matchedFields).toContain('900_1_Text_SanSerif');
    expect(result.matchedFields).toContain('900_4_Text_SanSerif_Part');

    // Verify quadrant 1 and 4 contents
    const loadedDoc = await PDFDocument.load(result.pdfBytes);
    const form = loadedDoc.getForm();
    expect(form.getTextField('900_1_Text_SanSerif').getText()).toBe('Alex Nogueira');
    expect(form.getTextField('900_2_Text_SanSerif').getText()).toBe('Bianca Moreira');
    expect(form.getTextField('900_4_Text_SanSerif_Part').getText()).toBe('Conclusão de Módulo');
  });
});
