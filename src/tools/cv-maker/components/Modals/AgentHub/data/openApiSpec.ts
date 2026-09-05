/**
 * Especificação OpenAPI 3.1.0 completa do motor CV Maker 2.0 & Heiss-Lab AI Engine.
 */
export function getOpenApiSpecJson(): string {
  return JSON.stringify(
    {
      openapi: '3.1.0',
      info: {
        title: 'CV Maker 2.0 & Heiss-Lab AI Engine (100% Agent-Native & Nível 2 Multi-Agent)',
        version: '3.1.0',
        description:
          'API de Renderização, Alfaiataria ATS e Compilação de Currículos de Alta Fidelidade para Agentes de IA (Claude, Cursor, Antigravity, ChatGPT). O seu agente gera os 5 YAMLs + a 6ª Versão Oficial Master e a API compila em Super Dashboard HTML Standalone e Pacote ZIP com zero custo de tokens de servidor.',
      },
      servers: [
        { url: 'https://ocorrencias-pdf-writer.onrender.com', description: 'Servidor Primário (Render)' },
        { url: 'https://heiss-cv-engine.onrender.com', description: 'Servidor Secundário (Failover)' },
      ],
      paths: {
        '/api/v1/cv/compile': {
          post: {
            summary: 'Compila os 5 arquétipos + 6ª Versão Master em Super Dashboard HTML e ZIP',
            description:
              'Recebe os YAMLs gerados pelo Agente (incluindo official_master, professional, architect, historian, didactic e alien) e compila instantaneamente em um Dashboard HTML interativo com fotos, enquadramento dinâmico, 5 temas, 10 modelos A4 (incluindo Canvas Livre), customizador de cores/texturas e botão nativo de impressão A4.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      official_master: { type: 'string', description: 'YAML da 6ª Versão Oficial Master Definitiva' },
                      professional: { type: 'string', description: 'YAML do arquétipo Executivo / IBM Lead' },
                      architect: { type: 'string', description: 'YAML do arquétipo Arquiteto de Soluções IA' },
                      historian: { type: 'string', description: 'YAML do arquétipo Biográfico / Narrativo' },
                      didactic: { type: 'string', description: 'YAML do arquétipo Didático / Learning Velocity' },
                      alien: { type: 'string', description: 'YAML do arquétipo Observador Extraterrestre' },
                      default_theme: { type: 'string', enum: ['executive', 'creative', 'minimalist', 'white', 'terminal'], default: 'executive' },
                      default_layout: { type: 'string', enum: ['modular', 'linear', 'sidebar', 'compact_split', 'editorial_accent', 'corporate_timeline', 'warm_magazine', 'hero_matrix', 'dynamic_math', 'canvas_livre'], default: 'dynamic_math' },
                      texture: { type: 'string', enum: ['none', 'bg-grid-tech', 'bg-luxury-minimal', 'bg-geometric-line', 'bg-corporate-waves', 'bg-stationery-clean', 'bg-technical-blueprint'], default: 'none' },
                      format: { type: 'string', enum: ['html', 'zip', 'json'], default: 'html' },
                      filename: { type: 'string', default: 'curriculos_completos' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Super Dashboard HTML Standalone ou Pacote .ZIP retornado' },
            },
          },
        },
        '/api/v1/cv/synthesize': {
          post: {
            summary: 'Nível 2 — Síntese Master Oficial Automática via Gemini Pro / BYOK',
            description: 'Recebe os 5 YAMLs e gera autonomamente a 6ª Versão Oficial Master utilizando fórmula X-Y-Z e zero alucinação.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      professional: { type: 'string' },
                      architect: { type: 'string' },
                      historian: { type: 'string' },
                      didactic: { type: 'string' },
                      alien: { type: 'string' },
                      job_description: { type: 'string' },
                      target_company: { type: 'string' },
                      language: { type: 'string', default: 'pt' },
                    },
                    required: ['professional', 'architect', 'historian', 'didactic', 'alien'],
                  },
                },
              },
            },
            responses: { '200': { description: 'YAML da 6ª Versão Oficial Master gerado' } },
          },
        },
        '/api/v1/cv/render': {
          post: {
            summary: 'Renderiza 1 YAML em HTML Standalone de Alta Fidelidade',
            description: 'Converte um esquema YAML para HTML puro com estilos embutidos, suporte a avatar/framing, escolha de Layout A4 01 a 10 (incluindo Canvas Livre), texturas IA e impressão A4 perfeita.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      yaml_content: { type: 'string', description: 'YAML do currículo' },
                      theme: { type: 'string', enum: ['executive', 'creative', 'minimalist', 'white', 'terminal'], default: 'executive' },
                      layout: { type: 'string', enum: ['modular', 'linear', 'sidebar', 'compact_split', 'editorial_accent', 'corporate_timeline', 'warm_magazine', 'hero_matrix', 'dynamic_math', 'canvas_livre'], default: 'dynamic_math' },
                      texture: { type: 'string', enum: ['none', 'bg-grid-tech', 'bg-luxury-minimal', 'bg-geometric-line', 'bg-corporate-waves', 'bg-stationery-clean', 'bg-technical-blueprint'], default: 'none' },
                      view_mode: { type: 'string', enum: ['cv', 'cover_letter', 'both'], default: 'cv' },
                      format: { type: 'string', enum: ['html', 'yaml', 'zip', 'json'], default: 'html' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'Arquivo HTML, YAML ou ZIP retornado' } },
          },
        },
        '/api/v1/cv/layouts': {
          get: {
            summary: 'Retorna o catálogo dos 10 modelos A4 declarativos (incluindo Canvas Livre)',
            description: 'Lista todos os 10 Blueprints disponíveis com metadados de layout, colunas e suporte a foto/cover letter.',
            responses: { '200': { description: 'Catálogo de layouts em JSON' } },
          },
        },
        '/api/v1/cv/themes': {
          get: {
            summary: 'Retorna a lista de temas visuais, paletas e texturas de fundo IA',
            description: 'Lista os 5 temas de design e 7 texturas gráficas disponíveis no motor de renderização.',
            responses: { '200': { description: 'Lista de temas e texturas em JSON' } },
          },
        },
        '/api/v1/cv/prompts': {
          get: {
            summary: 'Retorna as diretrizes das 5 personas + síntese master para o Agente',
            description: 'Retorna os System Prompts completos (JSON Resume, fórmulas X-Y-Z, 5 personas e master synthesis).',
            responses: { '200': { description: 'Lista de prompts em JSON' } },
          },
        },
        '/api/v1/cv/tailor': {
          post: {
            summary: 'Alfaiataria ATS milimétrica contra Job Description',
            description: 'Adapta palavras-chave e destaques de um currículo contra os requisitos de uma vaga alvo.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      base_yaml: { type: 'string' },
                      job_description: { type: 'string' },
                      persona: { type: 'string', default: 'professional' },
                    },
                    required: ['base_yaml', 'job_description'],
                  },
                },
              },
            },
            responses: { '200': { description: 'YAML adaptado retornado' } },
          },
        },
        '/api/v1/cv/generate-cover-letter': {
          post: {
            summary: 'Geração dedicada de Carta de Apresentação com IA',
            description: 'Gera apenas o nó estruturado coverLetter com base no currículo e requisitos da vaga.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cv_data: { type: 'object' },
                      job_description: { type: 'string' },
                      target_company: { type: 'string' },
                      recipient_name: { type: 'string' },
                      tone: { type: 'string', default: 'professional' },
                      language: { type: 'string', default: 'pt' },
                    },
                    required: ['cv_data'],
                  },
                },
              },
            },
            responses: { '200': { description: 'Objeto de Cover Letter gerado' } },
          },
        },
        '/api/v1/api-keys/generate': {
          post: {
            summary: 'Auto-provisionamento de Chave Temporária de API',
            description: 'Gera uma chave SHA-256 no SQLite Turso para uso autônomo por bots e agentes.',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { ttlDays: { type: 'integer', enum: [1, 7, 30], default: 1 } },
                  },
                },
              },
            },
            responses: { '200': { description: 'Chave criada com hint e data de expiração' } },
          },
        },
      },
    },
    null,
    2
  )
}
