export interface PfmTransaction {
  dataMovimento: string;
  descricaoComerciante: string;
  valorCents: number;
  categoria: string;
  metaAssociada: string;
  statusConsolidacao: string;
  txHash: string; // generated locally
}

export interface PfmParserResult {
  transactions: PfmTransaction[];
  errors: string[];
}

import { generateTransactionHash } from './pfmRetentionMath';

export function parsePfmCSV(csvText: string): PfmParserResult {
  const errors: string[] = [];
  const transactions: PfmTransaction[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { transactions, errors: ['Arquivo vazio'] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf('data_movimento');
  const descIdx = headers.indexOf('descricao_comerciante');
  const valIdx = headers.indexOf('valor_cents');
  const catIdx = headers.indexOf('categoria');
  const goalIdx = headers.indexOf('meta_associada');
  const statusIdx = headers.indexOf('status_consolidacao');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const dataMovimento = dateIdx !== -1 ? cols[dateIdx] : '';
    const descricaoComerciante = descIdx !== -1 ? cols[descIdx] : '';
    const valorCents = valIdx !== -1 ? parseInt(cols[valIdx], 10) || 0 : 0;
    const categoria = catIdx !== -1 ? cols[catIdx] : '';
    const metaAssociada = goalIdx !== -1 ? cols[goalIdx] : '';
    const statusConsolidacao = statusIdx !== -1 ? cols[statusIdx] : '';

    const txHash = generateTransactionHash(dataMovimento, valorCents, descricaoComerciante);

    transactions.push({
      dataMovimento,
      descricaoComerciante,
      valorCents,
      categoria,
      metaAssociada,
      statusConsolidacao,
      txHash,
    });
  }

  return {
    transactions,
    errors,
  };
}
