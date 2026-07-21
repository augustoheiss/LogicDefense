export interface ExpectedUtilityResult {
  euCloud: number;
  euLocal: number;
  utilityGainPercent: number;
  description: string;
}

export function calculateExpectedUtilityOfCompliance(
  totalWealthW: number,
  declaredIncomeI: number,
  taxRateTheta: number, // (0.0 to 1.0)
  baseAuditProbP: number, // (0.0 to 1.0)
  penaltyRateS: number // (0.0 to 1.0)
): ExpectedUtilityResult {
  // Classic logarithmic utility function representing risk aversion: U(x) = ln(x)
  const U = (x: number) => {
    return x > 0 ? Math.log(x) : 0;
  };

  // Base parameters
  const declaredTaxCost = taxRateTheta * declaredIncomeI;
  const undeclaredAmount = totalWealthW - declaredIncomeI;

  // Cloud probability multiplier due to third-party telemetry / cloud leaks / tax AI indexing
  const pCloud = Math.min(0.99, baseAuditProbP * 2.5);
  const pLocal = baseAuditProbP;

  // Cloud utility
  const cloudNoAuditWealth = totalWealthW - declaredTaxCost;
  const cloudAuditWealth = Math.max(1, totalWealthW - declaredTaxCost - penaltyRateS * undeclaredAmount);
  const euCloud = (1 - pCloud) * U(cloudNoAuditWealth) + pCloud * U(cloudAuditWealth);

  // Local-first utility
  const localNoAuditWealth = totalWealthW - declaredTaxCost;
  const localAuditWealth = Math.max(1, totalWealthW - declaredTaxCost - penaltyRateS * undeclaredAmount);
  const euLocal = (1 - pLocal) * U(localNoAuditWealth) + pLocal * U(localAuditWealth);

  const utilityGainPercent = euCloud > 0 ? ((euLocal - euCloud) / euCloud) * 100 : 0;

  const description =
    euLocal > euCloud
      ? `✅ Utilidade Soberana: Manter seus dados financeiros local-first reduz a visibilidade algorítmica externa, proporcionando um ganho de paz de espírito (utilidade percebida) de ${utilityGainPercent.toFixed(1)}% contra riscos de fiscalização surpresa.`
      : `⚠️ A utilidade esperada é equivalente sob declaração voluntária integral.`;

  return {
    euCloud,
    euLocal,
    utilityGainPercent,
    description,
  };
}

export interface HipaacomplianceResult {
  conduitExceptionApplies: boolean;
  baaRequired: boolean;
  complianceRating: number; // 0 to 100
  complianceBadge: 'EXEMPT' | 'COMPLIANT' | 'NON_COMPLIANT';
  remedyAction: string;
}

export function evaluateHIPAAStorage(
  isLocalOnly: boolean,
  isZeroCloudRetention: boolean,
  hasAesEncryption: boolean
): HipaacomplianceResult {
  const conduitExceptionApplies = isLocalOnly && isZeroCloudRetention;
  const baaRequired = !conduitExceptionApplies;

  let complianceRating = 0;
  if (isLocalOnly) complianceRating += 40;
  if (isZeroCloudRetention) complianceRating += 30;
  if (hasAesEncryption) complianceRating += 30;

  let complianceBadge: 'EXEMPT' | 'COMPLIANT' | 'NON_COMPLIANT' = 'NON_COMPLIANT';
  if (conduitExceptionApplies) {
    complianceBadge = 'EXEMPT';
  } else if (hasAesEncryption) {
    complianceBadge = 'COMPLIANT';
  }

  const remedyAction = conduitExceptionApplies
    ? '✅ Isenção BAA Automática: Sob a Conduit Exception Rule, como não há retenção persistente nos servidores do provedor, o software não qualifica como Business Associate.'
    : baaRequired && !hasAesEncryption
    ? '❌ Não-Conforme: Hospedar dados PHI em servidores terceiros sem criptografia local requer obrigatoriamente a assinatura de um contrato de BAA (Business Associate Agreement) para evitar multas federais.'
    : '⚠️ Conforme com BAA: Armazenamento persistente na nuvem com criptografia de ponta a ponta exige assinatura e auditoria periódica do BAA.';

  return {
    conduitExceptionApplies,
    baaRequired,
    complianceRating,
    complianceBadge,
    remedyAction,
  };
}

export interface SubpoenaShieldResult {
  shieldRating: number; // 0 to 100
  riskCategory: 'BAIXO' | 'MÉDIO' | 'ALTO';
  gagOrderProbability: number; // %
  description: string;
}

