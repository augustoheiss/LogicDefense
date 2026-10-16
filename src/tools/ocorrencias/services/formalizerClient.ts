/**
 * Ocorrências 2.0 — AI Pedagogical Formalizer & CSV Batch Service (`services/formalizerClient.ts`)
 *
 * Isolates `waitForServerAwake` from `cv-maker/services/CVPrintEngine.ts` and connects the
 * Web UI to `POST /api/ocorrencias/formalizar` (powered by `formalizer.py` + Gemini 2.0 Flash),
 * with a deterministic institutional pedagogical fallback when offline.
 */

export function resolveApiBaseUrl(): string {
  const envUrl =
    (import.meta as any).env?.VITE_API_URL !== undefined
      ? String((import.meta as any).env.VITE_API_URL).trim()
      : '';

  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (!envUrl || envUrl.includes('onrender.com'))
  ) {
    return 'http://localhost:8000';
  }

  return envUrl || 'http://localhost:8000';
}

export interface FormalizeResult {
  originalText: string;
  formalizedText: string;
  provider: 'gemini' | 'local-institutional';
  notice?: string;
}

/**
 * Wakes up the FastAPI backend (Render/Cloud cold-start resilient polling)
 * isolated from `cv-maker/services/CVPrintEngine.ts`.
 */
export async function waitForServerAwake(
  onStatus?: (msg: string) => void,
  maxWaitMs = 12000
): Promise<boolean> {
  const start = Date.now();
  let attempt = 0;
  const baseUrl = resolveApiBaseUrl();

  while (Date.now() - start < maxWaitMs) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return true;
    } catch {
      if (attempt === 1 && onStatus) {
        onStatus('Conectando ao motor pedagógico de IA...');
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return false;
}

/**
 * Deterministic institutional pedagogical formalizer fallback used when the backend
 * server is unreachable or `GEMINI_API_KEY` is not configured in local dev.
 */
export function formalizePedagogicalOffline(
  informalText: string,
  context: 'descricao' | 'compromissos' = 'descricao',
  studentName?: string
): string {
  const raw = informalText.trim();
  if (!raw) return '';

  const subject = studentName?.trim()
    ? `o(a) estudante ${studentName.trim()}`
    : 'o(a) estudante';

  // Dictionary of common informal school terms -> formal institutional terms
  const replacements: Array<[RegExp, string]> = [
    [/\brecreio\b/gi, 'intervalo recreativo'],
    [/\bbagunç(?:ou|ando|a)\b/gi, 'apresentou conduta incompatível com as normas de convivência escolar'],
    [/\bxingou\b/gi, 'proferiu expressões verbais inadequadas direcionadas a'],
    [/\bbrigou\b/gi, 'envolveu-se em conflito interpessoal'],
    [/\bbateu\b/gi, 'desferiu agressão física'],
    [/\bmexendo no celular\b/gi, 'utilizando dispositivo móvel durante a explicação curricular'],
    [/\bcelular\b/gi, 'aparelho eletrônico portátil (celular) sem autorização pedagógica'],
    [/\bnão quis fazer\b/gi, 'recusou-se a realizar as atividades pedagógicas propostas'],
    [/\brespondeu mal\b/gi, 'manifestou postura desrespeitosa diante das orientações docentes'],
    [/\bsaiu da sala\b/gi, 'ausentou-se do ambiente de sala de aula sem anuência prévia'],
    [/\bmatou aula\b/gi, 'evadiu-se do período letivo regular'],
    [/\bconversando muito\b/gi, 'manteve conversas paralelas persistentes que comprometeram o andamento da aula'],
    [/\batrasou\b/gi, 'compareceu com atraso injustificado ao início da atividade letiva'],
  ];

  let transformed = raw;
  for (const [regex, formal] of replacements) {
    transformed = transformed.replace(regex, formal);
  }

  // Ensure proper capitalization and trailing punctuation
  transformed = transformed.charAt(0).toLowerCase() + transformed.slice(1);
  if (!/[.!?]$/.test(transformed)) {
    transformed += '.';
  }

  if (context === 'compromissos') {
    return (
      `Em atendimento pedagógico realizado pela equipe escolar, ficou estabelecido que ${subject} ` +
      `comprometer-se-á com o cumprimento integral das normas regimentais de convivência, ` +
      `observando-se as seguintes tratativas: ${transformed}`
    );
  }

  return (
    `Registra-se, para os devidos fins de acompanhamento pedagógico, que durante as atividades escolares ` +
    `${subject} ${transformed} A equipe docente realizou intervenção imediata visando à recomposição ` +
    `do ambiente pedagógico e ao cumprimento do Regimento Escolar.`
  );
}

/**
 * Calls `POST /api/ocorrencias/formalizar` to rewrite informal incident notes into
 * technical pedagogical prose using Gemini 2.0 Flash, falling back cleanly to
 * deterministic institutional formalization if offline.
 */
export async function formalizeTextWithAI(
  informalText: string,
  context: 'descricao' | 'compromissos' = 'descricao',
  studentName?: string,
  onStatus?: (msg: string) => void
): Promise<FormalizeResult> {
  const clean = informalText.trim();
  if (!clean) {
    return {
      originalText: informalText,
      formalizedText: '',
      provider: 'local-institutional',
    };
  }

  const baseUrl = resolveApiBaseUrl();
  const requestBody = JSON.stringify({
    texto: clean,
    contexto:
      context === 'compromissos'
        ? 'compromissos firmados entre escola, aluno e responsaveis'
        : 'descricao da ocorrencia escolar',
    nome_aluno: studentName || '',
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      onStatus?.('Reescrevendo relato em linguagem técnica pedagógica...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${baseUrl}/api/ocorrencias/formalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.texto_formalizado === 'string' && data.texto_formalizado.trim()) {
          return {
            originalText: informalText,
            formalizedText: data.texto_formalizado.trim(),
            provider: data.provider === 'gemini' ? 'gemini' : 'local-institutional',
            notice: data.notice,
          };
        }
      }
      break;
    } catch {
      if (attempt === 0) {
        const woke = await waitForServerAwake(onStatus, 4500);
        if (!woke) break;
      }
    }
  }

  const fallback = formalizePedagogicalOffline(clean, context, studentName);
  return {
    originalText: informalText,
    formalizedText: fallback,
    provider: 'local-institutional',
    notice:
      'Formalização institucional local aplicada (servidor Gemini offline ou chave de API não configurada).',
  };
}

