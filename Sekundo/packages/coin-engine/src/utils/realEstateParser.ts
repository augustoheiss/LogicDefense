export interface RealEstateProperty {
  propertyId: string;
  propertyName: string;
  rentalIncome: number;
  mortgageInterest: number;
  amortizationType: 'price' | 'sac';
  propertyValue: number;
  usefulLife: number;
  effectiveAge: number;
  heideckeState: number;
}

export interface RealEstateParserResult {
  properties: RealEstateProperty[];
  errors: string[];
}

export function parseRealEstateCSV(csvText: string): RealEstateParserResult {
  const errors: string[] = [];
  const properties: RealEstateProperty[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { properties, errors: ['Arquivo vazio'] };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.indexOf('property_id');
  const nameIdx = headers.indexOf('property_name');
  const rentIdx = headers.indexOf('rental_income');
  const mortIdx = headers.indexOf('mortgage_interest');
  const typeIdx = headers.indexOf('amortization_type');
  const valIdx = headers.indexOf('property_value');
  const lifeIdx = headers.indexOf('useful_life');
  const ageIdx = headers.indexOf('effective_age');
  const stateIdx = headers.indexOf('heidecke_state');

  if (idIdx === -1 || nameIdx === -1 || valIdx === -1) {
    return {
      properties,
      errors: ['Cabeçalhos obrigatórios ausentes. Esperado ao menos: property_id, property_name, property_value'],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const propertyId = cols[idIdx] || '';
    if (!propertyId) {
      errors.push(`Linha ${i + 1}: Identificador property_id ausente.`);
      continue;
    }

    const propertyName = cols[nameIdx] || '';
    const rentalIncome = rentIdx !== -1 ? parseFloat(cols[rentIdx]) || 0 : 0;
    const mortgageInterest = mortIdx !== -1 ? parseFloat(cols[mortIdx]) || 0 : 0;
    const amortizationTypeRaw = typeIdx !== -1 ? cols[typeIdx].toLowerCase() : 'price';
    const amortizationType: 'price' | 'sac' = amortizationTypeRaw === 'sac' ? 'sac' : 'price';
    const propertyValue = parseFloat(cols[valIdx]) || 0;
    const usefulLife = lifeIdx !== -1 ? parseInt(cols[lifeIdx], 10) || 50 : 50;
    const effectiveAge = ageIdx !== -1 ? parseInt(cols[ageIdx], 10) || 0 : 0;
    const heideckeState = stateIdx !== -1 ? parseFloat(cols[stateIdx]) || 0.0 : 0.0;

    const property: RealEstateProperty = {
      propertyId,
      propertyName,
      rentalIncome,
      mortgageInterest,
      amortizationType,
      propertyValue,
      usefulLife,
      effectiveAge,
      heideckeState,
    };

    properties.push(property);
  }

  return {
    properties,
    errors,
  };
}
