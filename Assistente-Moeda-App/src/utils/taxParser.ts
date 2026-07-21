export interface TaxRecord {
  dataVencimento: string;
  valorOriginal: number;
  tipoDebito: string;
  dataAjuizamento: string;
  dataQuitacao: string;
  massaSalarial12: number;
  receitaBruta12: number;
  cnaeCodigo: string;
}

export interface TaxParserResult {
  records: TaxRecord[];
  errors: string[];
}

export function parseTaxCSV(csvText: string): TaxParserResult {
  const errors: string[] = [];
  const records: TaxRecord[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { records, errors: ['Arquivo vazio'] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dueIdx = headers.indexOf('data_vencimento');
  const valIdx = headers.indexOf('valor_original');
  const typeIdx = headers.indexOf('tipo_debito');
  const ajuizIdx = headers.indexOf('data_ajuizamento');
  const quitIdx = headers.indexOf('data_quitacao');
  const massIdx = headers.indexOf('massa_salarial_12');
  const revIdx = headers.indexOf('receita_bruta_12');
  const cnaeIdx = headers.indexOf('cnae_codigo');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const dataVencimento = dueIdx !== -1 ? cols[dueIdx] : '';
    const valorOriginal = valIdx !== -1 ? parseFloat(cols[valIdx]) || 0 : 0;
    const tipoDebito = typeIdx !== -1 ? cols[typeIdx] : '';
    const dataAjuizamento = ajuizIdx !== -1 ? cols[ajuizIdx] : '';
    const dataQuitacao = quitIdx !== -1 ? cols[quitIdx] : '';
    const massaSalarial12 = massIdx !== -1 ? parseFloat(cols[massIdx]) || 0 : 0;
    const receitaBruta12 = revIdx !== -1 ? parseFloat(cols[revIdx]) || 0 : 0;
    const cnaeCodigo = cnaeIdx !== -1 ? cols[cnaeIdx] : '';

    records.push({
      dataVencimento,
      valorOriginal,
      tipoDebito,
      dataAjuizamento,
      dataQuitacao,
      massaSalarial12,
      receitaBruta12,
      cnaeCodigo,
    });
  }

  return {
    records,
    errors,
  };
}
