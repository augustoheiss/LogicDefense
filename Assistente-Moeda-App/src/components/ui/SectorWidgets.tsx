import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { useCoinDB } from '@/hooks/useCoinDB';
import {
  runMonteCarloFIRE,
  predict13WeekCashFlow,
} from '../../utils/pfmRetentionMath';
import {
  calculateNCG,
  calculateCFaR,
  calculatePayrollTax,
} from '../../utils/smbMath';
import {
  generatePriceSchedule,
  generateSACSchedule,
  recalculateExtraordinaryAmortization,
  calculateRealYield,
} from '../../utils/realEstateMath';
import {
  calculateDynamicCPK,
  compareOwnershipVsRideshare,
} from '../../utils/vehicleMath';
import {
  calculateTVDENetHourly,
} from '../../utils/vehicleCopywritingMath';
import {
  calculateFatorR,
  calculateLucroPresumido,
  calculateIRPF2026,
  calculateJudicialCorrection,
  calibratePrevidencia,
} from '../../utils/taxMath';

interface SubToolNode {
  id: string;
  icon: string;
  title: string;
  guide: string;
}

function CadSectorFrame({
  sectorKey,
  sectorIcon,
  sectorName,
  subTools,
  activeToolId,
  onSelectTool,
  children,
}: {
  sectorKey: string;
  sectorIcon: string;
  sectorName: string;
  subTools: SubToolNode[];
  activeToolId: string;
  onSelectTool: (id: string) => void;
  children: React.ReactNode;
}) {
  const db = useCoinDB();
  const m = db.metrics;
  const rowsCount = db.activeTable?.rows?.length || 0;
  const lastSync = (db.activeTable?.sectorParams as any)?.[`${sectorKey}_syncedAt`];
  const activeTool = subTools.find((t) => t.id === activeToolId) || subTools[0];

  const handlePersistSnapshot = () => {
    db.updateSectorParams({
      [`${sectorKey}_syncedAt`]: new Date().toISOString(),
      [`${sectorKey}_baseline`]: {
        monthlyRevenue: Math.round(m.globalMonthlyAvg * 100) / 100,
        monthlyExpense: Math.round(m.survivalMonthly * 100) / 100,
        netBalance: Math.round(m.netBalance * 100) / 100,
        portfolio: Math.round((m.investmentBalance || m.totalInvested) * 100) / 100,
      },
    });
  };

  return (
    <View style={cadStyles.frame} testID={`cad-sector-workbench-${sectorKey}`}>
      {/* Barra Superior AutoCAD: Nome Curto + Botões Somente-Ícone (Sem Descrições) + Salvar */}
      <View style={cadStyles.topBar}>
        <View style={cadStyles.brandGroup}>
          <Text style={cadStyles.sectorBadge}>{sectorIcon} {sectorName}</Text>
          <Text style={cadStyles.livePill}>🔗 {rowsCount} lanç.</Text>
        </View>

        <View style={cadStyles.iconButtonsDock}>
          {subTools.map((tool) => {
            const active = tool.id === activeTool.id;
            return (
              <Pressable
                key={tool.id}
                testID={`cad-subtool-${sectorKey}-${tool.id}`}
                style={[cadStyles.iconBtn, active && cadStyles.iconBtnActive]}
                onPress={() => onSelectTool(tool.id)}
              >
                <Text style={cadStyles.iconBtnEmoji}>{tool.icon}</Text>
                {active && <View style={cadStyles.activeDot} />}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          testID={`cad-save-snapshot-${sectorKey}`}
          style={cadStyles.saveBtn}
          onPress={handlePersistSnapshot}
        >
          <Text style={cadStyles.saveBtnText}>{lastSync ? '✓ Salvo' : '💾 Salvar'}</Text>
        </Pressable>
      </View>

      {/* Visor Guia Interativo ("Vai te guiando o que é aquele botão") */}
      <View style={cadStyles.guideBanner}>
        <View style={cadStyles.guideIconBox}>
          <Text style={{ fontSize: 16 }}>{activeTool.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cadStyles.guideTitle}>🧭 {activeTool.title}</Text>
          <Text style={cadStyles.guideText}>{activeTool.guide}</Text>
        </View>
      </View>

      {/* Palco Central Interativo (Zero Rolagem de Página) */}
      <View style={cadStyles.stageBody}>
        {children}
      </View>
    </View>
  );
}

// ── 1.👤 Finanças Pessoais (PFM & FIRE) ───────────────────────────────────────
const PFM_TOOLS: SubToolNode[] = [
  {
    id: 'fire',
    icon: '🔥',
    title: 'Longevidade & Independência (Monte Carlo FIRE)',
    guide: 'Simula 2.500 cenários para descobrir por quantos anos seu patrimônio sustenta seu custo anual sem quebrar.',
  },
  {
    id: 'rule_503020',
    icon: '⚖️',
    title: 'Calibrador de Orçamento (Regra 50 / 30 / 20)',
    guide: 'Divide sua renda mensal real entre Custos Fixos (50%), Estilo de Vida (30%) e Liberdade/Aportes (20%).',
  },
  {
    id: 'cashflow_13w',
    icon: '🌊',
    title: 'Radar de Liquidez (Projeção 13 Semanas)',
    guide: 'Projeta seu caixa nas próximas 13 semanas com base no saldo e médias da planilha, testando imprevistos.',
  },
];

export function PersonalFinanceSectorWidget() {
  const db = useCoinDB();
  const m = db.metrics;
  const [activeTool, setActiveTool] = useState<string>('fire');

  const defaultPort = (m.investmentBalance || m.totalInvested) > 0 ? Math.round(m.investmentBalance || m.totalInvested) : Math.max(50000, Math.round(m.netBalance * 6));
  const defaultDrawdown = m.survivalAnnualCost > 0 ? Math.round(m.survivalAnnualCost) : 36000;
  const defaultIncome = m.globalMonthlyAvg > 0 ? Math.round(m.globalMonthlyAvg) : 8000;
  const defaultFixed = m.survivalMonthly > 0 ? Math.round(m.survivalMonthly * 0.7) : 4000;
  const defaultVar = m.survivalMonthly > 0 ? Math.round(m.survivalMonthly * 0.3) : 2000;

  // FIRE State
  const [portfolio, setPortfolio] = useState(String(defaultPort));
  const [drawdown, setDrawdown] = useState(String(defaultDrawdown));
  const [realReturn, setRealReturn] = useState('6.5');
  const [years, setYears] = useState('30');

  // 50/30/20 State
  const [incMonth, setIncMonth] = useState(String(defaultIncome));
  const [fixedExp, setFixedExp] = useState(String(defaultFixed));
  const [varExp, setVarExp] = useState(String(defaultVar));

  // 13-Week State
  const [initBal, setInitBal] = useState(String(Math.max(0, Math.round(m.netBalance))));
  const [wkInc, setWkInc] = useState(String(Math.round(m.globalWeeklyAvg || 2000)));
  const [wkExp, setWkExp] = useState(String(Math.round(m.survivalWeekly || 1400)));
  const [shockAmt, setShockAmt] = useState('1500');

  const fireRes = useMemo(() => {
    return runMonteCarloFIRE(
      parseFloat(portfolio) || 0,
      parseFloat(drawdown) || 0,
      (parseFloat(realReturn) || 6) / 100,
      0.11,
      parseInt(years, 10) || 30,
      2500
    );
  }, [portfolio, drawdown, realReturn, years]);

  const ruleRes = useMemo(() => {
    const inc = Math.max(1, parseFloat(incMonth) || 1);
    const fix = parseFloat(fixedExp) || 0;
    const vr = parseFloat(varExp) || 0;
    const inv = Math.max(0, inc - fix - vr);
    return {
      fixPct: (fix / inc) * 100,
      varPct: (vr / inc) * 100,
      invPct: (inv / inc) * 100,
      invValue: inv,
    };
  }, [incMonth, fixedExp, varExp]);

  const flow13 = useMemo(() => {
    const shock = parseFloat(shockAmt) || 0;
    const weeks = predict13WeekCashFlow(
      parseFloat(initBal) || 0,
      parseFloat(wkInc) || 0,
      parseFloat(wkExp) || 0,
      shock > 0 ? [{ weekIndex: 4, amount: shock, isIncome: false }] : []
    );
    const minWeek = weeks.reduce((min, cur) => (cur.projectedBalance < min.projectedBalance ? cur : min), weeks[0]);
    const endWeek = weeks[weeks.length - 1];
    return { weeks, minWeek, endWeek };
  }, [initBal, wkInc, wkExp, shockAmt]);

  return (
    <CadSectorFrame
      sectorKey="pfm"
      sectorIcon="👤"
      sectorName="PFM & FIRE"
      subTools={PFM_TOOLS}
      activeToolId={activeTool}
      onSelectTool={setActiveTool}
    >
      {activeTool === 'fire' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Patrimônio (R$)" value={portfolio} onChange={setPortfolio} />
            <CompactField label="Retirada Anual (R$)" value={drawdown} onChange={setDrawdown} />
            <CompactField label="Juro Real (% a.a.)" value={realReturn} onChange={setRealReturn} />
            <CompactField label="Horizonte (Anos)" value={years} onChange={setYears} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Taxa de Sucesso"
              value={`${fireRes.successRate.toFixed(1)}%`}
              sub={fireRes.successRate >= 85 ? '✓ Blindado' : '⚠️ Ajustar aporte'}
              color={fireRes.successRate >= 85 ? colors.success.main : colors.warning.main}
            />
            <CompactKpi
              label="Patrimônio Mediano"
              value={formatCurrencySmart(fireRes.medianEndingWealth)}
              sub={`em ${years} anos`}
              color="#c084fc"
            />
            <CompactKpi
              label="Cenário Pessimista (P10)"
              value={formatCurrencySmart(fireRes.p10EndingWealth)}
              sub="10% piores mercados"
              color={fireRes.p10EndingWealth > 0 ? colors.info.main : colors.danger.main}
            />
          </View>
        </View>
      )}

      {activeTool === 'rule_503020' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Renda Mensal (R$)" value={incMonth} onChange={setIncMonth} />
            <CompactField label="Fixos / Essenciais" value={fixedExp} onChange={setFixedExp} />
            <CompactField label="Estilo de Vida" value={varExp} onChange={setVarExp} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Essenciais (≤50%)"
              value={`${ruleRes.fixPct.toFixed(0)}%`}
              sub={formatCurrencySmart(parseFloat(fixedExp) || 0)}
              color={ruleRes.fixPct <= 55 ? colors.success.main : colors.danger.main}
            />
            <CompactKpi
              label="Variáveis (≤30%)"
              value={`${ruleRes.varPct.toFixed(0)}%`}
              sub={formatCurrencySmart(parseFloat(varExp) || 0)}
              color={ruleRes.varPct <= 32 ? colors.info.main : colors.warning.main}
            />
            <CompactKpi
              label="Aportes (≥20%)"
              value={`${ruleRes.invPct.toFixed(0)}%`}
              sub={`${formatCurrencySmart(ruleRes.invValue)}/mês`}
              color={ruleRes.invPct >= 20 ? colors.success.main : colors.warning.main}
            />
          </View>
        </View>
      )}

      {activeTool === 'cashflow_13w' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Saldo Inicial (R$)" value={initBal} onChange={setInitBal} />
            <CompactField label="Receita / Sem." value={wkInc} onChange={setWkInc} />
            <CompactField label="Custo / Sem." value={wkExp} onChange={setWkExp} />
            <CompactField label="Imprevisto Sem. 4" value={shockAmt} onChange={setShockAmt} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Saldo na Semana 13"
              value={formatCurrencySmart(flow13.endWeek?.projectedBalance || 0)}
              sub="Fim do trimestre"
              color={(flow13.endWeek?.projectedBalance || 0) >= 0 ? colors.success.main : colors.danger.main}
            />
            <CompactKpi
              label="Vale Mínimo de Caixa"
              value={formatCurrencySmart(flow13.minWeek?.projectedBalance || 0)}
              sub={`Semana ${flow13.minWeek?.weekIndex || 1}`}
              color={(flow13.minWeek?.projectedBalance || 0) >= 0 ? colors.info.main : colors.danger.main}
            />
            <CompactKpi
              label="Geração Líquida / Sem."
              value={formatCurrencySmart((parseFloat(wkInc) || 0) - (parseFloat(wkExp) || 0))}
              sub="Ritmo operacional"
              color="#c084fc"
            />
          </View>
        </View>
      )}
    </CadSectorFrame>
  );
}

// ── 2. 🏢 Contabilidade PME ──────────────────────────────────────────────────
const PME_TOOLS: SubToolNode[] = [
  {
    id: 'ncg',
    icon: '🔄',
    title: 'Necessidade de Capital de Giro (NCG & Estoque)',
    guide: 'Calcula o caixa operacional mínimo para sustentar o prazo de reposição (Lead Time) sem ruptura.',
  },
  {
    id: 'cfar',
    icon: '🎲',
    title: 'Fluxo de Caixa em Risco (CFaR 95% / 99%)',
    guide: 'Mede quanto o caixa da empresa pode cair em meses adversos com base nos cenários Pessimista, Base e Otimista.',
  },
  {
    id: 'payroll',
    icon: '👷',
    title: 'Multiplicador Real de Folha (Simples vs Presumido vs Real)',
    guide: 'Compara o custo efetivo de contratação CLT (FGTS, INSS Patronal, RAT/FAP e benefício fiscal).',
  },
];

export function SMBSectorWidget() {
  const db = useCoinDB();
  const m = db.metrics;
  const [activeTool, setActiveTool] = useState<string>('ncg');

  // NCG State
  const [dailyDemand, setDailyDemand] = useState(String(Math.max(300, Math.round(m.survivalDaily || 1200))));
  const [leadTime, setLeadTime] = useState('14');
  const [sigmaD, setSigmaD] = useState('250');

  // CFaR State
  const baseMonth = Math.max(10000, Math.round(m.globalMonthlyAvg || 45000));
  const [cfPess, setCfPess] = useState(String(Math.round(baseMonth * 0.6)));
  const [cfBase, setCfBase] = useState(String(baseMonth));
  const [cfOpt, setCfOpt] = useState(String(Math.round(baseMonth * 1.35)));

  // Payroll State
  const [salary, setSalary] = useState('5000');
  const [fap, setFap] = useState('1.0');

  const ncgRes = useMemo(() => {
    return calculateNCG(
      parseFloat(dailyDemand) || 0,
      parseFloat(leadTime) || 1,
      0.95,
      parseFloat(sigmaD) || 0,
      2
    );
  }, [dailyDemand, leadTime, sigmaD]);

  const cfarRes = useMemo(() => {
    return calculateCFaR([
      { probability: 0.2, cashFlow: parseFloat(cfPess) || 0 },
      { probability: 0.5, cashFlow: parseFloat(cfBase) || 0 },
      { probability: 0.3, cashFlow: parseFloat(cfOpt) || 0 },
    ]);
  }, [cfPess, cfBase, cfOpt]);

  const payRes = useMemo(() => {
    return calculatePayrollTax(parseFloat(salary) || 0, 0.02, parseFloat(fap) || 1);
  }, [salary, fap]);

  return (
    <CadSectorFrame
      sectorKey="smb"
      sectorIcon="🏢"
      sectorName="Contabilidade PME"
      subTools={PME_TOOLS}
      activeToolId={activeTool}
      onSelectTool={setActiveTool}
    >
      {activeTool === 'ncg' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Giro Diário (R$/dia)" value={dailyDemand} onChange={setDailyDemand} />
            <CompactField label="Ciclo / Prazo (Dias)" value={leadTime} onChange={setLeadTime} />
            <CompactField label="Oscilação Diária (R$)" value={sigmaD} onChange={setSigmaD} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Capital de Giro (NCG)"
              value={formatCurrencySmart(ncgRes.ncg)}
              sub="Caixa operacional total"
              color="#c084fc"
            />
            <CompactKpi
              label="Reserva de Segurança"
              value={formatCurrencySmart(ncgRes.safetyStock)}
              sub="Colchão anti-ruptura (95%)"
              color={colors.warning.main}
            />
            <CompactKpi
              label="Demanda no Ciclo"
              value={formatCurrencySmart(ncgRes.yellowZone)}
              sub={`${leadTime} dias de operação`}
              color={colors.info.main}
            />
          </View>
        </View>
      )}

      {activeTool === 'cfar' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Cenário Pessimista (20%)" value={cfPess} onChange={setCfPess} />
            <CompactField label="Cenário Base (50%)" value={cfBase} onChange={setCfBase} />
            <CompactField label="Cenário Otimista (30%)" value={cfOpt} onChange={setCfOpt} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Caixa Esperado"
              value={formatCurrencySmart(cfarRes.expectedCashFlow)}
              sub="Média ponderada"
              color={colors.success.main}
            />
            <CompactKpi
              label="Piso CFaR (95% Conf.)"
              value={formatCurrencySmart(cfarRes.cfar95)}
              sub="Pior mês provável"
              color={cfarRes.cfar95 >= 0 ? colors.warning.main : colors.danger.main}
            />
            <CompactKpi
              label="Volatilidade (σ)"
              value={formatCurrencySmart(cfarRes.stdDev)}
              sub="Oscilação operacional"
              color={colors.info.main}
            />
          </View>
        </View>
      )}

      {activeTool === 'payroll' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Salário Base CLT (R$)" value={salary} onChange={setSalary} />
            <CompactField label="Fator FAP (0.5 a 2.0)" value={fap} onChange={setFap} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Simples Nacional"
              value={formatCurrencySmart(payRes.simplesNacional.effectiveCost)}
              sub="+8% FGTS (Sem INSS Pat.)"
              color={colors.success.main}
            />
            <CompactKpi
              label="Lucro Presumido"
              value={formatCurrencySmart(payRes.lucroPresumido.effectiveCost)}
              sub="Com INSS 20% + Terceiros"
              color={colors.warning.main}
            />
            <CompactKpi
              label="Lucro Real (Líquido)"
              value={formatCurrencySmart(payRes.lucroReal.effectiveCost)}
              sub={`Abate ${formatCurrencySmart(payRes.lucroReal.taxShield)} IR/CSLL`}
              color={colors.info.main}
            />
          </View>
        </View>
      )}
    </CadSectorFrame>
  );
}

