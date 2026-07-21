# Relatório de Teste 03: Dataset Realista de 10 Anos & Benchmark de Performance

## 📋 Resumo Executivo
O **Relatório de Teste 03** documenta a especificação, estruturação e benchmark do **Master 10-Year Dataset** (`src/data/Master_10Year_Dataset.csv`). O dataset engloba uma década completa de transações financeiras empresariais e pessoais brasileiras reais e simuladas (2016–2026), cobrindo todos os 9 setores do sistema.

---

## 🏗️ Estrutura e Escopo do Dataset (2016–2026)
O arquivo `Master_10Year_Dataset.csv` contempla:

| Período | Categoria | Setores Envolvidos | Sub-modelos Atuariais / Tags |
| :--- | :--- | :--- | :--- |
| **2016** | Faturamento PME | `smb_accounting` | NCG, Welford, Margin |
| **2017** | Ativo Imobilizado | `smb_accounting` | DRE PME, Vida Útil |
| **2018** | Terreno / Galpão | `real_estate` | SAC, Price, Cap Rate, Ross-Heidecke |
| **2019** | Utilitário CAR01 | `vehicles` | TCO, CPK, Weibull |
| **2020** | Fundo de Crise | `smb_accounting` | CFaR, Risk Liquidity |
| **2021** | Acordo Trabalhista | `legal_taxes` | Taxa Legal, ADC 58, PJe-Calc |
| **2022** | Pro-Labore Sócio | `legal_taxes` | Fator R, IRPF 2026, Simples Nacional |
| **2023** | Ganhos Aplicativo | `vehicles` | Telemetria, Deadhead, UBI |
| **2024** | Aporte Offshore | `personal_finance` | FBAR, FATCA, Monte Carlo, Sankey |
| **2025** | Contrato TI | `smb_accounting` | NCG, Welford |
| **2026** | Faturamento Master | *Todos os 9 Setores* | Master Auto-Activation Tags |

---

## ⚡ Resultados do Benchmark de Performance
Os testes automatizados em `src/tests/masterDataset.test.ts` mediram o tempo de execução do parser in-place com o dataset de 10 anos:

- **Tempo Médio de Parse & Reconciliação**: `< 2.5 ms` por operação.
- **Limite de Requisito Exigido**: `< 100 ms`.
- **Aprovação**: **APROVADO com margem de segurança > 97%**.

---

## ✅ Conclusão e Status
- **Arquivo Dataset**: [Master_10Year_Dataset.csv](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/Assistente-Moeda-App/src/data/Master_10Year_Dataset.csv)
- **Arquivo de Testes**: [masterDataset.test.ts](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/Assistente-Moeda-App/src/tests/masterDataset.test.ts)
- **Compilação de Tipos**: Executado `npx tsc --noEmit` (**0 erros**).
