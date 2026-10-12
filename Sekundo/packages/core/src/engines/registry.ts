/**
 * Sekundo — Engine Registry
 *
 * Central directory of all active engines ("Universal Laws").
 * Allows dynamic engine lookup, registration of custom extensions,
 * and batch validation.
 */

import type { EngineId, EventEngine } from './types';
import type { SkeletonNode } from '../skeleton/types';
import { territoryEngine } from './territoryEngine';
import { rosterEngine } from './rosterEngine';
import { studySynthesisEngine } from './studySynthesisEngine';
import { genericWbsEngine } from './genericWbsEngine';
import { incidentCommandEngine } from './incidentCommandEngine';
import { runOfShowEngine } from './runOfShowEngine';
import { tournamentEngine } from './tournamentEngine';
import { canvassingEngine } from './canvassingEngine';
import { transformerEngine } from './transformerEngine';

const BUILTIN_ENGINES: Record<EngineId, EventEngine> = {
  territory_logistics: territoryEngine,
  roster_assignments: rosterEngine,
  study_synthesis: studySynthesisEngine,
  generic_wbs: genericWbsEngine,
  incident_command: incidentCommandEngine,
  live_production_ros: runOfShowEngine,
  tournament_pairings: tournamentEngine,
  canvassing_logistics: canvassingEngine,
  transformer: transformerEngine,
};

/**
 * Registry of all available engines.
 */
class EngineRegistry {
  private engines: Map<string, EventEngine> = new Map();

  constructor() {
    for (const [id, engine] of Object.entries(BUILTIN_ENGINES)) {
      this.engines.set(id, engine);
    }
  }

  /**
   * Retrieves an engine by its identifier. Fallback to generic_wbs if not found.
   */
  get(id?: EngineId | string): EventEngine {
    if (!id) return this.engines.get('generic_wbs')!;
    const engine = this.engines.get(id);
    return engine || this.engines.get('generic_wbs')!;
  }

  /**
   * Lists all registered engines in canonical order.
   */
  list(): EventEngine[] {
    return Array.from(this.engines.values());
  }

  /**
   * Registers a new custom engine plugin.
   */
  register(engine: EventEngine): void {
    this.engines.set(engine.id, engine);
  }

  /**
   * Validates an entire tree of nodes against an engine's laws.
   */
  validateTree(
    engineId: EngineId | string,
    nodes: SkeletonNode[]
  ): { valid: boolean; errors: { key: string; errors: string[] }[] } {
    const engine = this.get(engineId);
    const errors: { key: string; errors: string[] }[] = [];

    function checkNode(node: SkeletonNode) {
      const result = engine.validateNode(node);
      if (!result.valid) {
        errors.push({ key: node.key, errors: result.errors });
      }
      for (const child of node.children) {
        checkNode(child);
      }
    }

    for (const root of nodes) {
      checkNode(root);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const engineRegistry = new EngineRegistry();
