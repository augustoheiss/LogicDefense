/**
 * Public API Configuration & OpenAPI Specification — Assistente Moeda
 *
 * Configuração estática para integração e testes via API Pública.
 * Chave de Produção Live e especificação OpenAPI 3.1.0 oficial.
 */

export const DEFAULT_PUBLIC_API_KEY = '';
export const PUBLIC_API_HEADER_NAME = 'X-Spreadsheet-Key';
export const DEFAULT_PUBLIC_API_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'https://ocorrencias-pdf-writer.onrender.com';
export const LOCAL_PUBLIC_API_URL = 'http://localhost:8000';

export interface AppendTransactionItem {
  date: string; // YYYY-MM-DD
  value: number; // Valor monetário
  description: string; // Descrição
  entryType?: 'expense' | 'revenue' | 'partner_in' | 'partner_out' | 'waiver';
  category?: string;
  tags?: string;
  externalId?: string;
  metadataJson?: string;
}

export interface AppendSpreadsheetPayload {
  mode?: 'merge' | 'replace';
  transactions?: AppendTransactionItem[];
  csvContent?: string;
}

export interface AppendSpreadsheetResponse {
  success: boolean;
  mode: string;
  insertedCount: number;
  updatedCount: number;
  totalCount: number;
  message: string;
}

export interface PublicAnalysisContextParams {
  as_of_date?: string;
  start_date?: string;
  end_date?: string;
}

export interface PublicAnalysisContextResponse {
  context: string;
}

export interface PublicAIAnalystPayload {
  userPrompt: string;
  asOfDate?: string;
  startDate?: string;
  endDate?: string;
}

export interface PublicAIAnalystResponse {
  content: string;
  modelUsed: string;
}