// ── 3. 🏠 Imobiliário & PropTech ─────────────────────────────────────────────
const REAL_ESTATE_TOOLS: SubToolNode[] = [
  {
    id: 'amort',
    icon: '🏦',
    title: 'Financiamento Price vs. SAC + Amortização Extra',
    guide: 'Compara a 1ª parcela, o total de juros pagos e quanto você economiza ao dar um lance de amortização extraordinária.',
  },
  {
    id: 'yield',
    icon: '📈',
    title: 'Rentabilidade Real de Aluguel (Cap Rate vs. IPCA)',
    guide: 'Calcula a Taxa Interna de Retorno (TIR) nominal e real descontando inflação (IPCA), condomínio/manutenção e vacância.',
  },
];

export function RealEstateSectorWidget() {
  const [activeTool, setActiveTool] = useState<string>('amort');

  // Amortization State
  const [pv, setPv] = useState('350000');
  const [rate, setRate] = useState('9.8');
  const [months, setMonths] = useState('360');
  const [extraPay, setExtraPay] = useState('30000');
  const [amortType, setAmortType] = useState<'sac' | 'price'>('sac');

  // Real Yield State
  const [propVal, setPropVal] = useState('500000');
  const [annualRent, setAnnualRent] = useState('36000');
  const [annualCost, setAnnualCost] = useState('6000');
  const [ipca, setIpca] = useState('4.5');

  const amortRes = useMemo(() => {
    const p = parseFloat(pv) || 0;
    const r = parseFloat(rate) || 0;
    const m = Math.max(12, parseInt(months, 10) || 360);
    const ex = parseFloat(extraPay) || 0;

    const sched = amortType === 'sac' ? generateSACSchedule(p, r, m) : generatePriceSchedule(p, r, m);
    const firstPayment = sched.schedule[0]?.payment || 0;
    const balanceAt12 = sched.schedule[Math.min(11, sched.schedule.length - 1)]?.endingBalance || p;
    const recalc = recalculateExtraordinaryAmortization(
      amortType,
      balanceAt12,
      ex,
      r,
      Math.max(1, m - 12),
      firstPayment,
      'term'
    );
    return { firstPayment, totalInterest: sched.totalInterest, recalc, monthsSaved: Math.max(0, (m - 12) - recalc.newMonthsRemaining) };
  }, [pv, rate, months, extraPay, amortType]);

  const yieldRes = useMemo(() => {
    const val = Math.max(1, parseFloat(propVal) || 1);
    const rent = parseFloat(annualRent) || 0;
    const cost = parseFloat(annualCost) || 0;
    const inf = parseFloat(ipca) || 4.5;
    const res = calculateRealYield(val, rent, cost, 5, inf + 1.5, inf, 10);
    const capRate = ((rent - cost) / val) * 100;
    return { ...res, capRate };
  }, [propVal, annualRent, annualCost, ipca]);

  return (
    <CadSectorFrame
      sectorKey="realEstate"
      sectorIcon="🏠"
      sectorName="Imobiliário"
      subTools={REAL_ESTATE_TOOLS}
      activeToolId={activeTool}
      onSelectTool={setActiveTool}
    >
      {activeTool === 'amort' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.modeSwitchRow}>
            {(['sac', 'price'] as const).map((tp) => (
              <Pressable
                key={tp}
                style={[cadStyles.miniToggle, amortType === tp && cadStyles.miniToggleActive]}
                onPress={() => setAmortType(tp)}
              >
                <Text style={[cadStyles.miniToggleText, amortType === tp && cadStyles.miniToggleTextActive]}>
                  Tabela {tp.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Valor Financiado" value={pv} onChange={setPv} />
            <CompactField label="Taxa (% a.a.)" value={rate} onChange={setRate} />
            <CompactField label="Prazo (Meses)" value={months} onChange={setMonths} />
            <CompactField label="Amort. Extra (R$)" value={extraPay} onChange={setExtraPay} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="1ª Parcela"
              value={formatCurrencySmart(amortRes.firstPayment)}
              sub={`Sistema ${amortType.toUpperCase()}`}
              color={colors.info.main}
            />
            <CompactKpi
              label="Economia de Juros"
              value={formatCurrencySmart(amortRes.recalc.interestSaved)}
              sub={`Amortizando ${formatCurrencySmart(parseFloat(extraPay) || 0)}`}
              color={colors.success.main}
            />
            <CompactKpi
              label="Parcelas Eliminadas"
              value={`-${amortRes.monthsSaved} meses`}
              sub={`Restam ${amortRes.recalc.newMonthsRemaining}m`}
              color="#c084fc"
            />
          </View>
        </View>
      )}

      {activeTool === 'yield' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Valor do Imóvel" value={propVal} onChange={setPropVal} />
            <CompactField label="Aluguel Anual" value={annualRent} onChange={setAnnualRent} />
            <CompactField label="Custos Anuais" value={annualCost} onChange={setAnnualCost} />
            <CompactField label="Inflação IPCA (%)" value={ipca} onChange={setIpca} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Cap Rate Líquido"
              value={`${yieldRes.capRate.toFixed(2)}% a.a.`}
              sub="Aluguel líquido / Imóvel"
              color={yieldRes.capRate >= 6 ? colors.success.main : colors.warning.main}
            />
            <CompactKpi
              label="TIR Real (Acima IPCA)"
              value={`${yieldRes.realIRR.toFixed(2)}% a.a.`}
              sub="Com 5% de vacância"
              color={yieldRes.realIRR > 0 ? '#c084fc' : colors.danger.main}
            />
            <CompactKpi
              label="Renda Líquida / Mês"
              value={formatCurrencySmart(((parseFloat(annualRent) || 0) - (parseFloat(annualCost) || 0)) / 12)}
              sub="Caixa livre mensal"
              color={colors.info.main}
            />
          </View>
        </View>
      )}
    </CadSectorFrame>
  );
}

// ── 4. 🚗 Frotas & Veículos ──────────────────────────────────────────────────
const VEHICLE_TOOLS: SubToolNode[] = [
  {
    id: 'cpk',
    icon: '⛽',
    title: 'Custo Real por Quilômetro (CPK Completo)',
    guide: 'Soma combustível, desgaste de pneus, manutenção preventiva, seguro e depreciação por cada km rodado.',
  },
  {
    id: 'buy_vs_app',
    icon: '🚕',
    title: 'Carro Próprio vs. Uber / Aplicativo (VPL 5 Anos)',
    guide: 'Compara o custo total de ter carro próprio contra andar de aplicativo aproveitando o tempo de viagem.',
  },
  {
    id: 'hourly',
    icon: '⏱️',
    title: 'Lucro Líquido por Hora (Autônomo / Frota / App)',
    guide: 'Desconta o custo por km e a rodagem vazia do faturamento bruto por hora para revelar o ganho real.',
  },
];

export function VehiclesSectorWidget() {
  const [activeTool, setActiveTool] = useState<string>('cpk');

  // CPK State
  const [msrp, setMsrp] = useState('95000');
  const [annualKm, setAnnualKm] = useState('18000');
  const [fuelPrice, setFuelPrice] = useState('5.89');
  const [litersPer100, setLitersPer100] = useState('9.0');

  // Hourly State
  const [grossHour, setGrossHour] = useState('45');
  const [kmPerHour, setKmPerHour] = useState('22');

  const cpkRes = useMemo(() => {
    return calculateDynamicCPK(
      parseFloat(litersPer100) || 9,
      parseFloat(fuelPrice) || 5.89,
      0.1,
      0.03,
      4,
      450,
      40000,
      2.2,
      0.08,
      0.14,
      2600,
      Math.max(1000, parseFloat(annualKm) || 18000),
      0.06,
      2,
      1000,
      1.0,
      parseFloat(msrp) || 95000,
      0.12,
      0.07,
      0.01,
      2
    );
  }, [msrp, annualKm, fuelPrice, litersPer100]);

  const compareRes = useMemo(() => {
    const val = parseFloat(msrp) || 95000;
    const km = parseFloat(annualKm) || 18000;
    return compareOwnershipVsRideshare(val, km, cpkRes.totalCPK, 0, 10, val * 0.55, 2.35, km / 30, 35, 0.5);
  }, [msrp, annualKm, cpkRes.totalCPK]);

  const hourlyRes = useMemo(() => {
    return calculateTVDENetHourly(
      parseFloat(grossHour) || 45,
      cpkRes.totalCPK,
      parseFloat(kmPerHour) || 22,
      0.35
    );
  }, [grossHour, kmPerHour, cpkRes.totalCPK]);

  return (
    <CadSectorFrame
      sectorKey="vehicles"
      sectorIcon="🚗"
      sectorName="Frotas & Veículos"
      subTools={VEHICLE_TOOLS}
      activeToolId={activeTool}
      onSelectTool={setActiveTool}
    >
      {activeTool === 'cpk' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Valor FIPE (R$)" value={msrp} onChange={setMsrp} />
            <CompactField label="Km / Ano" value={annualKm} onChange={setAnnualKm} />
            <CompactField label="Combustível (R$/L)" value={fuelPrice} onChange={setFuelPrice} />
            <CompactField label="Consumo (L/100km)" value={litersPer100} onChange={setLitersPer100} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Custo Total / Km"
              value={`R$ ${cpkRes.totalCPK.toFixed(2)}/km`}
              sub={`Combustível: R$ ${cpkRes.energyCost.toFixed(2)}`}
              color={colors.warning.main}
            />
            <CompactKpi
              label="Depreciação + Seguro"
              value={`R$ ${(cpkRes.depreciationCost + cpkRes.insuranceCost).toFixed(2)}/km`}
              sub="Custo invisível por km"
              color={colors.danger.main}
            />
            <CompactKpi
              label="Custo Mensal Total"
              value={formatCurrencySmart((cpkRes.totalCPK * (parseFloat(annualKm) || 18000)) / 12)}
              sub="TCO mensal estimado"
              color="#c084fc"
            />
          </View>
        </View>
      )}

      {activeTool === 'buy_vs_app' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Valor do Carro (R$)" value={msrp} onChange={setMsrp} />
            <CompactField label="Km Rodados / Ano" value={annualKm} onChange={setAnnualKm} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Veredito Matemático"
              value={compareRes.recommendation === 'ownership' ? '🚗 Carro Próprio' : '🚕 App / Uber'}
              sub="Melhor VPL em 5 anos"
              color={colors.success.main}
            />
            <CompactKpi
              label="VPL Carro Próprio"
              value={formatCurrencySmart(Math.abs(compareRes.valOwnership))}
              sub="Custo líquido 5 anos"
              color={colors.info.main}
            />
            <CompactKpi
              label="VPL Aplicativos"
              value={formatCurrencySmart(Math.abs(compareRes.valRideshare))}
              sub="Descontando tempo útil"
              color="#c084fc"
            />
          </View>
        </View>
      )}

      {activeTool === 'hourly' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Ganho Bruto / Hora (R$)" value={grossHour} onChange={setGrossHour} />
            <CompactField label="Km Rodados / Hora" value={kmPerHour} onChange={setKmPerHour} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Lucro Líquido / Hora"
              value={formatCurrencySmart(hourlyRes.netHourlyIncome)}
              sub={hourlyRes.warningFlag ? '⚠️ Abaixo da meta' : '✓ Rentabilidade saudável'}
              color={hourlyRes.warningFlag ? colors.danger.main : colors.success.main}
            />
            <CompactKpi
              label="Custo Veicular / Hora"
              value={formatCurrencySmart(hourlyRes.totalCostPerHour)}
              sub={`Base CPK R$ ${cpkRes.totalCPK.toFixed(2)}/km`}
              color={colors.warning.main}
            />
            <CompactKpi
              label="Projeção 160h / Mês"
              value={formatCurrencySmart(hourlyRes.netHourlyIncome * 160)}
              sub="Livre de combustível/manut."
              color="#c084fc"
            />
          </View>
        </View>
      )}
    </CadSectorFrame>
  );
}