export function calculateSubpoenaVulnerability(
  storageType: 'cloud_us' | 'cloud_eu' | 'swiss' | 'local_opfs'
): SubpoenaShieldResult {
  let shieldRating = 0;
  let riskCategory: 'BAIXO' | 'MÉDIO' | 'ALTO' = 'ALTO';
  let gagOrderProbability = 0;
  let description = '';

  switch (storageType) {
    case 'cloud_us':
      shieldRating = 15;
      riskCategory = 'ALTO';
      gagOrderProbability = 85;
      description = '❌ EUA Cloud: Sujeito a ordens de silêncio (gag orders) sob a FISA e intimações de agências federais sem direito a notificação prévia.';
      break;
    case 'cloud_eu':
      shieldRating = 50;
      riskCategory = 'MÉDIO';
      gagOrderProbability = 45;
      description = '⚠️ Europa Cloud: GDPR protege contra privacidade básica, mas intimações judiciais transfronteiriças ainda podem acessar metadados em servidores centralizados.';
      break;
    case 'swiss':
      shieldRating = 75;
      riskCategory = 'MÉDIO';
      gagOrderProbability = 20;
      description = '✅ Suíça Cloud: Leis de privacidade rígidas limitam cooperação judicial sumária, exigindo dupla incriminação.';
      break;
    case 'local_opfs':
      shieldRating = 98;
      riskCategory = 'BAIXO';
      gagOrderProbability = 1;
      description = '🛡️ Local-First OPFS: Dados encriptados residem no sandbox do seu navegador local. Intimações contra o provedor retornam ZERO metadados.';
      break;
  }

  return {
    shieldRating,
    riskCategory,
    gagOrderProbability,
    description,
  };
}

export interface AnomalyAuditResult {
  roundInvoicePercent: number;
  expenseToIncomeRatio: number;
  sequentialInvoiceGaps: number;
  auditTriggerRisk: 'BAIXO' | 'MÉDIO' | 'ALTO';
  remedyTips: string[];
}

export function scanLocalAuditAnomalies(
  invoiceAmounts: number[],
  monthlyIncome: number,
  monthlyExpenses: number,
  invoiceNumbers: number[]
): AnomalyAuditResult {
  // 1. Round numbers check (e.g. ending in 00 or 50)
  const roundCount = invoiceAmounts.filter((amt) => amt % 10 === 0).length;
  const roundInvoicePercent = invoiceAmounts.length > 0 ? (roundCount / invoiceAmounts.length) * 100 : 0;

  // 2. Expense to Income ratio
  const expenseToIncomeRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0;

  // 3. Invoice gaps
  let sequentialInvoiceGaps = 0;
  if (invoiceNumbers.length > 1) {
    const sorted = [...invoiceNumbers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] > 1) {
        sequentialInvoiceGaps += (sorted[i + 1] - sorted[i] - 1);
      }
    }
  }

  // 4. Audit risk classification
  let riskScore = 0;
  if (roundInvoicePercent > 40) riskScore += 30;
  if (expenseToIncomeRatio > 85) riskScore += 40;
  if (sequentialInvoiceGaps > 2) riskScore += 30;

  let auditTriggerRisk: 'BAIXO' | 'MÉDIO' | 'ALTO' = 'BAIXO';
  if (riskScore >= 70) {
    auditTriggerRisk = 'ALTO';
  } else if (riskScore >= 40) {
    auditTriggerRisk = 'MÉDIO';
  }

  const remedyTips: string[] = [];
  if (roundInvoicePercent > 40) {
    remedyTips.push('⚠️ Evite emitir múltiplas faturas com valores arredondados (ex: R$ 5.000,00). O Fisco audita padrões de transações redondas por indício de estimativa.');
  }
  if (expenseToIncomeRatio > 85) {
    remedyTips.push('⚠️ Seus custos operacionais reportados superam 85% do faturamento. O algoritmo "Fisco 3.0" sinaliza margens muito baixas para auditoria preventiva.');
  }
  if (sequentialInvoiceGaps > 2) {
    remedyTips.push(`⚠️ Detectamos ${sequentialInvoiceGaps} falha(s) de numeração nas faturas de vendas. Lacunas sequenciais indicam possível omissão de receita.`);
  }

  if (remedyTips.length === 0) {
    remedyTips.push('✅ Padrão auditável saudável: Nenhum gatilho de discrepância estatística ou arredondamento foi ativado localmente.');
  }

  return {
    roundInvoicePercent,
    expenseToIncomeRatio,
    sequentialInvoiceGaps,
    auditTriggerRisk,
    remedyTips,
  };
}
