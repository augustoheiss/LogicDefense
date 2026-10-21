/**
 * Sekundo — Agnostic Structural Schedule Parser
 *
 * Parses raw text extracted from tabular/sectioned schedule documents (PDF OCR,
 * copied text, or structured notes) into a canonical Sekundo `FlatSkeletonEntry[]`
 * AST without embedding religious or domain-specific assumptions.
 *
 * Recognizes universal structural patterns:
 * 1. Session Date + Theme headers (e.g., "9 de outubro de 2026 | MÓDULO 40, 41")
 * 2. Session-level cues & roles (Chairperson/Presidente, Opening/Closing cues & roles)
 * 3. Thematic section banners (uppercase headers) mapped to data-driven accent colors
 * 4. Numbered timed slots ("1. Title (10 mins.)") with single or paired ("A / B") assignees
 *
 * Skills: agency-universal-document-compiler, agency-pdf-engine-architect
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import type { ParticipantProfile } from '../roster/participantDirectory';
import { enrichRegistryWithDirectory } from '../roster/participantDirectory';

export interface ScheduleParseOptions {
  unitName?: string;
  directory?: ParticipantProfile[];
  sectionColorPalette?: string[];
}

const DEFAULT_SECTION_PALETTE = [
  '#3D5B65', // Slate Teal (Block 1 default)
  '#9A7420', // Warm Ochre Gold (Block 2 default)
  '#80241E', // Deep Burgundy (Block 3 default)
  '#1E40AF', // Royal Blue (Block 4 fallback)
];

const PT_ES_MONTHS: Record<string, string> = {
  janeiro: '01', enero: '01',
  fevereiro: '02', febrero: '02',
  marco: '03', março: '03', marzo: '03',
  abril: '04',
  maio: '05', mayo: '05',
  junho: '06', junio: '06',
  julho: '07', julio: '07',
  agosto: '08',
  setembro: '09', septiembre: '09',
  outubro: '10', octubre: '10',
  novembro: '11', noviembre: '11',
  dezembro: '12', diciembre: '12',
};

/**
 * Parses a localized date string like "9 de outubro de 2026" into ISO "2026-10-09".
 */
export function parseLocalizedDateToISO(dateLabel: string): string | undefined {
  const m = dateLabel.match(/(\d{1,2})\s+de\s+([a-zA-Zçãõáéíóú]+)\s+de\s+(\d{4})/i);
  if (!m) return undefined;
  const day = m[1].padStart(2, '0');
  const monthKey = m[2].toLowerCase();
  const month = PT_ES_MONTHS[monthKey] || '01';
  const year = m[3];
  return `${year}-${month}-${day}`;
}

/**
 * Splits a raw assignee string ("Participante 01 / Participante 02")
 * into primary (`assignedTo`) and optional partner (`assistantTo`).
 */
export function splitPairedAssignees(rawAssignee: string): {
  assignedTo: string;
  assistantTo?: string;
} {
  const clean = (rawAssignee || '').trim();
  if (!clean.includes('/')) {
    return { assignedTo: clean };
  }
  const [first, ...rest] = clean.split('/').map((s) => s.trim()).filter(Boolean);
  return {
    assignedTo: first || '',
    assistantTo: rest.length > 0 ? rest.join(' / ') : undefined,
  };
}

/**
 * Parses raw schedule text into an agnostic FlatSkeletonEntry[] hierarchy:
 * - Depth 1 (`01`, `02`, ...): Session / Week Header
 * - Depth 2 (`01-01`, `01-02`, ...): Thematic Section Header
 * - Depth 3 (`01-01-01`, ...): Individual or Paired Program Slot
 */
