/**
 * Sekundo — Agnostic Multi-Mode WhatsApp Message & Calendar (.ics) Exporter Engine
 *
 * Transforms any hierarchical program schedule (`FlatSkeletonEntry[]`) and
 * territory assignment registry into clean, motivating, street-ready messages
 * formatted natively for WhatsApp (`*bold*`, `_italic_`, visual dividers) and
 * RFC 5545 `.ics` mobile calendar reminders.
 *
 * Supports 5 specialized WhatsApp modes:
 * 1. `full_week`            — Complete weekly board organized by thematic blocks
 * 2. `group_filter`         — Filtered digest for a specific operational group (e.g. "Grupo 1")
 * 3. `individual_card`      — Personal 1-tap commitment card (Digital S-89)
 * 4. `live_pocket`          — Compact "Tonight / Live" rundown with calculated clock times
 * 5. `territory_assignment` — Tactical territory assignment card with publisher link
 *
 * Skills: agency-universal-document-compiler, agency-behavioral-nudge-engine
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import { normalizePersonKey, type ParticipantProfile, findParticipantProfile } from '../roster/participantDirectory';

export type WhatsAppExportMode =
  | 'full_week'
  | 'group_filter'
  | 'individual_card'
  | 'live_pocket'
  | 'territory_assignment';

export interface StructuredSessionSection {
  key: string;
  label: string;
  accentColor?: string;
  slots: FlatSkeletonEntry[];
}

export interface StructuredProgramSession {
  key: string;
  label: string;
  sessionDate?: string;
  sessionTheme?: string;
  unitName?: string;
  chairPerson?: string;
  openingCue?: string;
  openingPrayer?: string;
  middleCue?: string;
  closingCue?: string;
  closingPrayer?: string;
  sections: StructuredSessionSection[];
}

/**
 * Groups a flat registry into structured sessions -> sections -> slots for
 * deterministic rendering in the UI and WhatsApp exporter.
 */
export function extractStructuredSessions(
  flatRegistry: FlatSkeletonEntry[]
): StructuredProgramSession[] {
  const sessionsMap = new Map<string, StructuredProgramSession>();
  const sectionsMap = new Map<string, StructuredSessionSection>();

  for (const entry of flatRegistry) {
    const parts = entry.key.split('-');
    const meta = (entry.meta || {}) as Record<string, any>;

    if (parts.length === 1 && entry.type === 'header') {
      const session: StructuredProgramSession = {
        key: entry.key,
        label: entry.label,
        sessionDate: meta.sessionDate,
        sessionTheme: meta.sessionTheme,
        unitName: meta.unitName,
        chairPerson: meta.chairPerson || entry.value || undefined,
        openingCue: meta.openingCue,
        openingPrayer: meta.openingPrayer,
        middleCue: meta.middleCue,
        closingCue: meta.closingCue,
        closingPrayer: meta.closingPrayer,
        sections: [],
      };
      sessionsMap.set(entry.key, session);
    } else if (parts.length === 2 && entry.type === 'header') {
      const sessionKey = parts[0];
      const parent = sessionsMap.get(sessionKey);
      const section: StructuredSessionSection = {
        key: entry.key,
        label: entry.label,
        accentColor: meta.accentColor,
        slots: [],
      };
      sectionsMap.set(entry.key, section);
      if (parent) parent.sections.push(section);
    } else if (parts.length >= 3 && entry.type === 'slot') {
      const sectionKey = `${parts[0]}-${parts[1]}`;
      const section = sectionsMap.get(sectionKey);
      if (section) {
        section.slots.push(entry);
      }
    }
  }

  return Array.from(sessionsMap.values());
}

function getSectionEmoji(index: number, accentColor?: string): string {
  const color = (accentColor || '').toUpperCase();
  if (color === '#3D5B65') return '🟦';
  if (color === '#9A7420') return '🟨';
  if (color === '#80241E') return '🟥';
  const fallback = ['🟦', '🟨', '🟥', '🟩'];
  return fallback[index % fallback.length];
}

function getReadinessBadge(state?: string, confirmed?: boolean): string {
  if (state === 'ready' || confirmed === true) return ' ✅';
  if (state === 'preparing') return ' 📖';
  return '';
}

/**
 * Mode 1: Formats a complete weekly session for the main WhatsApp group board.
 */