export const OPENAPI_SPEC_V1 = {
  "openapi": "3.1.0",
  "info": {
    "title": "Assistente Moeda - Public API Integration",
    "description": "Public endpoints to integrate your spreadsheet with external IAs (ChatGPT, Claude) and automated tools.",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://ocorrencias-pdf-writer.onrender.com",
      "description": "Active API Server"
    }
  ],
  "paths": {
    "/api/v1/public/analysis-context": {
      "get": {
        "tags": ["Public API Integration"],
        "summary": "Get Analysis Context",
        "description": "Retorna o contexto financeiro estruturado em Markdown para uso por IAs externas.",
        "operationId": "get_analysis_context_api_v1_public_analysis_context_get",
        "security": [{"APIKeyHeader": []}],
        "parameters": [
          {
            "name": "as_of_date",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [{"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}, {"type": "null"}],
              "description": "Reference date YYYY-MM-DD",
              "title": "As Of Date"
            },
            "description": "Reference date YYYY-MM-DD"
          },
          {
            "name": "start_date",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [{"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}, {"type": "null"}],
              "description": "Optional start date for temporal filtering YYYY-MM-DD",
              "title": "Start Date"
            },
            "description": "Optional start date for temporal filtering YYYY-MM-DD"
          },
          {
            "name": "end_date",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [{"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}, {"type": "null"}],
              "description": "Optional end date for temporal filtering YYYY-MM-DD",
              "title": "End Date"
            },
            "description": "Optional end date for temporal filtering YYYY-MM-DD"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/PublicAnalysisContextResponse"}
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
              }
            }
          }
        }
      }
    },
    "/api/v1/public/spreadsheet/export": {
      "get": {
        "tags": ["Public API Integration"],
        "summary": "Export Spreadsheet Csv",
        "description": "Exporta a planilha associada à Chave API em formato CSV v2 padrão.",
        "operationId": "export_spreadsheet_csv_api_v1_public_spreadsheet_export_get",
        "security": [{"APIKeyHeader": []}],
        "parameters": [
          {
            "name": "download",
            "in": "query",
            "required": false,
            "schema": {
              "type": "boolean",
              "description": "Se True, retorna como arquivo para download .csv",
              "default": false,
              "title": "Download"
            },
            "description": "Se True, retorna como arquivo para download .csv"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {"schema": {}}
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
              }
            }
          }
        }
      }
    },
    "/api/v1/public/spreadsheet/append": {
      "post": {
        "tags": ["Public API Integration"],
        "summary": "Append To Spreadsheet",
        "description": "Permite que agentes de IA (n8n, Make, Python) enviem transações de forma incremental ou em lote para a planilha.\nSuporta idempotência via `external_id`.",
        "operationId": "append_to_spreadsheet_api_v1_public_spreadsheet_append_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/AppendSpreadsheetPayload"}
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/AppendSpreadsheetResponse"}
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
              }
            }
          }
        },
        "security": [{"APIKeyHeader": []}]
      }
    },
    "/api/v1/public/ai-analyst": {
      "post": {
        "tags": ["Public API Integration"],
        "summary": "Public Ai Analyst",
        "description": "Garante inteligência financeira via IA pública com auto-execução de transações (God Mode).",
        "operationId": "public_ai_analyst_api_v1_public_ai_analyst_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/PublicAIAnalystPayload"}
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/PublicAIAnalystResponse"}
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
              }
            }
          }
        },
        "security": [{"APIKeyHeader": []}]
      }
    }
  },
  "components": {
    "schemas": {
      "AppendSpreadsheetPayload": {
        "properties": {
          "mode": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Mode",
            "description": "Modo de importação: 'merge' (acumular entradas) ou 'replace' (substituir planilha). Padrão 'merge'.",
            "default": "merge"
          },
          "transactions": {
            "anyOf": [{"items": {"$ref": "#/components/schemas/AppendTransactionItem"}, "type": "array"}, {"type": "null"}],
            "title": "Transactions",
            "description": "Array de transações estruturadas"
          },
          "csvContent": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Csvcontent",
            "description": "Bloco de texto CSV bruto"
          }
        },
        "type": "object",
        "title": "AppendSpreadsheetPayload"
      },
      "AppendSpreadsheetResponse": {
        "properties": {
          "success": {"type": "boolean", "title": "Success"},
          "mode": {"type": "string", "title": "Mode"},
          "insertedCount": {"type": "integer", "title": "Insertedcount"},
          "updatedCount": {"type": "integer", "title": "Updatedcount"},
          "totalCount": {"type": "integer", "title": "Totalcount"},
          "message": {"type": "string", "title": "Message"}
        },
        "type": "object",
        "required": ["success", "mode", "insertedCount", "updatedCount", "totalCount", "message"],
        "title": "AppendSpreadsheetResponse"
      },
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {"$ref": "#/components/schemas/ValidationError"},
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "PublicAIAnalystPayload": {
        "properties": {
          "userPrompt": {
            "type": "string",
            "title": "Userprompt",
            "description": "The natural language question or command from the user."
          },
          "asOfDate": {
            "anyOf": [{"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}, {"type": "null"}],
            "title": "Asofdate",
            "description": "Optional reference date in YYYY-MM-DD format."
          },
          "startDate": {
            "anyOf": [{"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}, {"type": "null"}],
            "title": "Startdate",
            "description": "Optional start date for filtering in YYYY-MM-DD format."
          },
          "endDate": {
            "anyOf": [{"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}, {"type": "null"}],
            "title": "Enddate",
            "description": "Optional end date for filtering in YYYY-MM-DD format."
          }
        },
        "type": "object",
        "required": ["userPrompt"],
        "title": "PublicAIAnalystPayload"
      },
      "PublicAIAnalystResponse": {
        "properties": {
          "content": {
            "type": "string",
            "title": "Content",
            "description": "The textual response from the AI or confirmation of executed action."
          },
          "modelUsed": {
            "type": "string",
            "title": "Modelused",
            "description": "The LLM model backing the generation."
          }
        },
        "type": "object",
        "required": ["content", "modelUsed"],
        "title": "PublicAIAnalystResponse"
      },
      "PublicAnalysisContextResponse": {
        "properties": {
          "context": {
            "type": "string",
            "title": "Context",
            "description": "Pre-computed operational financial intelligence formatted in Markdown, optimized with tiered token compression."
          }
        },
        "type": "object",
        "required": ["context"],
        "title": "PublicAnalysisContextResponse"
      },
      "AppendTransactionItem": {
        "properties": {
          "date": {"type": "string", "title": "Date", "description": "Data em formato YYYY-MM-DD"},
          "value": {"type": "number", "title": "Value", "description": "Valor monetário da transação"},
          "description": {"type": "string", "title": "Description", "description": "Descrição da transação"},
          "entryType": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Entrytype",
            "description": "Tipo: expense, revenue, partner_in, partner_out, waiver",
            "default": "expense"
          },
          "category": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Category",
            "description": "Categoria",
            "default": "Geral"
          },
          "tags": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Tags",
            "description": "Tags da transação",
            "default": ""
          },
          "externalId": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Externalid",
            "description": "ID externo para idempotência (ex: n8n_invoice_9841)"
          },
          "metadataJson": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "title": "Metadatajson",
            "description": "String JSON de metadados",
            "default": "{}"
          }
        },
        "type": "object",
        "required": ["date", "value", "description"],
        "title": "AppendTransactionItem"
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
            "type": "array",
            "title": "Location"
          },
          "msg": {"type": "string", "title": "Message"},
          "type": {"type": "string", "title": "Error Type"},
          "input": {"title": "Input"},
          "ctx": {"type": "object", "title": "Context"}
        },
        "type": "object",
        "required": ["loc", "msg", "type"],
        "title": "ValidationError"
      }
    }
  }
};
