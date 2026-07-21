# Plano de Pesquisa: Sovereign PropTech Copywriting Strategy

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Investimentos Imobiliários, Copywriting e Growth Hacking**, elaborado a partir do estudo do artigo *"O Manifesto da Soberania Patrimonial: Triggers Psicológicos e Fatores de Adoção de Dashboards Financeiros por Investidores Imobiliários Premium"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Real Estate / Financiamento e Imóveis (Real Estate & Mortgages) - Foco em Copywriting, Growth Hacking e Segurança.
* **Visão Geral:** O estudo aborda a recente crise de confiança no setor de PropTechs (nuvem centralizada) devido a ações antitruste do DOJ/FTC (RealPage/Greystar) por compartilhamento de dados privados em tempo real e investigações de privacidade. Propõe-se um posicionamento baseado na **Soberania Patrimonial** com arquitetura *Local-First* (CRDTs), Criptografia *Zero-Knowledge* no lado do cliente, isolamento financeiro "LLC-First" para proteção do escudo corporativo, simuladores avançados de custos reais de rotatividade (*Tenant Turnover*) e técnicas de design de interface voltadas para a regulação emocional do investidor.

---

## 🧮 Mathematical Models & Formulas

### 1. Equação do Custo Real de Rotatividade de Inquilinos ($C_{\text{rotatividade}}$)
Mede o impacto total gerado pela saída de um locatário, dividindo o custo nas seguintes variáveis:
$$C_{\text{rotatividade}} = C_{\text{vacatura}} + C_{\text{reabilitação}} + C_{\text{promoção}} + C_{\text{administrativo}} + C_{\text{absorção}}$$

Onde:
* **$C_{\text{vacatura}}$ (Perda por Vacatura - Peso: 40% a 50%):**
  $$C_{\text{vacatura}} = V_{\text{meses}} \times \text{AluguelMensal}$$
* **$C_{\text{reabilitação}}$ (Custos de Reabilitação - Peso: 20% a 30%):**
  Despesas com pinturas, limpeza profunda e reparos pós-desocupação.
* **$C_{\text{promoção}}$ (Custos de Promoção - Peso: 15% a 20%):**
  Comissões de imobiliárias e anúncios.
* **$C_{\text{administrativo}}$ (Custos Administrativos - Peso: 5% a 10%):**
  Custos contratuais, jurídicos e taxas de triagem de novos inquilinos.
* **$C_{\text{absorção}}$ (Custos Fixos de Absorção - Peso: 5% a 10%):**
  Condomínio, impostos prediais (IPTU) e tarifas de utilidades básicas durante a inatividade do imóvel.

---

### 2. Criptografia no Cliente e Derivação de Chaves
Garante que a empresa desenvolvedora não consiga descriptografar os dados financeiros:
* **Algoritmo principal:** AES-256-GCM.
* **Derivação de chaves:** PBKDF2 com hashing SHA-256, salting aleatório por utilizador e contagem de iterações mínima de 310.000:
  $$\text{Chave} = \text{PBKDF2}(\text{FrasePasseMestra}, \text{Salt}, \text{Iterações} \ge 310.000, \text{Comprimento} = 256)$$

---

### 3. Downside Moment Design (Outperformance Relativa)
Para mitigar a ansiedade financeira em correções de mercado, o dashboard recalcula o desempenho comparativo do portfólio em relação aos benchmarks locais ($BM$):
$$\Delta_{\text{outperformance}} = R_{\text{carteira}} - R_{\text{benchmark}}$$
Se o mercado cai $12\%$ ($R_{\text{benchmark}} = -12\%$) e a carteira recua $8\%$ ($R_{\text{carteira}} = -8\%$), a interface exibe de forma destacada e positiva uma outperformance de $+4\%$, suavizando o estresse do investidor.

---

## 💡 Immediate Implementation Ideas

1. **Calculadora Gratuita de Risco de Custos Ocultos de Rotatividade:**
   Criar uma ferramenta gratuita no site (micro-ferramenta local-first) baseada na equação de rotatividade. O investidor insere a vacância e o aluguel para descobrir as perdas reais estimadas de € 4.000 por unidade. Isso serve como um excelente gancho de Growth Hacking.
2. **Dashboard com Reconciliação LLC-First Isolada:**
   Criar um componente que exibe a árvore de participações de LLCs e Trusts, garantindo a validação de que os caixas não se misturam (evitando a desconsideração da personalidade jurídica).
3. **Módulo Web Crypto API Local:**
   Implementar diretamente no React a criptografia AES-256-GCM usando a biblioteca nativa Web Crypto API do navegador para gerar as chaves localmente.
4. **Implementação de Gráfico Relativo de Desempenho (Downside Context):**
   Adicionar ao dashboard de performance um switch para exibir a variação patrimonial "em relação ao mercado" (exibindo a carteira verde quando sua queda for inferior ao mercado).

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Padrões de Sincronização Descentralizada (Yjs/Automerge):** Qual biblioteca CRDT apresenta melhor compatibilidade de performance com bases estruturadas locais (como SQLite/DuckDB via IndexedDB) para garantir atualizações multi-dispositivo sem conflitos?
* **O Impacto Regulatório da Triagem com IA Local-First:** Com restrições regulatórias crescentes sobre coleta de dados pessoais na triagem de inquilinos (ex: OAIC), de que forma a IA executada localmente pode avaliar perfis sem expor os proprietários a litígios por armazenamento excessivo de informações confidenciais?
* **Segurança na Custódia de Frase-Passe:** Como ajudar o investidor premium a não perder a Frase-Passe Mestra (uma vez que em arquiteturas Zero-Knowledge puras não existe botão "Recuperar Senha") sem centralizar chaves?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Simulador de Rotatividade e LLCs
```csv
llc_name,property_id,monthly_rent,vacancy_months,rehab_exp,marketing_exp,legal_exp,fixed_carrying_exp
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo de Soberania/Imobiliário):
* **Cabeçalhos de Colunas / Chaves:** `vacancy_months`, `rehab_exp`, `marketing_exp`, `legal_exp`, `fixed_carrying_exp`, `llc_name`
* **Expressões e Metadados do Conteúdo:**
  * `RealPage`, `Greystar`, `Antitrust`, `DOJ antitrust`, `Rent Advice Statute`, `FTC Section 5`
  * `Soberania Patrimonial`, `Sovereign Property`, `Zero-Knowledge`, `Client-Side Encryption`, `AES-256-GCM`, `PBKDF2`
  * `LLC-First`, `Véu Corporativo`, `Corporate Veil`, `Family Office`, `HNWI`
  * `Tenant Turnover`, `Rotatividade de Inquilinos`, `Custos de Rotatividade`, `Vacatura`, `Junk Fees`
  * `Downside Moment`, `Outperformance Relativa`, `Zustand CRDT`, `Yjs`, `Automerge`
