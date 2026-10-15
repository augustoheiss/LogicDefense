/**
 * Sekundo — Unified Output Writers Registry (`outputs/registry.ts`)
 *
 * Implements Phase F5 (§1.6 & §3.4):
 * Unifies `pdf`, `whatsapp`, `csv`, and `yaml` as 4 `OutputWriter` implementations
 * over the exact same `WriterInput` (`FlatRegistry` + optional template/options).
 */

import type { OutputWriter, WriterInput } from '../doc/types';
import { compileSdocToPdf, S89_4UP_SDOC_YAML, S13S_MULTICYCLE_SDOC_YAML } from '../doc/templates/builtinTemplates';
import { autoGenerateSdocFromRegistry } from '../doc/schema';
import { exportGranularCSV, type GranularExportOptions } from '../csv/granularExport';
import { registryToYaml, type DataYamlExportOptions } from '../yaml/dataYaml';
import {
  extractStructuredSessions,
  formatWeeklyScheduleWhatsApp,
  formatGroupFilterWhatsApp,
  formatIndividualCommitmentWhatsApp,
  formatLivePocketScheduleWhatsApp,
  formatTerritoryAssignmentWhatsApp,
} from '../schedule/whatsappFormatter';
import { renderTemplateString } from '../doc/template';
import { evaluateRegistrySelector } from '../doc/selector';

/**
 * Renders a custom text/WhatsApp template (`{{#each}}` or line-per-slot) over a `FlatRegistry`
 * without removing or breaking the 5 existing WhatsApp formatting functions.
 */
export function renderWhatsAppTemplate(
  templateText: string,
  input: WriterInput
): string {
  const slots = evaluateRegistrySelector("slots(where: value != '')", input.registry);
  const headerCtx = {
    eventName: input.eventName || 'Programação Sekundo',
    totalSlots: slots.length,
    date: (slots[0]?.date as string) || new Date().toISOString().slice(0, 10),
  };

  // Support simple `{{#each slots}}...{{/each}}` block
  const eachRegex = /\{\{#each\s+[^}]+\}\}([\s\S]*?)\{\{\/each\}\}/g;
  if (eachRegex.test(templateText)) {
    const withLoops = templateText.replace(eachRegex, (_m, body: string) => {
      return slots
        .map((slotCtx) => renderTemplateString(body.trim(), { ...headerCtx, ...slotCtx }))
        .join('\n');
    });
    return renderTemplateString(withLoops, headerCtx);
  }

  return renderTemplateString(templateText, { ...headerCtx, ...(slots[0] || {}) });
}

export const pdfOutputWriter: OutputWriter<Uint8Array> = {
  kind: 'pdf',
  async write(input: WriterInput): Promise<Uint8Array> {
    let sdocYaml = input.sdocYaml;
    if (!sdocYaml) {
      const tplName = String(input.options?.template || '').toLowerCase();
      if (tplName.includes('s13')) {
        sdocYaml = S13S_MULTICYCLE_SDOC_YAML;
      } else if (tplName.includes('s89') || tplName.includes('4up')) {
        sdocYaml = S89_4UP_SDOC_YAML;
      } else {
        sdocYaml = autoGenerateSdocFromRegistry(input.registry, input.eventName);
      }
    }
    const { pdfBytes } = await compileSdocToPdf(sdocYaml, input.registry, {
      serviceYear: input.options?.serviceYear as string | undefined,
      blobs: input.options?.blobs as Record<string, Uint8Array> | undefined,
      stampPageNumbers: Boolean(input.options?.stampPageNumbers),
    });
    return pdfBytes;
  },
};

export const whatsappOutputWriter: OutputWriter<string> = {
  kind: 'whatsapp',
  async write(input: WriterInput): Promise<string> {
    const customTpl = input.options?.customTemplate as string | undefined;
    if (customTpl && customTpl.trim() !== '') {
      return renderWhatsAppTemplate(customTpl, input);
    }

    const mode = String(input.options?.template || input.options?.mode || 'quadro_semanal');
    const unitName = input.eventName || 'Unidade Operacional Demo — Sekundo';
    const sessions = extractStructuredSessions(input.registry);
    const activeSession = sessions[0] || {
      key: '01',
      label: unitName,
      unitName,
      sections: [
        {
          key: '01-01',
          label: 'Designações',
          slots: input.registry.filter((e) => e.type === 'slot'),
        },
      ],
    };

    if (mode === 'por_grupo' || mode === 'group_filter') {
      return formatGroupFilterWhatsApp(
        activeSession,
        String(input.options?.groupName || 'Grupo 1'),
        [],
        input.registry.filter((e) => e.type === 'territory')
      );
    }
    if (mode === 'meu_compromisso' || mode === 'individual_reminder') {
      const slot =
        input.registry.find((e) => e.value && e.value.trim() !== '') ||
        input.registry[0] || {
          key: '01-01-01',
          type: 'slot',
          label: 'Designação',
          value: String(input.options?.personName || 'Participante'),
          email: '',
          meta: {},
        };
      return formatIndividualCommitmentWhatsApp(slot, activeSession);
    }
    if (mode === 'bolso' || mode === 'live_pocket') {
      return formatLivePocketScheduleWhatsApp(activeSession, '19:30');
    }
    if (mode === 'territorios' || mode === 'territory_dispatch') {
      const terr =
        input.registry.find((e) => e.type === 'territory') ||
        input.registry[0] || {
          key: '01',
          type: 'territory',
          label: 'Território',
          value: '',
          email: '',
          meta: {},
        };
      return formatTerritoryAssignmentWhatsApp(terr);
    }

    return formatWeeklyScheduleWhatsApp(activeSession);
  },
};

export const csvOutputWriter: OutputWriter<string> = {
  kind: 'csv',
  async write(input: WriterInput): Promise<string> {
    const opts: GranularExportOptions = {
      format: (input.options?.format as 'canonical' | 'clean_human') || 'clean_human',
      scope: (input.options?.scope as GranularExportOptions['scope']) || 'all',
      branchPrefix: input.options?.branchPrefix as string | undefined,
      delimiter: (input.options?.delimiter as ',' | ';') || ';',
    };
    return exportGranularCSV(input.registry, opts);
  },
};

export const yamlOutputWriter: OutputWriter<string> = {
  kind: 'yaml',
  async write(input: WriterInput): Promise<string> {
    const opts: DataYamlExportOptions = {
      yamlFormat: (input.options?.yamlFormat as 'tree' | 'flat') || 'tree',
      scope: (input.options?.scope as DataYamlExportOptions['scope']) || 'all',
      branchPrefix: input.options?.branchPrefix as string | undefined,
      eventName: input.eventName,
    };
    return registryToYaml(input.registry, opts);
  },
};

export const OUTPUT_WRITERS = {
  pdf: pdfOutputWriter,
  whatsapp: whatsappOutputWriter,
  csv: csvOutputWriter,
  yaml: yamlOutputWriter,
} as const;

export async function writeUnifiedOutput(
  kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml',
  input: WriterInput
): Promise<Uint8Array | string> {
  const writer = OUTPUT_WRITERS[kind];
  if (!writer) {
    throw new Error(`OutputWriter desconhecido: ${kind}`);
  }
  return await writer.write(input);
}
