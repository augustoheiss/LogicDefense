/**
 * Sample OpenAPI schema — "Escola Modelo API"
 * Used for development and demo purposes.
 * This is the "cardápio" that the dynamic UI reads to generate forms.
 */

import type { OpenApiDocument } from '../types/openapi';

export const sampleSchema: OpenApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Escola Modelo API',
    version: '1.0.0',
    description: 'API fictícia de gestão escolar para demonstração do cliente dinâmico.',
  },
  servers: [{ url: 'https://api.escolamodelo.exemplo.br/v1', description: 'Produção' }],
  tags: [
    { name: 'Alunos', description: 'Gestão de alunos matriculados' },
    { name: 'Turmas', description: 'Gestão de turmas e séries' },
    { name: 'Notas', description: 'Lançamento e consulta de notas' },
  ],
  paths: {
    '/alunos': {
      get: {
        operationId: 'listarAlunos',
        summary: 'Listar todos os alunos',
        tags: ['Alunos'],
        parameters: [
          { name: 'turma_id', in: 'query', description: 'Filtrar por turma', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', description: 'Máximo de resultados', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Lista de alunos',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Aluno' } } } },
          },
        },
      },
      post: {
        operationId: 'criarAluno',
        summary: 'Matricular novo aluno',
        tags: ['Alunos'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AlunoInput' } } },
        },
        responses: {
          '201': {
            description: 'Aluno criado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Aluno' } } },
          },
        },
      },
    },
    '/alunos/{id}': {
      get: {
        operationId: 'buscarAluno',
        summary: 'Buscar aluno por ID',
        tags: ['Alunos'],
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'ID do aluno', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Dados do aluno',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Aluno' } } },
          },
        },
      },
    },
    '/turmas': {
      get: {
        operationId: 'listarTurmas',
        summary: 'Listar turmas ativas',
        tags: ['Turmas'],
        responses: {
          '200': {
            description: 'Lista de turmas',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Turma' } } } },
          },
        },
      },
    },
    '/notas': {
      post: {
        operationId: 'lancarNota',
        summary: 'Lançar nota de aluno',
        tags: ['Notas'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NotaInput' } } },
        },
        responses: {
          '201': { description: 'Nota registrada' },
        },
      },
    },
  },
  components: {
    schemas: {
      Aluno: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID único do aluno' },
          nome: { type: 'string', description: 'Nome completo' },
          turma_id: { type: 'string', description: 'ID da turma' },
          data_nascimento: { type: 'string', format: 'date', description: 'Data de nascimento' },
          ativo: { type: 'boolean', description: 'Status de matrícula' },
        },
        required: ['id', 'nome', 'turma_id'],
      },
      AlunoInput: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome completo', minLength: 2, maxLength: 120 },
          turma_id: { type: 'string', description: 'ID da turma' },
          data_nascimento: { type: 'string', format: 'date', description: 'Data de nascimento' },
        },
        required: ['nome', 'turma_id'],
      },
      Turma: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID da turma' },
          nome: { type: 'string', description: 'Nome da turma (ex: 5ºA)' },
          ano_letivo: { type: 'integer', description: 'Ano letivo' },
          turno: { type: 'string', enum: ['Manhã', 'Tarde', 'Noite'], description: 'Turno' },
        },
        required: ['id', 'nome', 'ano_letivo'],
      },
      NotaInput: {
        type: 'object',
        properties: {
          aluno_id: { type: 'string', description: 'ID do aluno' },
          disciplina: { type: 'string', description: 'Disciplina' },
          valor: { type: 'number', minimum: 0, maximum: 10, description: 'Nota (0-10)' },
          bimestre: { type: 'integer', enum: ['1', '2', '3', '4'], description: 'Bimestre' },
        },
        required: ['aluno_id', 'disciplina', 'valor', 'bimestre'],
      },
    },
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Chave de acesso' },
    },
  },
  security: [{ ApiKeyAuth: [] }],
};
