export interface DriverTrip {
  data: string;
  origem: string;
  destino: string;
  milhasKm: number;
  tipoViagem: 'profissional' | 'pessoal';
  receitaBruta: number;
  despesasCombustivel: number;
  portagemEstacionamento: number;
}

export interface CopywritingParserResult {
  trips: DriverTrip[];
  errors: string[];
}

export function detectAutoMerchantContext(merchantName: string): boolean {
  const keywords = [
    'shell',
    'repsol',
    'galp',
    'ipiranga',
    'br',
    'oficina',
    'pedágio',
    'pedagio',
    'sem parar',
    'semparar',
    'uber',
    'gasolina',
    'posto',
    'auto',
    'pneu',
    'revisão',
    'revisao',
    'mecânico',
    'mecanico',
  ];
  const nameLower = merchantName.toLowerCase();
  return keywords.some((kw) => nameLower.includes(kw));
}

export function parseDriverTripsCSV(csvText: string): CopywritingParserResult {
  const errors: string[] = [];
  const trips: DriverTrip[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { trips, errors: ['Arquivo vazio'] };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf('data');
  const origIdx = headers.indexOf('origem');
  const destIdx = headers.indexOf('destino');
  const distIdx = headers.indexOf('milhas_km');
  const typeIdx = headers.indexOf('tipo_viagem');
  const recIdx = headers.indexOf('receita_bruta');
  const fuelIdx = headers.indexOf('despesas_combustivel');
  const tollIdx = headers.indexOf('portagem_estacionamento');

  if (dateIdx === -1 || distIdx === -1 || typeIdx === -1) {
    return {
      trips,
      errors: ['Cabeçalhos obrigatórios ausentes. Esperado: data, milhas_km, tipo_viagem'],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const data = cols[dateIdx] || '';
    const origem = origIdx !== -1 ? cols[origIdx] : '';
    const destino = destIdx !== -1 ? cols[destIdx] : '';
    const milhasKm = parseFloat(cols[distIdx]) || 0;
    
    const typeRaw = typeIdx !== -1 ? cols[typeIdx].toLowerCase() : 'profissional';
    const tipoViagem: 'profissional' | 'pessoal' = typeRaw.includes('pessoal') ? 'pessoal' : 'profissional';

    const receitaBruta = recIdx !== -1 ? parseFloat(cols[recIdx]) || 0 : 0;
    const despesasCombustivel = fuelIdx !== -1 ? parseFloat(cols[fuelIdx]) || 0 : 0;
    const portagemEstacionamento = tollIdx !== -1 ? parseFloat(cols[tollIdx]) || 0 : 0;

    trips.push({
      data,
      origem,
      destino,
      milhasKm,
      tipoViagem,
      receitaBruta,
      despesasCombustivel,
      portagemEstacionamento,
    });
  }

  return {
    trips,
    errors,
  };
}