// ── 5. ⚖️ Jurídico & Tributário ──────────────────────────────────────────────
const LEGAL_TOOLS: SubToolNode[] = [
  {
    id: 'fator_r',
    icon: '🧾',
    title: 'Otimizador Fator R (Simples Anexo III 6% vs Anexo V 15,5%)',
    guide: 'Verifica se sua folha/pró-labore atinge 28% do faturamento para cair de 15,5% para 6% no Simples, e compara com Presumido.',
  },
  {
    id: 'irpf_pgbl',
    icon: '🦁',
    title: 'Simulador IRPF 2026 (Isenção R$ 5 mil) & Teto PGBL',
    guide: 'Calcula o imposto efetivo com o novo redutor de 2026 e indica quanto aportar em PGBL (12%) para restituição máxima.',
  },
  {
    id: 'debt_corr',
    icon: '⚖️',
    title: 'Atualização de Contratos & Débitos (IPCA-E + SELIC)',
    guide: 'Corrige valores em atraso aplicando IPCA-E pré-processual e Taxa SELIC / Taxa Legal CMN.',
  },
];

export function LegalTaxesSectorWidget() {
  const db = useCoinDB();
  const m = db.metrics;
  const [activeTool, setActiveTool] = useState<string>('fator_r');

  const defaultRev12 = m.globalAnnualAvg > 0 ? Math.round(m.globalAnnualAvg) : 240000;
  const [rev12, setRev12] = useState(String(defaultRev12));
  const [payroll12, setPayroll12] = useState(String(Math.round(defaultRev12 * 0.28)));

  // IRPF State
  const [grossMonthly, setGrossMonthly] = useState(String(Math.max(5500, Math.round(m.globalMonthlyAvg || 7500))));
  const [deps, setDeps] = useState('1');
  const [healthDed, setHealthDed] = useState('6000');

  // Debt State
  const [origDebt, setOrigDebt] = useState('15000');
  const [monthsLate, setMonthsLate] = useState('18');

  const fatorRes = useMemo(() => {
    const r = parseFloat(rev12) || 0;
    const p = parseFloat(payroll12) || 0;
    const fr = calculateFatorR(p, r);
    const pres = calculateLucroPresumido(r / 4, true);
    return { fr, pres };
  }, [rev12, payroll12]);

  const irpfRes = useMemo(() => {
    const g = parseFloat(grossMonthly) || 0;
    const d = parseInt(deps, 10) || 0;
    const inss = Math.min(g * 0.11, 908.85);
    const ir = calculateIRPF2026(g, inss, d, 0);
    const prev = calibratePrevidencia(g * 12, inss * 12, d, 0, parseFloat(healthDed) || 0, g * 12 * 0.12);
    return { ir, prev };
  }, [grossMonthly, deps, healthDed]);

  const debtRes = useMemo(() => {
    const val = parseFloat(origDebt) || 0;
    const mths = Math.max(1, parseInt(monthsLate, 10) || 18);
    const now = new Date();
    const due = new Date(now.getTime() - mths * 30 * 86400000);
    const suit = new Date(now.getTime() - Math.floor(mths * 0.5) * 30 * 86400000);
    return calculateJudicialCorrection(val, due, suit, now, false);
  }, [origDebt, monthsLate]);

  return (
    <CadSectorFrame
      sectorKey="legalTaxes"
      sectorIcon="⚖️"
      sectorName="Jurídico & Tributário"
      subTools={LEGAL_TOOLS}
      activeToolId={activeTool}
      onSelectTool={setActiveTool}
    >
      {activeTool === 'fator_r' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Faturamento 12m (R$)" value={rev12} onChange={setRev12} />
            <CompactField label="Folha / Pró-Labore 12m" value={payroll12} onChange={setPayroll12} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label={`Fator R (${(fatorRes.fr.fatorR * 100).toFixed(1)}%)`}
              value={`Anexo ${fatorRes.fr.anexo}`}
              sub={`Alíquota: ${(fatorRes.fr.effectiveRate * 100).toFixed(1)}%`}
              color={fatorRes.fr.anexo === 'III' ? colors.success.main : colors.warning.main}
            />
            <CompactKpi
              label="Ajuste p/ Anexo III"
              value={fatorRes.fr.proLaboreAdjustment > 0 ? `+${formatCurrencySmart(fatorRes.fr.proLaboreAdjustment)}` : '✓ Meta 28% OK'}
              sub="Pró-labore adicional 12m"
              color={fatorRes.fr.proLaboreAdjustment === 0 ? colors.success.main : colors.info.main}
            />
            <CompactKpi
              label="Lucro Presumido"
              value={`${fatorRes.pres.effectiveRate.toFixed(1)}%`}
              sub={`${formatCurrencySmart(fatorRes.pres.totalTax)} / trim.`}
              color="#c084fc"
            />
          </View>
        </View>
      )}

      {activeTool === 'irpf_pgbl' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Renda Mensal (R$)" value={grossMonthly} onChange={setGrossMonthly} />
            <CompactField label="Dependentes" value={deps} onChange={setDeps} />
            <CompactField label="Saúde Anual (R$)" value={healthDed} onChange={setHealthDed} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="IRPF Mensal 2026"
              value={formatCurrencySmart(irpfRes.ir.effectiveIR)}
              sub={`Alíquota Efetiva: ${irpfRes.ir.effectiveRate.toFixed(1)}%`}
              color={irpfRes.ir.effectiveIR === 0 ? colors.success.main : colors.warning.main}
            />
            <CompactKpi
              label="Redutor Lei 15.270"
              value={formatCurrencySmart(irpfRes.ir.specialReducer)}
              sub="Desconto mensal faixa 5k-7.3k"
              color={colors.success.main}
            />
            <CompactKpi
              label={`Previdência: ${irpfRes.prev.recommendation}`}
              value={formatCurrencySmart(irpfRes.prev.pgblLimitContribution)}
              sub="Teto PGBL (12% renda anual)"
              color="#c084fc"
            />
          </View>
        </View>
      )}

      {activeTool === 'debt_corr' && (
        <View style={cadStyles.workspaceGrid}>
          <View style={cadStyles.inputsRow}>
            <CompactField label="Valor Original (R$)" value={origDebt} onChange={setOrigDebt} />
            <CompactField label="Meses em Atraso" value={monthsLate} onChange={setMonthsLate} />
          </View>
          <View style={cadStyles.kpiRow}>
            <CompactKpi
              label="Principal Corrigido"
              value={formatCurrencySmart(debtRes.correctedPrincipal)}
              sub="Correção IPCA-E"
              color={colors.info.main}
            />
            <CompactKpi
              label="Juros SELIC / Legal"
              value={formatCurrencySmart(debtRes.interestAccumulated)}
              sub={`${debtRes.daysPreJudicial + debtRes.daysJudicial} dias corridos`}
              color={colors.warning.main}
            />
            <CompactKpi
              label="Total Atualizado"
              value={formatCurrencySmart(debtRes.totalDue)}
              sub="Valor líquido exigível"
              color="#c084fc"
            />
          </View>
        </View>
      )}
    </CadSectorFrame>
  );
}

