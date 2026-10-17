/**
 * Playwright E2E Specification — Assistente Moeda (QAR1 DOM & AutoCAD UX Gate)
 *
 * Delegates to the self-contained E2E runner in scripts/runE2E.js or runs via @playwright/test.
 */

import { runE2E } from '../scripts/runE2E';

export async function runE2ETest() {
  await runE2E();
}

if (typeof require !== 'undefined' && require.main === module) {
  runE2ETest().catch((err) => {
    console.error('Playwright E2E Error:', err);
    process.exit(1);
  });
}