export function formatWeeklyScheduleWhatsApp(session: StructuredProgramSession): string {
  const lines: string[] = [];
  const headerParts = session.label.split('|').map((s) => s.trim());
  const dateTitle = headerParts[0] || session.label;
  const themeTitle = session.sessionTheme || headerParts[1] || '';

  lines.push(`📅 *PROGRAMAÇÃO DA SEMANA — ${dateTitle.toUpperCase()}*`);
  if (themeTitle) lines.push(`📖 *Tema:* ${themeTitle}`);
  if (session.unitName) lines.push(`🏛️ *Unidade:* ${session.unitName}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');

  if (session.chairPerson) lines.push(`👤 *Presidente:* ${session.chairPerson}`);
  if (session.openingCue) lines.push(`🎵 *${session.openingCue}*`);
  if (session.openingPrayer) lines.push(`🙏 *Oração Inicial:* ${session.openingPrayer}`);

  session.sections.forEach((sec, idx) => {
    lines.push('');
    const badge = getSectionEmoji(idx, sec.accentColor);
    lines.push(`${badge} *${sec.label.toUpperCase()}*`);

    if (idx === 2 && session.middleCue) {
      lines.push(`🎵 _${session.middleCue}_`);
    }

    for (const slot of sec.slots) {
      const meta = (slot.meta || {}) as Record<string, any>;
      const dur = meta.durationMinutes ? ` (${meta.durationMinutes} min)` : '';
      const primary = meta.assignedTo || slot.value || 'A definir';
      const assistant = meta.assistantTo ? `  🤝 _${meta.assistantTo}_` : '';
      const ready = getReadinessBadge(meta.readinessState, meta.confirmed);

      lines.push(`• *${slot.label}*${dur}${ready}`);
      lines.push(`  └ 👤 ${primary}${assistant}`);
    }
  });

  if (session.closingCue || session.closingPrayer) {
    lines.push('');
    if (session.closingCue) lines.push(`🎵 *${session.closingCue}*`);
    if (session.closingPrayer) lines.push(`🙏 *Oração Final:* ${session.closingPrayer}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('⚡ _Organizado via Sekundo — Confirme seu preparo no app!_');

  return lines.join('\n');
}

/**
 * Mode 2: Formats a filtered WhatsApp digest for a specific operational group
 * (e.g. "Grupo 1", "Grupo 2", "Grupo 3"), highlighting only members of that group
 * and any territories currently held by that group.
 */
export function formatGroupFilterWhatsApp(
  session: StructuredProgramSession,
  groupTag: string,
  directory: ParticipantProfile[] = [],
  territoryEntries: FlatSkeletonEntry[] = []
): string {
  const lines: string[] = [];
  const headerParts = session.label.split('|').map((s) => s.trim());
  const dateTitle = headerParts[0] || session.label;

  lines.push(`👥 *DESTAQUES DO ${groupTag.toUpperCase()} — ${dateTitle.toUpperCase()}*`);
  if (session.sessionTheme) lines.push(`📖 *Leitura:* ${session.sessionTheme}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');

  const isInGroup = (personName?: string, explicitGroup?: string): boolean => {
    if (!personName) return false;
    if (explicitGroup && explicitGroup.toLowerCase() === groupTag.toLowerCase()) return true;
    const prof = findParticipantProfile(personName, directory);
    return Boolean(prof && prof.groupTag.toLowerCase() === groupTag.toLowerCase());
  };

  let matchCount = 0;

  // Check session-level roles
  if (isInGroup(session.chairPerson)) {
    matchCount++;
    lines.push(`🎙️ *Presidente da Reunião:* ${session.chairPerson}`);
  }
  if (isInGroup(session.openingPrayer)) {
    matchCount++;
    lines.push(`🙏 *Oração Inicial:* ${session.openingPrayer}`);
  }

  for (const sec of session.sections) {
    for (const slot of sec.slots) {
      const meta = (slot.meta || {}) as Record<string, any>;
      const primary = meta.assignedTo || slot.value || '';
      const assistant = meta.assistantTo || '';
      const primaryMatch = isInGroup(primary, meta.groupTag);
      const assistantMatch = isInGroup(assistant, meta.assistantGroupTag);

      if (primaryMatch || assistantMatch) {
        matchCount++;
        const dur = meta.durationMinutes ? ` (${meta.durationMinutes} min)` : '';
        lines.push(`✅ *${slot.label}*${dur}`);
        if (primaryMatch && assistantMatch) {
          lines.push(`   👤 *${primary}* & 🤝 *${assistant}*`);
        } else if (primaryMatch) {
          const partnerNote = assistant ? ` (Com: ${assistant})` : '';
          lines.push(`   👤 *${primary}* — Titular${partnerNote}`);
        } else {
          lines.push(`   🤝 *${assistant}* — Ajudante (Titular: ${primary})`);
        }
      }
    }
  }

  if (isInGroup(session.closingPrayer)) {
    matchCount++;
    lines.push(`🙏 *Oração Final:* ${session.closingPrayer}`);
  }

  if (matchCount === 0) {
    lines.push(`ℹ️ _Nenhuma parte listada para membros do ${groupTag} nesta semana._`);
  }

  // Check active territories held by members of this group
  const activeGroupTerritories: { code: string; locality: string; holder: string; since: string }[] = [];
  for (const t of territoryEntries) {
    const tMeta = (t.meta || {}) as Record<string, any>;
    const history = (tMeta.assignmentHistory || []) as Array<{
      assignedTo: string;
      assignedAt: string;
      completedAt?: string;
    }>;
    // Active = last cycle without completedAt, or workerName with worked === 0
    const openCycle = history.find((c) => c.assignedTo && !c.completedAt);
    const holder = openCycle?.assignedTo || (tMeta.worked === 0 ? tMeta.workerName : undefined);
    if (holder && isInGroup(holder)) {
      activeGroupTerritories.push({
        code: tMeta.territoryNumber || t.key,
        locality: tMeta.locality || t.label,
        holder,
        since: openCycle?.assignedAt || tMeta.assignedAt || '-',
      });
    }
  }

  if (activeGroupTerritories.length > 0) {
    lines.push('');
    lines.push(`🗺️ *Territórios em Campo (${groupTag}):*`);
    for (const gt of activeGroupTerritories) {
      lines.push(`• *${gt.code}* (${gt.locality}) — 👤 ${gt.holder} _[desde ${gt.since}]_`);
    }
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`💪 _Bom preparo a todos do ${groupTag}!_`);

  return lines.join('\n');
}

/**
 * Mode 3: Formats a personalized 1-tap commitment card (Digital S-89 equivalent)
 * for an individual participant.
 */
export function formatIndividualCommitmentWhatsApp(
  slot: FlatSkeletonEntry,
  session?: StructuredProgramSession,
  targetRole: 'primary' | 'assistant' = 'primary'
): string {
  const meta = (slot.meta || {}) as Record<string, any>;
  const primary = meta.assignedTo || slot.value || 'Participante';
  const assistant = meta.assistantTo || '';
  const recipient = targetRole === 'assistant' && assistant ? assistant : primary;
  const partner = targetRole === 'assistant' ? primary : assistant;
  const dateStr =
    session?.label.split('|')[0]?.trim() ||
    meta.sessionDate ||
    'Próxima Reunião';
  const dur = meta.durationMinutes ? `${meta.durationMinutes} mins.` : 'Conforme programação';
  const room = meta.room || 'Salão Principal';

  const lines = [
    '🎯 *LEMBRETE DE COMPROMISSO — SEKUNDO*',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `Olá, *${recipient}*! 👋`,
    '',
    `Aqui está o resumo da sua designação para a semana de *${dateStr}*:`,
    '',
    `📌 *Parte:* ${slot.label}`,
    `⏱️ *Tempo:* ${dur}`,
  ];

  if (partner) {
    lines.push(`🤝 *Parceiro(a):* ${partner}`);
  }
  lines.push(`🏛️ *Local:* ${room}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
  if (partner) {
    lines.push(`💡 _Dica: Que tal mandar uma mensagem para ${partner} hoje para combinarem o cenário?_`);
  } else {
    lines.push('✨ _Bom preparo! Você pode usar o cronômetro de ensaio no app Sekundo._');
  }

  return lines.join('\n');
}

/**
 * Formats a friendly 1-tap peer-to-peer message for an assignee to align with their partner ("Combinar com Meu Par").
 */
export function formatPartnerSyncWhatsAppMessage(
  slot: FlatSkeletonEntry,
  sessionDateLabel: string,
  senderName?: string
): string {
  const meta = (slot.meta || {}) as Record<string, any>;
  const primary = meta.assignedTo || slot.value || '';
  const assistant = meta.assistantTo || '';
  const normSender = normalizePersonKey(senderName);
  const isSenderAssistant =
    normSender && normalizePersonKey(assistant).includes(normSender);

  const partnerName = isSenderAssistant ? primary : assistant || primary;
  const dur = meta.durationMinutes ? ` (${meta.durationMinutes} min)` : '';

  return [
    `Olá, *${partnerName}*! Tudo bem? 👋`,
    '',
    `Temos juntos a designação *${slot.label}*${dur} na semana de *${sessionDateLabel}*.`,
    'Como você prefere que a gente combine o nosso cenário e faça um ensaio rápido no tempo? 🤝⏱️',
  ].join('\n');
}

/**
 * Mode 4: Formats a compact "Hoje / Ao Vivo" timeline with estimated clock times
 * calculated from `startTimeHHMM` (default "19:30").
 */
export function formatLivePocketScheduleWhatsApp(
  session: StructuredProgramSession,
  startTimeHHMM = '19:30'
): string {
  const [startH, startM] = startTimeHHMM.split(':').map((n) => parseInt(n, 10) || 0);
  let cursorMinutes = startH * 60 + startM;

  const fmtTime = (mins: number) => {
    const h = Math.floor((mins / 60) % 24);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const lines: string[] = [
    `⏱️ *CRONOGRAMA AO VIVO — ${session.label.split('|')[0]?.trim()}*`,
    `🚀 *Início:* ${fmtTime(cursorMinutes)}  |  👤 *Pres.:* ${session.chairPerson || '-'}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  // Opening song + prayer + opening comments (~6 min)
  lines.push(`\`${fmtTime(cursorMinutes)}\` 🎵 ${session.openingCue || 'Abertura'} + 🙏 ${session.openingPrayer || '-'}`);
  cursorMinutes += 6;

  session.sections.forEach((sec, idx) => {
    if (idx === 2 && session.middleCue) {
      lines.push(`\`${fmtTime(cursorMinutes)}\` 🎵 _${session.middleCue}_`);
      cursorMinutes += 4;
    }
    for (const slot of sec.slots) {
      const meta = (slot.meta || {}) as Record<string, any>;
      const dur = Number(meta.durationMinutes) || 5;
      const primary = meta.assignedTo || slot.value || '-';
      const assistant = meta.assistantTo ? ` / ${meta.assistantTo}` : '';
      lines.push(`\`${fmtTime(cursorMinutes)}\` *${slot.label}* (${dur}m) — ${primary}${assistant}`);
      cursorMinutes += dur + 1; // +1 min transition/counsel buffer
    }
  });

  lines.push(`\`${fmtTime(cursorMinutes)}\` 🎵 ${session.closingCue || 'Encerramento'} + 🙏 ${session.closingPrayer || '-'}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}

/**
 * Mode 5: Formats a Territory Assignment Card for WhatsApp dispatch.
 */
export function formatTerritoryAssignmentWhatsApp(territoryEntry: FlatSkeletonEntry): string {
  const meta = (territoryEntry.meta || {}) as Record<string, any>;
  const code = meta.territoryNumber || territoryEntry.key;
  const locality = meta.locality || territoryEntry.label;
  const history = (meta.assignmentHistory || []) as Array<{
    assignedTo: string;
    assignedAt: string;
    completedAt?: string;
  }>;
  const latest = history[history.length - 1];
  const holder = latest?.assignedTo || meta.workerName || territoryEntry.value || 'A designar';
  const assignedDate = latest?.assignedAt || meta.assignedAt || '-';
  const status = latest && !latest.completedAt ? '🟢 Em campo' : '✅ Concluído';

  return [
    `🗺️ *DESIGNAÇÃO DE TERRITÓRIO — ${code}*`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `📍 *Localidade:* ${locality}`,
    `👤 *Designado para:* ${holder}`,
    `📅 *Data da designação:* ${assignedDate}`,
    `📊 *Status atual:* ${status}`,
    meta.lastCompletedBeforeYear ? `🕒 *Última conclusão prévia:* ${meta.lastCompletedBeforeYear}` : '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '📱 _Abra o Modo Publicador no Sekundo para marcar as quadras com 1 toque!_',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Builds a safe `https://wa.me/` URL for instant WhatsApp sharing.
 */
export function buildWhatsAppUrl(message: string, phone?: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

/**
 * Generates an RFC 5545 `.ics` calendar file payload with T-48h preparation reminder
 * and T-2h event reminder so participants never forget their commitment.
 */
export function generateCommitmentICS(
  slot: FlatSkeletonEntry,
  session?: StructuredProgramSession
): string {
  const meta = (slot.meta || {}) as Record<string, any>;
  const isoDate = (session?.sessionDate || meta.sessionDate || '2026-10-09').replace(/-/g, '');
  const primary = meta.assignedTo || slot.value || 'Participante';
  const assistant = meta.assistantTo ? ` (Par: ${meta.assistantTo})` : '';
  const durMin = Number(meta.durationMinutes) || 10;

  const dtStart = `${isoDate}T193000`;
  const dtEnd = `${isoDate}T211500`;
  const summary = `Compromisso Sekundo: ${slot.label} (${durMin} min)`;
  const description = `Titular: ${primary}${assistant}\\nUnidade: ${session?.unitName || 'Sekundo'}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sekundo//Agnostic Temporal Engine//PT',
    'BEGIN:VEVENT',
    `UID:sekundo-${slot.key}-${isoDate}@sekundo.local`,
    `DTSTAMP:${isoDate}T120000Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT48H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Preparar e ensaiar seu compromisso no Sekundo (faltam 2 dias)',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Compromisso hoje às 19:30',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