function CompactField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={cadStyles.fieldBox}>
      <Text style={cadStyles.fieldLabel} numberOfLines={1}>{label}</Text>
      <TextInput
        style={cadStyles.fieldInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor={colors.text.disabled}
      />
    </View>
  );
}

function CompactKpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <View style={[cadStyles.kpiCard, { borderColor: color + '55' }]}>
      <Text style={cadStyles.kpiLabel} numberOfLines={1}>{label}</Text>
      <Text style={[cadStyles.kpiValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={cadStyles.kpiSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const cadStyles = StyleSheet.create({
  frame: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    gap: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: 6,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectorBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
  },
  livePill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c084fc',
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  iconButtonsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  iconBtn: {
    width: 38,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBtnActive: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  iconBtnEmoji: {
    fontSize: 17,
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 12,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#c084fc',
  },
  saveBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  saveBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  guideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  guideIconBox: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e9d5ff',
  },
  guideText: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 14,
  },
  stageBody: {
    gap: 8,
  },
  workspaceGrid: {
    gap: 8,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniToggle: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
  },
  miniToggleActive: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  miniToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  miniToggleTextActive: {
    color: '#fff',
  },
  inputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fieldBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
    paddingVertical: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    minWidth: 96,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  kpiSub: {
    fontSize: 9,
    color: colors.text.tertiary,
  },
});
