export interface FleetVehicle {
  idVeiculo: string;
  perfilCategoria: string;
  perfilPropulsao: string;
  perfilMsrp: number;
  perfilDistanciaAnual: number;
  energiaPrecoBase: number;
  energiaVolatilidadeIndice: number;
  energiaConsumoNominal: number;
  energiaFatorCondutor: number;
  energiaFatorRota: number;
  pneusQuantidadePneus: number;
  pneusPrecoUnitario: number;
  pneusVidaNominal: number;
  pneusIriEstrada: number;
  pneusSensibilidadeIri: number;
  seguroPremioBase: number;
  seguroTaxaVariavel: number;
  seguroPontuacaoSeguranca: number;
  seguroFatorRisco: number;
  deprecCoefIdade: number;
  deprecCoefQuilometragem: number;
  deprecIdadeAtualAnos: number;
  deprecQuilometragemAcumulada: number;
  weibullBeta: number;
  weibullEta: number;
  weibullCustoPrev: number;
  weibullCustoCorr: number;
}

export interface VehicleParserResult {
  vehicles: FleetVehicle[];
  errors: string[];
}

export function parseVehicleCSV(csvText: string): VehicleParserResult {
  const errors: string[] = [];
  const vehicles: FleetVehicle[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { vehicles, errors: ['Arquivo vazio'] };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.indexOf('idveiculo');
  const catIdx = headers.indexOf('perfil_categoria');
  const propIdx = headers.indexOf('perfil_propulsao');
  const msrpIdx = headers.indexOf('perfil_msrp');
  const distIdx = headers.indexOf('perfil_distanciaanual');
  const pBaseIdx = headers.indexOf('energia_precobase');
  const pVolIdx = headers.indexOf('energia_volatilidadeindice');
  const consIdx = headers.indexOf('energia_consumonominal');
  const condIdx = headers.indexOf('energia_fatorcondutor');
  const rotaIdx = headers.indexOf('energia_fatorrota');
  const pQtyIdx = headers.indexOf('pneus_quantidadepneus');
  const pPriceIdx = headers.indexOf('pneus_precounitario');
  const pLifeIdx = headers.indexOf('pneus_vidanominal');
  const pIriIdx = headers.indexOf('pneus_iriestrada');
  const pSensIdx = headers.indexOf('pneus_sensibilidadeiri');
  const sPremIdx = headers.indexOf('seguro_premiobase');
  const sVarIdx = headers.indexOf('seguro_taxavariavel');
  const sScoreIdx = headers.indexOf('seguro_pontuacaoseguranca');
  const sRiskIdx = headers.indexOf('seguro_fatorrisco');
  const dAgeIdx = headers.indexOf('deprec_coefidade');
  const dKmIdx = headers.indexOf('deprec_coefquilometragem');
  const dAgeActIdx = headers.indexOf('deprec_idadeatualanos');
  const dKmActIdx = headers.indexOf('deprec_quilometragemacumulada');
  const wBetaIdx = headers.indexOf('weibull_beta');
  const wEtaIdx = headers.indexOf('weibull_eta');
  const wPrevIdx = headers.indexOf('weibull_custoprev');
  const wCorrIdx = headers.indexOf('weibull_custocorr');

  if (idIdx === -1 || msrpIdx === -1 || wBetaIdx === -1) {
    return {
      vehicles,
      errors: ['Cabeçalhos obrigatórios ausentes. Verifique se o CSV contém idVeiculo, perfil_msrp, weibull_beta'],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const idVeiculo = cols[idIdx] || '';
    if (!idVeiculo) {
      errors.push(`Linha ${i + 1}: idVeiculo ausente.`);
      continue;
    }

    const perfilCategoria = catIdx !== -1 ? cols[catIdx] : 'Comercial';
    const perfilPropulsao = propIdx !== -1 ? cols[propIdx] : 'Combustão';
    const perfilMsrp = parseFloat(cols[msrpIdx]) || 0;
    const perfilDistanciaAnual = distIdx !== -1 ? parseFloat(cols[distIdx]) || 15000 : 15000;
    const energiaPrecoBase = pBaseIdx !== -1 ? parseFloat(cols[pBaseIdx]) || 5.8 : 5.8;
    const energiaVolatilidadeIndice = pVolIdx !== -1 ? parseFloat(cols[pVolIdx]) || 0.15 : 0.15;
    const energiaConsumoNominal = consIdx !== -1 ? parseFloat(cols[consIdx]) || 8.5 : 8.5;
    const energiaFatorCondutor = condIdx !== -1 ? parseFloat(cols[condIdx]) || 0.05 : 0.05;
    const energiaFatorRota = rotaIdx !== -1 ? parseFloat(cols[rotaIdx]) || 1.0 : 1.0;
    const pneusQuantidadePneus = pQtyIdx !== -1 ? parseInt(cols[pQtyIdx], 10) || 4 : 4;
    const pneusPrecoUnitario = pPriceIdx !== -1 ? parseFloat(cols[pPriceIdx]) || 450 : 450;
    const pneusVidaNominal = pLifeIdx !== -1 ? parseFloat(cols[pLifeIdx]) || 40000 : 40000;
    const pneusIriEstrada = pIriIdx !== -1 ? parseFloat(cols[pIriIdx]) || 2.0 : 2.0;
    const pneusSensibilidadeIri = pSensIdx !== -1 ? parseFloat(cols[pSensIdx]) || 0.1 : 0.1;
    const seguroPremioBase = sPremIdx !== -1 ? parseFloat(cols[sPremIdx]) || 2400 : 2400;
    const seguroTaxaVariavel = sVarIdx !== -1 ? parseFloat(cols[sVarIdx]) || 0.1 : 0.1;
    const seguroPontuacaoSeguranca = sScoreIdx !== -1 ? parseFloat(cols[sScoreIdx]) || 90 : 90;
    const seguroFatorRisco = sRiskIdx !== -1 ? parseFloat(cols[sRiskIdx]) || 1.0 : 1.0;
    const deprecCoefIdade = dAgeIdx !== -1 ? parseFloat(cols[dAgeIdx]) || 0.15 : 0.15;
    const deprecCoefQuilometragem = dKmIdx !== -1 ? parseFloat(cols[dKmIdx]) || 0.08 : 0.08;
    const deprecIdadeAtualAnos = dAgeActIdx !== -1 ? parseInt(cols[dAgeActIdx], 10) || 2 : 2;
    const deprecQuilometragemAcumulada = dKmActIdx !== -1 ? parseFloat(cols[dKmActIdx]) || 30000 : 30000;
    const weibullBeta = wBetaIdx !== -1 ? parseFloat(cols[wBetaIdx]) || 2.2 : 2.2;
    const weibullEta = wEtaIdx !== -1 ? parseFloat(cols[wEtaIdx]) || 80000 : 80000;
    const weibullCustoPrev = wPrevIdx !== -1 ? parseFloat(cols[wPrevIdx]) || 350 : 350;
    const weibullCustoCorr = wCorrIdx !== -1 ? parseFloat(cols[wCorrIdx]) || 1800 : 1800;

    const record: FleetVehicle = {
      idVeiculo,
      perfilCategoria,
      perfilPropulsao,
      perfilMsrp,
      perfilDistanciaAnual,
      energiaPrecoBase,
      energiaVolatilidadeIndice,
      energiaConsumoNominal,
      energiaFatorCondutor,
      energiaFatorRota,
      pneusQuantidadePneus,
      pneusPrecoUnitario,
      pneusVidaNominal,
      pneusIriEstrada,
      pneusSensibilidadeIri,
      seguroPremioBase,
      seguroTaxaVariavel,
      seguroPontuacaoSeguranca,
      seguroFatorRisco,
      deprecCoefIdade,
      deprecCoefQuilometragem,
      deprecIdadeAtualAnos,
      deprecQuilometragemAcumulada,
      weibullBeta,
      weibullEta,
      weibullCustoPrev,
      weibullCustoCorr,
    };

    vehicles.push(record);
  }

  return {
    vehicles,
    errors,
  };
}
