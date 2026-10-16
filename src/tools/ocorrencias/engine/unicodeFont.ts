/**
 * Ocorrências 2.0 PDF Engine — Hybrid Unicode & WinAnsi Sanitizer (`engine/unicodeFont.ts`)
 *
 * Isolated from `@sekundo/core/pdf/unicodeFont.ts`.
 * Ensures `pdf-lib` (`StandardFonts.Helvetica`) never throws `WinAnsi cannot encode`
 * when teachers paste WhatsApp messages with emojis, smart quotes, or non-Latin glyphs.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'Yo', Ж: 'Zh', З: 'Z', И: 'I', Й: 'Y',
  К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F',
  Х: 'Kh', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Shch', Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  І: 'I', і: 'i', Ї: 'Yi', ї: 'yi', Є: 'Ye', є: 'ye', Ґ: 'G', ґ: 'g',
};

/**
 * Normalizes curly quotes, en/em-dashes, ellipsis, and non-breaking spaces to
 * standard WinAnsi / ASCII equivalents while preserving line breaks.
 */
export function normalizeWinAnsiTypography(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u00B7]/g, '-')
    .replace(/[✓✔☑]/g, 'X')
    .replace(/[⬜□☐]/g, ' ')
    .replace(/\u00A0/g, ' ');
}

export interface WinAnsiSanitizeResult {
  text: string;
  warnings: string[];
  hadEmoji: boolean;
  hadNonWinAnsi: boolean;
}

/**
 * Sanitizes arbitrary Unicode text for safe rendering with standard WinAnsi fonts,
 * transliterating Cyrillic characters and removing astral-plane emojis while emitting
 * human-readable preflight warnings. Preserves intentional paragraph newlines (`\n`).
 */
export function sanitizeForWinAnsiWithWarnings(
  rawText: string,
  fieldLabel = 'campo'
): WinAnsiSanitizeResult {
  const warnings: string[] = [];
  if (!rawText) {
    return { text: '', warnings, hadEmoji: false, hadNonWinAnsi: false };
  }

  let working = normalizeWinAnsiTypography(rawText);
  let hadEmoji = false;
  let hadNonWinAnsi = false;

  const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
  if (emojiRegex.test(working)) {
    hadEmoji = true;
    working = working.replace(emojiRegex, '');
    warnings.push(
      `Emoji removido em "${fieldLabel}": fontes PDF oficiais (WinAnsi) não suportam emojis.`
    );
  }

  let transliterated = '';
  let usedTranslit = false;
  for (const ch of working) {
    if (CYRILLIC_TO_LATIN[ch] !== undefined) {
      transliterated += CYRILLIC_TO_LATIN[ch];
      usedTranslit = true;
      hadNonWinAnsi = true;
    } else {
      transliterated += ch;
    }
  }
  working = transliterated;
  if (usedTranslit) {
    warnings.push(
      `Caracteres cirílicos transliterados para alfabeto latino em "${fieldLabel}".`
    );
  }

  let cleaned = '';
  let strippedOther = false;
  for (let i = 0; i < working.length; i++) {
    const code = working.charCodeAt(i);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      code === 0x2013 ||
      code === 0x2014
    ) {
      cleaned += working[i];
    } else {
      strippedOther = true;
      hadNonWinAnsi = true;
    }
  }

  if (strippedOther) {
    warnings.push(
      `Símbolos especiais fora do padrão WinAnsi foram omitidos em "${fieldLabel}".`
    );
  }

  // Collapse horizontal spaces per line while preserving paragraph line breaks
  const normalizedLines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  return {
    text: normalizedLines.join('\n').trim(),
    warnings,
    hadEmoji,
    hadNonWinAnsi,
  };
}

/**
 * Convenience helper that returns a WinAnsi-safe string for single-line PDF drawing.
 */
export function toWinAnsiSafe(rawText: string): string {
  if (!rawText) return '';
  return sanitizeForWinAnsiWithWarnings(rawText).text;
}

