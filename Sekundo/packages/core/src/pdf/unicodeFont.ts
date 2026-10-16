/**
 * Sekundo PDF Engine — Hybrid Unicode & WinAnsi Sanitizer (`unicodeFont.ts`)
 *
 * Implements Phase R2 Decision #2 (Hybrid Font Strategy):
 * 1. Keeps standard `Helvetica` (0 KB overhead) when `needsUnicode(text) === false`
 *    after normalizing typographic quotes, dashes, and spaces to WinAnsi equivalents.
 * 2. Detects non-WinAnsi BMP characters (Cyrillic, Greek, math symbols) and astral-plane
 *    emojis (`U+1F000+`), transliterating or stripping unsupported glyphs while recording
 *    structured warnings so `pdf-lib` NEVER throws `WinAnsi cannot encode` and aborts a document (H3).
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
 * standard WinAnsi / ASCII equivalents.
 */
export function normalizeWinAnsiTypography(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u00B7]/g, '-')
    .replace(/[✓✔☑]/g, '[X]')
    .replace(/[⬜□☐]/g, '[ ]')
    .replace(/\u00A0/g, ' ');
}

/**
 * Returns true if `text` (after typography normalization) contains any character
 * outside the WinAnsi (ISO-8859-1 / CP1252 printable) repertoire.
 */
export function needsUnicode(text: string): boolean {
  const norm = normalizeWinAnsiTypography(text);
  for (let i = 0; i < norm.length; i++) {
    const code = norm.charCodeAt(i);
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code >= 0x20 && code <= 0x7e) continue;
    if (code >= 0xa0 && code <= 0xff) continue;
    return true;
  }
  return false;
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
 * human-readable preflight warnings.
 */
export function sanitizeForWinAnsiWithWarnings(
  rawText: string,
  fieldLabel = 'texto'
): WinAnsiSanitizeResult {
  const warnings: string[] = [];
  if (!rawText) {
    return { text: '', warnings, hadEmoji: false, hadNonWinAnsi: false };
  }

  let working = normalizeWinAnsiTypography(rawText);
  let hadEmoji = false;
  let hadNonWinAnsi = false;

  // Detect astral-plane emojis & pictographs
  const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
  if (emojiRegex.test(working)) {
    hadEmoji = true;
    working = working.replace(emojiRegex, '');
    warnings.push(
      `Emoji removido em "${fieldLabel}": fontes PDF padrão (WinAnsi) não suportam emojis coloridos.`
    );
  }

  // Transliterate Cyrillic if present
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

  // Strip any remaining characters outside WinAnsi (0x20-0x7E, 0xA0-0xFF, newline/tab)
  let cleaned = '';
  let strippedOther = false;
  for (let i = 0; i < working.length; i++) {
    const code = working.charCodeAt(i);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff)
    ) {
      cleaned += working[i];
    } else {
      strippedOther = true;
      hadNonWinAnsi = true;
    }
  }

  if (strippedOther) {
    warnings.push(
      `Glifos fora do conjunto WinAnsi foram omitidos em "${fieldLabel}".`
    );
  }

  return {
    text: cleaned.replace(/\s+/g, ' ').trim(),
    warnings,
    hadEmoji,
    hadNonWinAnsi,
  };
}
