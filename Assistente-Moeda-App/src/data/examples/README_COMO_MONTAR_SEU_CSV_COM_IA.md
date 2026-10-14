# 🤖 Guia Prático: Como Montar seu Próprio CSV no Assistente Moeda usando sua IA

> ⚠️ **AVISO DE PRIVACIDADE E SEGURANÇA**: Todos os 8 arquivos `.csv` desta pasta (`src/data/examples/`) contêm **dados 100% fictícios e sintéticos**, criados exclusivamente para demonstrar os recursos matemáticos, gráficos, motores setoriais e formatos de importação/exportação do **Assistente Moeda**. Nenhum dado pessoal ou sensível real está presente nestes modelos.

---

## 📂 Catálogo de Planilhas de Exemplo Disponíveis

Você pode abrir, testar na planilha, editar, exportar novamente ou usar qualquer um dos 8 arquivos abaixo como **molde para sua própria IA** (ChatGPT, Claude, Gemini, DeepSeek ou LLM local como Ollama/LM Studio):

| Arquivo | Perfil / Caso de Uso | Preset & Setores Ativados | Destaques que Você Verá no App |
| :--- | :--- | :--- | :--- |
| **`01_Orcamento_Familiar_Sobrevivencia.csv`** | Orçamento Familiar & Controle de Caixa | `survival` (Sem setores extras) | Salário, Vale-Alimentação, Aluguel, Supermercado, Reserva de Emergência, Termômetro de Sobrevivência e Metas Diárias/Mensais. |
| **`02_Autonomo_Freelancer_BancoDeTempo.csv`** | Autônomo, Freelancer & Renda Variável | `freelancer` | Receitas por projetos PJ, **Banco de Tempo** (`waiver` / renúncia consciente), **Rateio Anual** (`period_start`/`period_end` 12 meses) e Imposto DAS. |
| **`03_Motorista_App_Frota_Veiculos.csv`** | Motorista de App & Frota TCO | `freelancer` + Setor `vehicles` | Corridas Uber/99/iFood, Combustível (`cpk,fuel`), Manutenção Preventiva (`weibull`), Seguro/IPVA (`ubi,tco_vehicle`) e **Milhas/KM** (`milhas_km`). |
| **`04_Investidor_Carteira_FIRE.csv`** | Investidor & Carteira FIRE | `investor` (`balanced`) | Aportes com `ticker`, `quantity` e `unitPrice` (`SELIC`, `IPCA2035`, `HGLG11`, `MXRF11`, `KNCR11`, `WEGE3`, `TAEE11`, `IVVB11`, `WRLD11`) + Dividendos (`Proventos`). |
| **`05_PME_Comercio_Socios_Contabilidade.csv`** | PME, Comércio & Sócios | `smb` + `smb_accounting` + `legal_taxes` | Vendas, CMV/Estoque (`ncg`), Folha CLT (`fap_rat,payroll_tax`), Pró-Labore (`fator_r`), Simples Nacional e **Conta-Corrente de Sócios** (`partner_in` / `partner_out`). |
| **`06_Imoveis_Alugueis_Financiamento_SAC.csv`** | Imóveis, Aluguéis & Financiamento SAC | `investor` (`income`) + `real_estate` | Receita de Aluguéis (`rental_income,cap_rate`), Parcela SAC (`sistema_sac`), Tabela Price (`tabela_price`) e Fundo de Reforma (`ross_heidecke`). |
| **`07_Profissional_Liberal_Medico_Advogado_FatorR.csv`** | Profissional Liberal, Médico & Advogado | `smb` + `legal_taxes` + `smb_accounting` | Consultas/Honorários, Pró-Labore estratégico (`fator_r >= 28%` para Anexo III), Livro-Caixa (`livro_caixa,irpf_2026`), PGBL (`pgbl`) e Reserva Contábil. |
| **`08_Modelo_Base_Universal_Para_IA.csv`** | Modelo Universal Autodocumentado p/ IA | `investor` + Todos os 4 setores | Contém **1 linha comentada de cada `entryType`** (`revenue`, `expense`, rateio anual, `deposit` caixa, `deposit` ativo com ticker, `waiver`, `partner_in`, `partner_out`, `unresolved`). |

---

## 🚀 Passo a Passo: Como Usar com Seus Dados Sensíveis e Sua Própria IA

1. **Escolha o Perfil Ideal**:
   - No aplicativo, abra **Planilhas de Exemplo & Modelos p/ IA** (disponível na aba **Planilha**, na tela **Hoje**, no **Seletor de Planilhas** ou em **Ajustes > Segurança & Backups**).
2. **Teste Primeiro no App (Opcional)**:
   - Clique em **🆕 Abrir como Nova Planilha** para explorar os gráficos, indicadores, metas e relatórios daquele perfil sem misturar com seus dados atuais.
   - Você também pode clicar em **📤 Exportar** na aba Planilha para ver como o sistema gera arquivos `.csv` (Backup Completo v3 ou Padrão Excel/Sheets), resumos de WhatsApp ou formato **Agent-Compact**.
3. **Copie o Prompt + Modelo para sua IA**:
   - Clique em **🤖 Copiar Prompt + Modelo p/ IA** (ou copie o conteúdo do arquivo `08_Modelo_Base_Universal_Para_IA.csv`).
   - Cole na sua IA de preferência (ou em uma IA rodando localmente para máxima privacidade) junto com seus extratos bancários, faturas de cartão ou anotações pessoais.
4. **Importe o Resultado de Volta**:
   - Copie o bloco CSV gerado pela sua IA.
   - No Assistente Moeda, abra **📥 Importar CSV**, cole o texto e escolha:
     - **🆕 Criar Nova Planilha** (recomendado para começar limpo),
     - **➕ Acumular (Merge)** na planilha atual, ou
     - **🔄 Substituir Tudo** na planilha atual.

---

## 📋 Referência Rápida das Colunas (`## ROWS ##`)

```csv
id,month,day,dateISO,entryType,category,subCategory,description,amount,plannedAmount,variance,status,paymentMethod,recurring,tags,notes,ticker,quantity,unitPrice,period_start,period_end,monthlyValue,monthCount,counterparty,confidenceScore,metadataJson
```

### Valores Válidos de `entryType`:
- `revenue` — Receita / Entrada (salário, vendas, dividendos, aluguéis recebidos). Use `amount` positivo.
- `expense` — Despesa / Saída (contas, compras, impostos, parcelas). Use `amount` positivo (o app subtrai automaticamente).
- `deposit` — Aporte / Investimento / Reserva. Se for ativo de bolsa/renda fixa, preencha `ticker`, `quantity` e `unitPrice`.
- `waiver` — Economia Consciente / Banco de Tempo (gasto evitado ou horas dedicadas a estudo/projetos próprios).
- `partner_in` — Aporte de Sócio na empresa / projeto.
- `partner_out` — Retirada / Distribuição de Lucros para Sócio.
- `unresolved` — Lançamento pendente de confirmação ou conciliação.

### Valores Válidos de `status`:
- `paid` (Pago / Recebido)
- `pending` (Pendente / Agendado)
- `late` (Atrasado)
- `cancelled` (Cancelado)
