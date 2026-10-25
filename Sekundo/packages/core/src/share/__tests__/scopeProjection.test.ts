/**
 * Sekundo — Scoped Zero-Leakage Projection Unit & Property Tests (1,000 random scopes)
 *
 * Verifies:
 * - Zero leakage of out-of-scope territories, weeks, or groups
 * - Zero leakage of `privilegeRoster` or `pinVerifierHash`
 * - Zero leakage of `notes` / `observation` when `includeNotes = false` (default)
 * - Preservation of `notes` when `includeNotes = true`
 * - Multi-territory selection (e.g., territories `01`, `02`, `05` -> only those 3 and their quadra/address descendants)
 * - Crash-Early invariant guard (`assertScopedProjectionInvariants`)
 */

import { describe, it, expect } from 'vitest';
import {
  projectScope,
  resolveTerritoryKeysForNumbers,
  assertScopedProjectionInvariants,
  type ShareScope,
} from '../scopeProjection';
import type { FlatSkeletonEntry } from '../../skeleton/types';
import type { ParticipantProfile } from '../../roster/participantDirectory';

function buildFixtureSkeleton(): FlatSkeletonEntry[] {
  const entries: FlatSkeletonEntry[] = [];
  for (let t = 1; t <= 16; t++) {
    const tNum = String(t).padStart(2, '0');
    const tKey = `Territorio_${tNum}`;
    entries.push({
      key: tKey,
      label: `Território ${tNum} - Setor ${t}`,
      type: 'category',
      value: 0,
      attributes: {
        number: tNum,
        territory_number: tNum,
        notes: `Observação confidencial do Território ${tNum}`,
        pinVerifierHash: 'pvh_secret_leak_test',
      },
    });
    for (let q = 1; q <= 2; q++) {
      const qKey = `${tKey}.Quadra_0${q}`;
      entries.push({
        key: qKey,
        label: `Quadra 0${q}`,
        type: 'category',
        value: 0,
        attributes: {
          territory_number: tNum,
          notes: `Nota da Quadra 0${q}`,
        },
      });
      entries.push({
        key: `${qKey}.Casa_01`,
        label: `Rua ${tNum}, Nº ${q}01`,
        type: 'leaf',
        value: q % 2,
        attributes: {
          address: `Rua ${tNum}, Nº ${q}01`,
          worked: String(q % 2),
          notes: `Morador pediu retorno na Casa ${q}01`,
          observation: `Obs secreta ${q}01`,
          pinHash: 'forbidden_pin_hash',
        },
      });
    }
  }

  // Add weekly schedule entries
  const weeks = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
  const groups = ['Grupo Norte', 'Grupo Sul', 'Grupo Leste'];
  weeks.forEach((weekIso, wIdx) => {
    const wKey = `Semana_${weekIso}`;
    entries.push({
      key: wKey,
      label: `Semana de ${weekIso}`,
      type: 'category',
      value: 0,
      attributes: {
        date: weekIso,
        notes: `Nota administrativa semana ${weekIso}`,
      },
    });
    groups.forEach((grp, gIdx) => {
      entries.push({
        key: `${wKey}.Sessao_0${gIdx + 1}`,
        label: `Designação ${grp}`,
        type: 'leaf',
        value: 1,
        attributes: {
          date: weekIso,
          group: grp,
          assignee: `Participante 0${((wIdx + gIdx) % 9) + 1}`,
          notes: `Contato privado da sessão ${grp}`,
        },
      });
    });
  });

  return entries;
}

const FIXTURE_ROSTER: ParticipantProfile[] = [
  {
    id: 'part_01',
    name: 'Participante 01',
    group: 'Grupo Norte',
    roleTier: 'COORDINATOR',
    category: 'REGULAR',
    statusFlag: 'ACTIVE',
    pinVerifierHash: 'pvh_1234567890abcdef',
    capabilities: { admin_seal: true },
  },
];