/**
 * Parses a CSV string (comma or semicolon separated, common in Brazilian Excel exports)
 * into an array of occurrence field records for Mail-Merge Batch PDF generation.
 */
export function parseCsvBatchRecords(
  csvText: string
): Array<Record<string, string | boolean | undefined>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const normalizedHeaders = rawHeaders.map(normalizeCsvHeaderToFieldId);

  const records: Array<Record<string, string | boolean | undefined>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    if (cells.every((c) => !c.trim())) continue;

    const record: Record<string, string | boolean | undefined> = {};
    for (let cIdx = 0; cIdx < normalizedHeaders.length; cIdx++) {
      const fieldId = normalizedHeaders[cIdx];
      const val = (cells[cIdx] ?? '').trim();
      if (!fieldId) continue;

      if (fieldId.startsWith('checkbox_')) {
        record[fieldId] = /^(sim|true|1|x|s|yes)$/i.test(val);
      } else {
        record[fieldId] = val;
      }
    }
    records.push(record);
  }

  return records;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

const CANONICAL_CSV_IDS = new Set([
  'nome_aluno',
  'turma',
  'data',
  'telefone',
  'descricao_ocorrencia',
  'checkbox_orientacao_aluno',
  'checkbox_convocar_responsavel',
  'compromissos_firmados',
  'responsavel_registro',
]);

function normalizeCsvHeaderToFieldId(header: string): string {
  const norm = header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (CANONICAL_CSV_IDS.has(norm)) return norm;

  // Evaluate specific action/checkbox headers BEFORE generic 'aluno' or 'ocorrencia' substrings
  if (norm.includes('orienta')) return 'checkbox_orientacao_aluno';
  if (norm.includes('convoc') || norm.includes('responsaveis')) return 'checkbox_convocar_responsavel';
  if (norm.includes('compromisso') || norm.includes('encaminhamento')) return 'compromissos_firmados';
  if (norm.includes('registro') || norm.includes('professor') || norm.includes('servidor'))
    return 'responsavel_registro';
  if (norm.includes('data')) return 'data';
  if (norm.includes('descri') || norm.includes('relato') || norm.includes('ocorrencia'))
    return 'descricao_ocorrencia';
  if (norm.includes('aluno') || norm.includes('estudante') || norm === 'nome') return 'nome_aluno';
  if (norm.includes('turma') || norm.includes('serie')) return 'turma';
  if (norm.includes('tel') || norm.includes('celular') || norm.includes('contato')) return 'telefone';
  return norm;
}

