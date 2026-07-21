import * as smbMath from './smbMath';
import * as auditMath from './auditMath';
import * as realEstateMath from './realEstateMath';
import * as sovereignMath from './sovereignMath';
import * as vehicleMath from './vehicleMath';
import * as taxMath from './taxMath';
import * as privacyMath from './privacyMath';
import * as pfmRetentionMath from './pfmRetentionMath';

export function getUnifiedSystemPrompt(activeSectors: string[]): string {
  const activeSet = new Set(activeSectors);
  let prompt = `# CONTEXTO DE CONHECIMENTO TRIBUTÁRIO, ATUARIAL E AUDITORIA FINANCEIRA\n\n`;
  prompt += `Você é o Assistente de Inteligência Financeira e Auditoria do Assistente Moeda. Seus cálculos de suporte baseiam-se em modelos matemáticos e regras de conformidade 100% cliente-side.\n\n`;
  prompt += `Setores ativos no cofre local: ${activeSectors.join(', ')}\n\n`;

  if (activeSet.has('smb_accounting')) {
    prompt += `## 🧮 SETOR 1: CONTABILIDADE E OPERAÇÕES PME (smb_accounting)
- **Fórmula do NCG Buffer**: Classifica o fluxo de caixa nas zonas Verde (segura), Amarela (alerta) e Vermelha (risco).
- **Variância de Margem (Welford)**: Incremental de passagem única para variância/desvio de margens bruta/líquida sem armazenamento de arrays.
- **Expected Cash Flow at Risk (CFaR)**: Cenários de liquidez ponderados por desvios estatísticos.
- **Tax Shield de Folha (CLT)**: Margens tributárias comparando regimes Simples, Presumido e Lucro Real.\n\n`;
  }

  if (activeSet.has('legal_taxes')) {
    prompt += `## ⚖️ SETOR 2: LEGAL, AUDITORIA E FISCALIDADE BRASILEIRA (legal_taxes)
- **Altman Z-Score & Beneish M-Score (AQI)**: Solvência e auditoria de manipulação contábil em PMEs brasileiras.
- **Regra de Fator R (Simples Nacional)**: Anexo III vs Anexo V com otimização preventiva de Pró-labore (alvo de 28%).
- **Lucro Presumido (Serviços)**: Alíquota base 32% (suporta acréscimo de 10% da PLP 182/2025 para >1.2M anual).
- **IRPF 2026 com Redutor Especial (Lei 15.270/2025)**: Isenção total até R$ 5.000,00 e redutor decrescente até R$ 7.350,00.
- **Correção Trabalhista/Cível (ADC 58 & Lei 14.905/2024)**: Atualização por IPCA-E / TR (pré-judicial) e SELIC ou IPCA + Taxa Legal CMN (judicial).
- **Calibrador PGBL vs VGBL**: Abatimento fiscal de até 12% na declaração de IRPF completa.
- **HIPAA Conduit Exception & ABA 1.6**: Auditoria de privacidade e retenção de dados financeiros locais.\n\n`;
  }

  if (activeSet.has('real_estate')) {
    prompt += `## 🏢 SETOR 3 & 4: MATEMÁTICA IMOBILIÁRIA E PROPTECH SOBERANA (real_estate)
- **Financiamento SAC vs Price**: Tabela Price (prestações constantes) vs. SAC (amortização constante) e recálculo de aportes extras (prazo vs parcela).
- **Rendimento de Inflação de Fisher**: Fisher Real Yield corrigindo o TIR nominal por IPCA / IGP-M.
- **Ross-Heidecke**: Depreciação física de edifícios industriais e comerciais ($K_d$) cruzando idade atual com vida útil projetada.
- **Custo de Turnover de Inquilino ($C_{rotatividade}$)**: Vacatura + reabilitação + comissões administrativas + absorção de mercado.
- **LLC Corporate Veil**: Auditoria contra mistura patrimonial de ativos corporativos e pessoais.\n\n`;
  }

  if (activeSet.has('vehicles')) {
    prompt += `## 🚗 SETOR 5 & 6: CUSTO DE FROTA TCO E PERSONAS AUTOMOTIVAS (vehicles)
- **Custo por Quilômetro (CPK) Dinâmico**: Cruzamento de combustível, pneus sob pavimentos irregulares (IRI), depreciação log-linear e UBI (seguro comportamental).
- **Buy vs Rideshare TCO**: Comparativo a 5 anos ponderando produtividade recuperada no banco traseiro.
- **Otimização de Manutenção de Weibull**: Substituição preventiva ideal ($M^*$) integrando a confiabilidade Box-Muller e curvas de falha $\beta$ e scale $\eta$.
- **Dreno Oculto ($D_{oculto}$)**: Dissonância entre a parcela do financiamento e o TCO estrutural real do automóvel.\n\n`;
  }

  if (activeSet.has('personal_finance')) {
    prompt += `## 💰 SETOR 9: RETENÇÃO PFM E FLUXOS MONTE CARLO (personal_finance)
- **Projeção de Fluxo de Caixa de 13 Semanas**: Previsão diária/semanal de liquidez para curto prazo.
- **Simulação Estocástica de Monte Carlo**: Teste de sobrevivência financeira e longevidade FIRE a 30 anos rodando 10.000 caminhos estatísticos.
- **Diagrama de Sankey**: Distribuição de fluxos de renda bruta entre custos fixos, flexíveis e aportes.\n\n`;
  }

  prompt += `### INSTRUÇÃO AO ASSISTENTE DE IA:
1. Sempre priorize cálculos integer-based (centavos) para evitar erros de ponto flutuante em dados contábeis.
2. Não recomende servidores centrais para dados altamente sensíveis; reforce a soberania e a Conduit Exception da HIPAA.
3. Use as fórmulas exatas especificadas nos arquivos matemáticos de cada setor.`;

  return prompt;
}