describe('scopeProjection — Zero-Leakage Scoped Projection Engine', () => {
  const skeleton = buildFixtureSkeleton();

  it('projects multiple selected territories (01, 02, 05) and excludes all other 13 territories', () => {
    const selectedNumbers = ['01', '02', '05'];
    const keys = resolveTerritoryKeysForNumbers(skeleton, selectedNumbers);
    expect(keys).toEqual(['Territorio_01', 'Territorio_02', 'Territorio_05']);

    const projection = projectScope(
      {
        eventId: 'evt_test',
        title: 'Mapa de Territórios',
        skeleton,
        privilegeRoster: FIXTURE_ROSTER,
      },
      {
        kind: 'territories',
        keys,
        mode: 'edit',
        includeNotes: false,
      }
    );

    expect(projection.nodes.length).toBeGreaterThan(0);
    // Every projected node must belong to Territorio_01, Territorio_02, or Territorio_05
    for (const node of projection.nodes) {
      const root = node.key.split('.')[0];
      expect(['Territorio_01', 'Territorio_02', 'Territorio_05']).toContain(root);
      expect(node.attributes?.notes).toBeUndefined();
      expect(node.attributes?.observation).toBeUndefined();
      expect(node.attributes?.pinVerifierHash).toBeUndefined();
      expect(node.attributes?.pinHash).toBeUndefined();
    }

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain('Territorio_03');
    expect(serialized).not.toContain('Territorio_16');
    expect(serialized).not.toContain('Semana_2026');
    expect(serialized).not.toContain('privilegeRoster');
    expect(serialized).not.toContain('pvh_');
  });

  it('preserves notes only when includeNotes is explicitly true', () => {
    const projectionWithNotes = projectScope(
      {
        eventId: 'evt_test',
        title: 'Território 01 com Notas',
        skeleton,
        privilegeRoster: FIXTURE_ROSTER,
      },
      {
        kind: 'territories',
        keys: ['Territorio_01'],
        mode: 'read',
        includeNotes: true,
      }
    );

    const leaf = projectionWithNotes.nodes.find((n) => n.key === 'Territorio_01.Quadra_01.Casa_01');
    expect(leaf).toBeDefined();
    expect(leaf?.attributes?.notes).toContain('Morador pediu retorno');
    // Sensitive hashes are STILL stripped even when includeNotes=true
    expect(leaf?.attributes?.pinHash).toBeUndefined();
  });

  it('projects 1,000 random scopes (Property Test) with zero out-of-scope or credential leakage', () => {
    // Deterministic PRNG (Mulberry32) for reproducible 1,000-iteration property testing
    let seed = 0x20261024;
    const nextRand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const allTerritoryKeys = Array.from({ length: 16 }, (_, i) =>
      `Territorio_${String(i + 1).padStart(2, '0')}`
    );
    const allWeekTokens = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
    const allGroups = ['Grupo Norte', 'Grupo Sul', 'Grupo Leste'];
    const kinds: ShareScope['kind'][] = ['territories', 'weeks', 'group', 'custom'];

    for (let iter = 0; iter < 1000; iter++) {
      const kind = kinds[iter % kinds.length];
      const includeNotes = nextRand() > 0.5;
      const mode = nextRand() > 0.5 ? 'edit' : 'read';

      let keys: string[] = [];
      if (kind === 'territories' || kind === 'custom') {
        const count = 1 + Math.floor(nextRand() * 4);
        const picked = new Set<string>();
        while (picked.size < count) {
          const idx = Math.floor(nextRand() * allTerritoryKeys.length);
          picked.add(allTerritoryKeys[idx]);
        }
        keys = Array.from(picked);
      } else if (kind === 'weeks') {
        const count = 1 + Math.floor(nextRand() * 2);
        const picked = new Set<string>();
        while (picked.size < count) {
          const idx = Math.floor(nextRand() * allWeekTokens.length);
          picked.add(allWeekTokens[idx]);
        }
        keys = Array.from(picked);
      } else if (kind === 'group') {
        keys = [allGroups[Math.floor(nextRand() * allGroups.length)]];
      }

      const scope: ShareScope = {
        kind,
        keys,
        mode,
        includeNotes,
      };

      const projection = projectScope(
        {
          eventId: `evt_${iter}`,
          skeleton,
          privilegeRoster: FIXTURE_ROSTER,
        },
        scope
      );

      // Invariant check must never throw on valid projection
      assertScopedProjectionInvariants(projection, scope, skeleton.length);

      expect('privilegeRoster' in (projection as unknown as Record<string, unknown>)).toBe(false);
      for (const node of projection.nodes) {
        expect(node.attributes?.pinVerifierHash).toBeUndefined();
        expect(node.attributes?.pinHash).toBeUndefined();
        if (!includeNotes) {
          expect(node.attributes?.notes).toBeUndefined();
          expect(node.attributes?.observation).toBeUndefined();
        }
        if (kind === 'territories' || kind === 'custom') {
          const root = node.key.split('.')[0];
          expect(keys).toContain(root);
        }
      }
    }
  });
});