export function parseProgramScheduleText(
  rawText: string,
  options: ScheduleParseOptions = {}
): FlatSkeletonEntry[] {
  const palette = options.sectionColorPalette || DEFAULT_SECTION_PALETTE;
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, ' ').trim())
    .filter((l) => l.length > 0);

  const entries: FlatSkeletonEntry[] = [];
  let detectedUnitName = options.unitName || '';

  let sessionIndex = 0;
  let sectionIndex = 0;
  let slotIndex = 0;
  let currentSessionEntry: FlatSkeletonEntry | null = null;

  const pad2 = (n: number) => String(n).padStart(2, '0');

  // Regex for session header: e.g. "9 de outubro de 2026 | MÓDULO 01"
  const sessionHeaderRegex = /^(\d{1,2}\s+de\s+[a-zA-Zçãõáéíóú]+\s+de\s+\d{4})\s*\|\s*(.+)$/i;
  // Regex for timed part: e.g. "1. Análise de Cenário (10 mins.) Participante 01"
  const numberedPartRegex = /^(\d+)\.\s+(.+?)\s*\((\d+)\s*mins?\.?\)\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip timestamps like "14/10/2026, 18:31:56"
    if (/^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}/.test(line)) continue;

    // Detect unit header line if present
    if (!detectedUnitName && line.includes(' - ') && /reuni[aã]o/i.test(line)) {
      detectedUnitName = line.replace(/reuni[aã]o.*$/i, '').trim();
      continue;
    }

    // 1. Check Session Header (note: sometimes theme wraps onto next line if short)
    const sessionMatch = line.match(sessionHeaderRegex);
    if (sessionMatch) {
      sessionIndex++;
      sectionIndex = 0;
      slotIndex = 0;

      const rawDateLabel = sessionMatch[1].trim();
      let restAfterPipe = sessionMatch[2].trim();
      let chairPerson = '';

      // Extract "Presidente <Name>" if on the same line
      const presMatch = restAfterPipe.match(/^(.*?)\s+Presidente\s+(.+)$/i);
      if (presMatch) {
        restAfterPipe = presMatch[1].trim();
        chairPerson = presMatch[2].trim();
      } else if (i + 1 < lines.length && /^[\d,\s-]+$/.test(lines[i + 1])) {
        // Multi-line range
        restAfterPipe = `${restAfterPipe} ${lines[i + 1].trim()}`;
        i++;
        if (i + 1 < lines.length && /^Presidente\s+/i.test(lines[i + 1])) {
          chairPerson = lines[i + 1].replace(/^Presidente\s+/i, '').trim();
          i++;
        }
      }

      const sessionKey = pad2(sessionIndex);
      const isoDate = parseLocalizedDateToISO(rawDateLabel);

      const sessionEntry: FlatSkeletonEntry = {
        key: sessionKey,
        type: 'header',
        label: `${rawDateLabel} | ${restAfterPipe}`,
        value: chairPerson,
        email: '',
        meta: {
          sessionDate: isoDate || rawDateLabel,
          sessionTheme: restAfterPipe,
          unitName: detectedUnitName || undefined,
          chairPerson: chairPerson || undefined,
        },
      };
      currentSessionEntry = sessionEntry;
      entries.push(sessionEntry);
      continue;
    }

    if (!currentSessionEntry) continue;
    const sessionMeta = currentSessionEntry.meta as Record<string, any>;

    // Check standalone "Presidente <Name>"
    if (/^Presidente\s+/i.test(line)) {
      const chair = line.replace(/^Presidente\s+/i, '').trim();
      sessionMeta.chairPerson = chair;
      currentSessionEntry.value = chair;
      continue;
    }

    // Check Opening/Closing Cue + Role line (supports agnostic "Vinheta" / "Intervalo Técnico")
    if (/^(?:Vinheta|Intervalo\s+T[eé]cnico|Tema\s+Musical)\s+\d+/i.test(line)) {
      const pipeSplit = line.match(
        /^((?:Vinheta|Intervalo\s+T[eé]cnico|Tema\s+Musical)\s+\d+[^|]*?)\|\s*(?:Credenciamento|S[ií]ntese\s+Final|Abertura|Encerramento)\s*[:|-]?\s*(.+)$/i
      );
      if (pipeSplit) {
        const cueText = pipeSplit[1].trim();
        const rolePerson = pipeSplit[2].trim();
        if (sectionIndex === 0) {
          sessionMeta.openingCue = cueText;
          sessionMeta.openingPrayer = rolePerson;
        } else {
          sessionMeta.closingCue = cueText;
          sessionMeta.closingPrayer = rolePerson;
        }
      } else {
        // Middle transition cue (inside section 3)
        sessionMeta.middleCue = line.trim();
      }
      continue;
    }

    // Check Uppercase Section Headers
    if (
      line === line.toUpperCase() &&
      line.length >= 8 &&
      !/^\d+\./.test(line) &&
      !line.startsWith('COMENT')
    ) {
      sectionIndex++;
      slotIndex = 0;
      const sectionKey = `${currentSessionEntry.key}-${pad2(sectionIndex)}`;
      const accentColor = palette[(sectionIndex - 1) % palette.length];
      entries.push({
        key: sectionKey,
        type: 'header',
        label: line,
        value: '',
        email: '',
        meta: {
          accentColor,
          sectionIndex,
        },
      });
      continue;
    }

    // Check Numbered Timed Part (handles 1-line or 2-line wrapped mins.)
    let effectiveLine = line;
    if (/^\d+\.\s+/.test(line) && !/\(\d+\s*mins?\.?\)/i.test(line) && i + 1 < lines.length) {
      effectiveLine = `${line} ${lines[i + 1]}`;
      i++;
    }

    const partMatch = effectiveLine.match(numberedPartRegex);
    if (partMatch) {
      if (sectionIndex === 0) {
        sectionIndex = 1;
        entries.push({
          key: `${currentSessionEntry.key}-01`,
          type: 'header',
          label: 'SEÇÃO PRINCIPAL',
          value: '',
          email: '',
          meta: { accentColor: palette[0], sectionIndex: 1 },
        });
      }

      slotIndex++;
      const partNum = parseInt(partMatch[1], 10);
      const partTitle = partMatch[2].trim();
      const durationMinutes = parseInt(partMatch[3], 10);
      let rawAssignee = partMatch[4].trim();

      if (
        !rawAssignee &&
        i + 1 < lines.length &&
        !/^\d+\./.test(lines[i + 1]) &&
        !/^(?:Vinheta|Intervalo)/i.test(lines[i + 1])
      ) {
        rawAssignee = lines[i + 1].trim();
        i++;
      }

      const { assignedTo, assistantTo } = splitPairedAssignees(rawAssignee);
      const slotKey = `${currentSessionEntry.key}-${pad2(sectionIndex)}-${pad2(slotIndex)}`;

      entries.push({
        key: slotKey,
        type: 'slot',
        label: `${partNum}. ${partTitle}`,
        value: assignedTo,
        email: '',
        meta: {
          partNumber: partNum,
          assignedTo,
          assistantTo,
          durationMinutes,
          plannedDurationSec: durationMinutes * 60,
          room: 'Auditório Principal',
          confirmed: false,
          readinessState: 'pending',
          sessionDate: sessionMeta.sessionDate,
          sessionTheme: sessionMeta.sessionTheme,
        },
      });
    }
  }

  if (options.directory && options.directory.length > 0) {
    return enrichRegistryWithDirectory(entries, options.directory);
  }

  return entries;
}
