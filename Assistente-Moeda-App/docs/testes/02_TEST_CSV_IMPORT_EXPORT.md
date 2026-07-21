# Relatório de Teste 02: Reconciliação e Integridade do Motor CSV In-Place

## 📋 Resumo Executivo
O **Relatório de Teste 02** documenta a validação completa do motor unificado de importação/exportação CSV (`src/utils/csvEngine.ts`), garantindo carregamento direto em memória (*in-place*), precisão de centavos em números inteiros (`BIGINT / amount_in_cents`) sem perda de ponto flutuante, detecção automática de tags de setores para ativação de widgets via `SectorGuard`, e fidelidade absoluta no ciclo de importação e exportação (*roundtrip*).

---

## 🎯 Arquitetura de Reconciliação In-Place
- **Sem tabelas descartáveis ou isoladas**: Os registros importados são ingeridos diretamente na tabela ativa do `useCoinDB`.
- **Detecção de Delimitadores**: Suporte automático a vírgula (`,`), ponto e vírgula (`;`) e tabulação (`\t`).
- **Normalização de Datas**: Conversão flexível de formatos brasileiros (`DD/MM/YYYY`) e ISO (`YYYY-MM-DD`).

---

## 🧮 Precisão Numérica de Centavos Inteiros (`amount_in_cents`)
Para evitar erros cumulativos de ponto flutuante comuns em JS (`0.1 + 0.2 !== 0.3`), o Assistente Moeda trata a persistência e reconciliação dos valores de moeda em centavos inteiros:

$$\text{amount\_in\_cents} = \text{Math.round}(\text{value} \times 100)$$

Exemplos de Validação do Teste:
| Valor Nominal (R$) | Valor em Centavos (`BIGINT`) | Precisão Flutuante Erro |
| :--- | :--- | :--- |
| R$ 150.000,00 | `15000000` | `0.0000%` |
| R$ 120,55 | `12055` | `0.0000%` |
| R$ 0,01 | `1` | `0.0000%` |
| R$ 999.999,99 | `99999999` | `0.0000%` |

---

## 🏷️ Detecção e Autoativação de Setores
O parser lê dinamicamente tags do cabeçalho e etiquetas da coluna `tags` ou `metadata_json` ativando cumulativamente os 9 setores do sistema:
- `smb_accounting` (`ncg`, `welford`, `fap_rat`, `massa_salarial_12`, `receita_bruta_12`)
- `legal_taxes` (`fator_r`, `taxa_legal`, `irpf_2026`, `simples_nacional`, `adc_58`)
- `real_estate` (`sistema_sac`, `tabela_price`, `cap_rate`, `ross_heidecke`)
- `vehicles` (`cpk`, `weibull`, `ubi`, `tipo_viagem`, `perfil_msrp`)
- `personal_finance` (`fbar`, `fatca`, `sankey`, `monte_carlo`)

---

## 🔄 Teste de Fidelidade Roundtrip
1. **Importação**: Ingestão do texto CSV bruto em objetos `TableRow`.
2. **Exportação**: Geração de texto CSV formatado via `exportRowsToCSV(rows)`.
3. **Re-importação**: Leitura do CSV exportado e comparação estrita campo a campo.
4. **Resultado**: **100% de paridade e fidelidade**.

---

## ✅ Conclusão e Status
- **Arquivo de Testes**: [csvEngine.test.ts](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/Assistente-Moeda-App/src/tests/csvEngine.test.ts)
- **Compilação**: `npx tsc --noEmit` executado com **0 erros**.
