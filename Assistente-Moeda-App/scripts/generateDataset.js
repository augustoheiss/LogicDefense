const fs = require('fs');
const path = require('path');

function generateDataset() {
  const rows = [];

  const formatDate = (y, m, d) => {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const startYear = 2016;
  const endYear = 2026;
  const endMonth = 7;

  let odometer = 12000;
  const sacTotalMonths = 120;
  const sacLoanAmount = 240000;
  const sacPrincipalAmortization = sacLoanAmount / sacTotalMonths;
  let sacInstallmentCount = 0;

  for (let year = startYear; year <= endYear; year++) {
    const maxM = (year === endYear) ? endMonth : 12;
    for (let month = 1; month <= maxM; month++) {
      const yearIdx = year - startYear;

      // 1. Monthly PME Revenue
      const baseRev = 45000 + (yearIdx * 8000) + ((month % 3) * 2500);
      const massaSalarial12 = 80000 + (yearIdx * 12000);
      const receitaBruta12 = baseRev * 12;
      rows.push({
        date: formatDate(year, month, 5),
        value: baseRev.toFixed(2),
        description: `Faturamento PME Mensal ${month}/${year}`,
        entryType: 'revenue',
        category: 'Receita de Vendas',
        tags: 'ncg,welford,rolling_margin',
        metadataJson: JSON.stringify({
          massa_salarial_12: massaSalarial12,
          receita_bruta_12: receitaBruta12,
        }),
      });

      // 2. Monthly Pro-Labore & Payroll (Fator R)
      const proLaboreVal = 6000 + (yearIdx * 900);
      rows.push({
        date: formatDate(year, month, 8),
        value: proLaboreVal.toFixed(2),
        description: `Folha Pro-Labore Administrador ${month}/${year}`,
        entryType: 'expense',
        category: 'Retiradas',
        tags: 'fator_r,irpf_2026,simples_nacional',
        metadataJson: JSON.stringify({
          massa_salarial_12: massaSalarial12,
          receita_bruta_12: receitaBruta12,
        }),
      });

      // 3. Real Estate SAC Installment (120 months)
      if (sacInstallmentCount < sacTotalMonths) {
        sacInstallmentCount++;
        const remainingBalance = sacLoanAmount - (sacInstallmentCount - 1) * sacPrincipalAmortization;
        const interest = remainingBalance * 0.0075;
        const installmentVal = sacPrincipalAmortization + interest;
        rows.push({
          date: formatDate(year, month, 12),
          value: installmentVal.toFixed(2),
          description: `Financiamento Imóvel SAC Parcela ${sacInstallmentCount}/120`,
          entryType: 'expense',
          category: 'Imóveis',
          tags: 'sistema_sac,cap_rate,ross_heidecke',
          metadataJson: JSON.stringify({
            property_value: 350000,
            monthly_rent: 2100,
            installment_no: sacInstallmentCount,
            interest_paid: parseFloat(interest.toFixed(2)),
          }),
        });
      }

      // 4. Monthly Offshore FIRE Contribution
      const fireVal = 2500 + (yearIdx * 500);
      rows.push({
        date: formatDate(year, month, 18),
        value: fireVal.toFixed(2),
        description: `Aporte Fundo Offshore Swissquote ${month}/${year}`,
        entryType: 'deposit',
        category: 'Investimentos Externos',
        tags: 'fbar,fatca,sankey,monte_carlo',
        metadataJson: JSON.stringify({
          jurisdicao_pais: 'Suiça',
          moeda: 'USD',
        }),
      });

      // 5. Weekly Fleet Abastecimento & CPK (2x per month)
      odometer += 850;
      rows.push({
        date: formatDate(year, month, 14),
        value: (240 + (month * 5)).toFixed(2),
        description: `Abastecimento Posto Shell CAR01 (${odometer} km)`,
        entryType: 'expense',
        category: 'Frotas & Veículos',
        tags: 'cpk,weibull,ubi,tco_vehicle',
        metadataJson: JSON.stringify({
          idveiculo: 'CAR01',
          perfil_msrp: 65000,
          odometer,
        }),
      });

      odometer += 900;
      rows.push({
        date: formatDate(year, month, 27),
        value: (255 + (month * 6)).toFixed(2),
        description: `Abastecimento Posto Ipiranga CAR01 (${odometer} km)`,
        entryType: 'expense',
        category: 'Frotas & Veículos',
        tags: 'cpk,weibull,ubi,tco_vehicle',
        metadataJson: JSON.stringify({
          idveiculo: 'CAR01',
          perfil_msrp: 65000,
          odometer,
        }),
      });

      // 6. Quarterly Judicial Debt / DAS Taxes
      if (month % 3 === 0) {
        rows.push({
          date: formatDate(year, month, 22),
          value: (3500 + (yearIdx * 400)).toFixed(2),
          description: `Depósito Judicial Trabalhista (ADC 58) Q${month / 3}/${year}`,
          entryType: 'deposit',
          category: 'Ações Judiciais',
          tags: 'taxa_legal,adc_58,simples_nacional',
          metadataJson: JSON.stringify({
            data_ajuizamento: `${year - 1}-04-10`,
            data_vencimento: `${year}-01-15`,
          }),
        });
      }
    }
  }

  return rows;
}

function buildCSVString(rows) {
  const headers = ['date', 'value', 'description', 'entryType', 'category', 'tags', 'metadata_json'];
  const lines = [headers.join(',')];

  rows.forEach((row) => {
    const cols = [
      row.date,
      row.value,
      `"${row.description.replace(/"/g, '""')}"`,
      row.entryType,
      `"${row.category.replace(/"/g, '""')}"`,
      `"${row.tags.replace(/"/g, '""')}"`,
      `"${row.metadataJson.replace(/"/g, '""')}"`,
    ];
    lines.push(cols.join(','));
  });

  return lines.join('\n');
}

const rows = generateDataset();
const csvContent = buildCSVString(rows);
const targetPath = path.join(__dirname, '../src/data/Master_10Year_Dataset.csv');
fs.writeFileSync(targetPath, csvContent, 'utf-8');
console.log(`Successfully generated ${rows.length} dense rows into ${targetPath}`);
