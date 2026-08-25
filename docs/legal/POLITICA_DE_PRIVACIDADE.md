# Política de Privacidade & Governança de Dados (LGPD) — Heiss-Lab, LogicDefense & Assistente Moeda

> **Versão:** 2.1 (Jogos, Aulas/Vídeos IA, Turso libSQL & Zero PII)  
> **Data de Atualização:** 25 de Agosto de 2026  
> **URL Pública:** https://heisslab.com.br/privacidade  

---

## 1. Introdução & Conformidade com a LGPD
A **Heiss-Lab** adota o princípio de *Privacy by Design*. Este documento regulamenta o tratamento de dados no portal **Heiss-Lab / LogicDefense**, em seus jogos educativos, no repositório de aulas matemáticas, no aplicativo móvel **Assistente Moeda** e nas APIs correlatas, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).

## 2. Arquitetura de Isolamento (Turso libSQL & Local-First)
* **Local-First:** Planilhas e lançamentos primários residem no armazenamento do dispositivo móvel/navegador do próprio usuário.
* **Turso libSQL:** O backend opera por chaves de planilha (`X-Spreadsheet-Key`). Não há banco de dados com e-mails, CPFs ou identidades civis dos usuários atrelados às transações financeiras.
* **Segregação Multilocatário:** Cada chave opera em escopo criptograficamente segregado.

## 3. Dados Tratados & Proteção de Menores (LGPD Art. 14)
* **Chaves de Licença e API:** Tokens aleatórios para autenticação e verificação de cota.
* **Lançamentos Financeiros:** Valores numéricos e descrições inseridos voluntariamente pelo usuário.
* **Jogos Educativos (Logic Defense, Ascension, Invaders, Friction):** Leaderboards com codinomes anônimos voluntários. Nenhum dado pessoal de menores de idade é coletado.
* **Repositório de Aulas & Vídeos:** Acesso 100% aberto e anônimo, sem exigência de cadastro ou rastreamento de alunos.

## 4. O Usuário como Controlador de Dados (Data Controller)
Caso o usuário utilize o Assistente Moeda, utilitários de laboratório ou APIs para gerenciar finanças de clientes próprios ou terceiros, o **Usuário é o único e exclusivo Controlador dos Dados**, responsável por colher o consentimento e assegurar a base legal (Art. 7º da LGPD). A Heiss-Lab atua como **Operadora Tecnológica (Data Processor)** fornecendo o software *AS IS*.

## 5. Inteligência Artificial (Stateless) & Produção de Vídeos
* As consultas ao Chat de IA são trafegadas via HTTPS e computadas temporariamente em memória, sendo descartadas imediatamente e **jamais utilizadas para treinamento de modelos de IA públicos**.
* Os vídeos didáticos e recursos audiovisuais do repositório de aulas são produzidos com apoio de ferramentas de IA generativa para enriquecimento didático, sem captura de biometria ou dados dos estudantes.

## 6. Pagamentos & Gateways
Processamento seguro via Google Play / RevenueCat (Mobile) e Stripe (Web). Sem custódia de dados bancários pela Heiss-Lab.

## 7. Direitos do Titular & Exclusão de Dados
* O usuário pode exportar seus dados a qualquer momento em CSV/JSON.
* A exclusão de dados é instantânea através da limpeza de dados locais no app ou desativação da chave de API no backend.

## 8. Contato do Encarregado de Dados (DPO)
* **Website:** https://heisslab.com.br
* **E-mail do DPO:** augustoheiss@gmail.com
