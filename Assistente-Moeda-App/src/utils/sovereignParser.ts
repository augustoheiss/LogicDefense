export interface SovereignProperty {
  llcName: string;
  propertyId: string;
  monthlyRent: number;
  vacancyMonths: number;
  rehabExp: number;
  marketingExp: number;
  legalExp: number;
  fixedCarryingExp: number;
}

export interface SovereignParserResult {
  records: SovereignProperty[];
  errors: string[];
}

export function parseSovereignCSV(csvText: string): SovereignParserResult {
  const errors: string[] = [];
  const records: SovereignProperty[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { records, errors: ['Arquivo vazio'] };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const llcIdx = headers.indexOf('llc_name');
  const idIdx = headers.indexOf('property_id');
  const rentIdx = headers.indexOf('monthly_rent');
  const vacIdx = headers.indexOf('vacancy_months');
  const rehabIdx = headers.indexOf('rehab_exp');
  const markIdx = headers.indexOf('marketing_exp');
  const legalIdx = headers.indexOf('legal_exp');
  const carryIdx = headers.indexOf('fixed_carrying_exp');

  if (idIdx === -1 || llcIdx === -1 || rentIdx === -1) {
    return {
      records,
      errors: ['Cabeçalhos obrigatórios ausentes. Esperado ao menos: llc_name, property_id, monthly_rent'],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const llcName = cols[llcIdx] || '';
    const propertyId = cols[idIdx] || '';
    if (!llcName || !propertyId) {
      errors.push(`Linha ${i + 1}: llc_name ou property_id ausentes.`);
      continue;
    }

    const monthlyRent = parseFloat(cols[rentIdx]) || 0;
    const vacancyMonths = vacIdx !== -1 ? parseFloat(cols[vacIdx]) || 0 : 0;
    const rehabExp = rehabIdx !== -1 ? parseFloat(cols[rehabIdx]) || 0 : 0;
    const marketingExp = markIdx !== -1 ? parseFloat(cols[markIdx]) || 0 : 0;
    const legalExp = legalIdx !== -1 ? parseFloat(cols[legalIdx]) || 0 : 0;
    const fixedCarryingExp = carryIdx !== -1 ? parseFloat(cols[carryIdx]) || 0 : 0;

    const record: SovereignProperty = {
      llcName,
      propertyId,
      monthlyRent,
      vacancyMonths,
      rehabExp,
      marketingExp,
      legalExp,
      fixedCarryingExp,
    };

    records.push(record);
  }

  return {
    records,
    errors,
  };
}
