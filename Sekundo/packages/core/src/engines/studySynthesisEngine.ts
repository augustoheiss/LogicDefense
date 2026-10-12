/**
 * Sekundo — Study Plan & Collective Synthesis Engine
 *
 * Implements the Universal Law for Study Plans and Research Collaboration:
 * - Hierarchy: Project/Book -> Module/Theme -> Research Topic -> Member Synthesis
 * - Tracks individual contributions, status of investigation, key findings
 * - Compiles all member syntheses into an Executive Consolidated Markdown
 *   allowing the organizer to draft the final comprehensive summary.
 */

import type { SkeletonNode, NodeType } from '../skeleton/types';
import type {
  EventEngine,
  StudyMetrics,
  EngineMetrics,
  StudySynthesisNodeMeta,
} from './types';

/**
 * Traverses a skeleton node tree and compiles a consolidated Executive Summary
 * from all research syntheses contributed by members.
 */
export function generateExecutiveSummary(nodes: SkeletonNode[], projectName = 'Plano de Estudo'): string {
  const lines: string[] = [
    `# 📚 Resumo Executivo Consolidado — ${projectName}`,
    `> Compilado automaticamente pelo Sekundo Study & Synthesis Engine.`,
    `> Data da síntese: ${new Date().toLocaleDateString('pt-BR')}`,
    '',
    '---',
    '',
  ];

  function renderNode(node: SkeletonNode, level: number) {
    const meta = (node.meta || {}) as StudySynthesisNodeMeta;
    const prefix = '#'.repeat(Math.min(level + 1, 6));

    lines.push(`${prefix} [${node.key}] ${node.label}`);

    if (meta.researcherName) {
      lines.push(`**Pesquisador Responsável:** ${meta.researcherName} | **Status:** ${meta.status || 'Não iniciado'}`);
    }

    if (node.value && node.value.trim() !== '') {
      lines.push(`*Anotação:* ${node.value}`);
    }

    if (meta.synthesisText && meta.synthesisText.trim() !== '') {
      lines.push('');
      lines.push('### 📝 Síntese do Pesquisador:');
      lines.push(meta.synthesisText.trim());
      lines.push('');
    }

    if (meta.keyFindings && meta.keyFindings.length > 0) {
      lines.push('**Destaques & Conclusões:**');
      for (const finding of meta.keyFindings) {
        lines.push(`- ${finding}`);
      }
      lines.push('');
    }

    if (meta.references && meta.references.length > 0) {
      lines.push('**Referências & Fontes:**');
      for (const ref of meta.references) {
        lines.push(`- ${ref}`);
      }
      lines.push('');
    }

    for (const child of node.children) {
      renderNode(child, level + 1);
    }
  }

  for (const root of nodes) {
    renderNode(root, 1);
  }

  return lines.join('\n');
}

/**
 * Traverses a skeleton node tree and calculates study plan metrics.
 */
export function calculateStudyMetrics(nodes: SkeletonNode[]): StudyMetrics {
  let totalTopics = 0;
  let submittedCount = 0;
  let pendingCount = 0;

  function visit(node: SkeletonNode) {
    if (node.children.length === 0) {
      totalTopics++;
      const meta = (node.meta || {}) as StudySynthesisNodeMeta;
      const hasSynthesis = Boolean(meta.synthesisText && meta.synthesisText.trim() !== '');
      const isSubmitted = meta.status === 'submitted' || meta.status === 'reviewed' || hasSynthesis;

      if (isSubmitted) {
        submittedCount++;
      } else {
        pendingCount++;
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  for (const root of nodes) {
    visit(root);
  }

  const completionPercent =
    totalTopics > 0 ? Math.round((submittedCount / totalTopics) * 1000) / 10 : 0;

  const executiveSummary = generateExecutiveSummary(nodes);

  return {
    totalTopics,
    submittedCount,
    pendingCount,
    completionPercent,
    executiveSummary,
  };
}

/**
 * The Study & Synthesis Engine Definition
 */
export const studySynthesisEngine: EventEngine = {
  id: 'study_synthesis',
  name: 'Plano de Estudos, Pesquisa & Síntese Coletiva',
  description:
    'Estrutura projetos de investigação, leitura e estudo em grupo. Cada membro contribui com sua síntese por tópico, permitindo ao organizador consolidar um resumo executivo unificado para novos projetos.',
  icon: 'book-open',
  allowedNodeTypes: ['header', 'slot', 'note'],
  defaultNodeTypeForDepth(depth: number): NodeType {
    if (depth <= 2) return 'header';
    return 'slot';
  },
  validateNode(node: SkeletonNode) {
    const errors: string[] = [];
    const meta = (node.meta || {}) as StudySynthesisNodeMeta;

    if (
      meta.status &&
      !['pending', 'in_progress', 'submitted', 'reviewed'].includes(meta.status)
    ) {
      errors.push(`Status inválido no nó ${node.key}: '${meta.status}'.`);
    }

    return { valid: errors.length === 0, errors };
  },
  calculateMetrics(tree: SkeletonNode[]): EngineMetrics {
    return {
      engineId: 'study_synthesis',
      data: calculateStudyMetrics(tree),
    };
  },
  supportedExports: ['yaml', 'pdf', 'csv', 'xlsx'],
};
