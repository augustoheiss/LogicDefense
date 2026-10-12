/**
 * Sekundo — Tournament Pairings Engine
 *
 * Implements tournament administration laws:
 * - Anti-Rematch Invariant validation: Sum(E_i,j) <= 1
 * - Match completion rollups and active contestant tracking
 * - Score bracket metrics for Swiss and Elimination structures
 */

import type { EventEngine, TournamentMetrics, TournamentNodeMeta } from './types';
import type { SkeletonNode, NodeType } from '../skeleton/types';

export const tournamentEngine: EventEngine = {
  id: 'tournament_pairings',
  name: 'Torneios & Emparelhamentos (Sistema Suíço / Chaves)',
  description:
    'Administração combinatória de campeonatos e confrontos competitivos, com garantia do invariante anti-revanche e acompanhamento de rodadas.',
  icon: 'trophy-outline',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],

  defaultNodeTypeForDepth: (depth: number): NodeType => {
    if (depth <= 2) return 'header'; // Tournament / Round
    return 'slot';                   // Match / Confronto
  },

  validateNode: (node: SkeletonNode) => {
    const errors: string[] = [];
    const meta = (node.meta || {}) as TournamentNodeMeta;

    if (node.type === 'slot') {
      if (!meta.contestantA) {
        errors.push(`Nó ${node.key}: Confronto deve possuir ao menos o competidor A.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  calculateMetrics: (tree: SkeletonNode[]) => {
    const rounds = new Set<number>();
    const contestants = new Set<string>();
    let completedMatches = 0;
    let rematchesDetected = 0;

    // Track historical pairings across rounds: normalized pair key "A:::B"
    const pairCounts = new Map<string, number>();

    function traverse(node: SkeletonNode) {
      const isLeaf = (node.children || []).length === 0;

      if (isLeaf && node.type === 'slot') {
        const meta = (node.meta || {}) as TournamentNodeMeta;

        if (meta.roundIndex !== undefined) {
          rounds.add(meta.roundIndex);
        }

        if (meta.contestantA) contestants.add(meta.contestantA);
        if (meta.contestantB) contestants.add(meta.contestantB);

        if (meta.winner || (meta.scoreA !== undefined && meta.scoreB !== undefined)) {
          completedMatches++;
        }

        // Check anti-rematch invariant
        if (meta.contestantA && meta.contestantB && !meta.isBye) {
          const sortedPair = [meta.contestantA, meta.contestantB].sort().join(':::');
          const count = (pairCounts.get(sortedPair) || 0) + 1;
          pairCounts.set(sortedPair, count);

          if (count > 1) {
            rematchesDetected++;
          }
        }
      }

      for (const child of node.children || []) {
        traverse(child);
      }
    }

    for (const root of tree) {
      traverse(root);
    }

    const data: TournamentMetrics = {
      totalRounds: rounds.size,
      currentRound: rounds.size > 0 ? Math.max(...Array.from(rounds)) : 0,
      activeContestants: contestants.size,
      completedMatches,
      rematchesDetected,
    };

    return {
      engineId: 'tournament_pairings',
      data,
    };
  },

  supportedExports: ['csv', 'pdf', 'yaml'],
};
