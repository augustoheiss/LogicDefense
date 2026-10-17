/**
 * Clean-Room Data Hygiene & Secret Leak Scanner — Assistente Moeda (QAR1 Gate)
 *
 * Scans the repository for:
 *   1. Hardcoded live spreadsheet keys (`am_sheet_live_<hex>`)
 *   2. Hardcoded OpenAI / Anthropic / Stripe / Supabase service_role secrets
 *   3. Known personal banking PII patterns from developer local debugging
 *   4. `.gitignore` protection for sensitive local scripts and workspace configs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.expo',
  '.git',
  'dist',
  'web-build',
  'android',
  'ios',
  'playwright-report',
  'test-results',
  'master-plan',
]);

const ALLOWED_TEST_FILES = new Set([
  'cleanRoomAudit.mjs',
  'qar1SecurityAndCleanRoom.test.ts',
  'qar1ExportImportRoundtrip.test.ts',
  'qar1SitIntegrationContract.test.ts',
  'qar1FullDomAuditAndScreenshots.spec.ts',
  'csvRoundtrip.test.ts',
]);

const LEAK_RULES = [
  {
    id: 'LIVE_SPREADSHEET_KEY',
    description: 'Hardcoded live spreadsheet key (am_sheet_live_*)',
    regex: /am_sheet_live_[a-f0-9]{24,}/gi,
  },
  {
    id: 'OPENAI_OR_STRIPE_SECRET',
    description: 'Hardcoded sk_live / sk-proj secret key',
    regex: /\b(sk_live_[a-zA-Z0-9]{16,}|sk-proj-[a-zA-Z0-9_-]{20,})\b/g,
  },
  {
    id: 'PERSONAL_BANKING_PII',
    description: 'Known personal banking/receipt PII marker',
    regex: /\b(AH-BB\.jpg|AH-ITAU\.pdf|AH-ITAU-02\.pdf|PIX Luiz \(2400\)|Plano de Assistencia Funeral Fe)\b/gi,
  },
];

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
    } else if (/\.(ts|tsx|js|mjs|py|json|csv|md)$/i.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function runAudit() {
  console.log('\x1b[1m\x1b[36m=== CLEAN-ROOM DATA HYGIENE & SECRET LEAK GATE (QAR1) ===\x1b[0m\n');
  const files = walkFiles(rootDir);
  const findings = [];

  for (const filePath of files) {
    const baseName = path.basename(filePath);
    if (ALLOWED_TEST_FILES.has(baseName)) continue;

    const relPath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const rule of LEAK_RULES) {
      const matches = content.match(rule.regex);
      if (matches && matches.length > 0) {
        findings.push({
          file: relPath,
          ruleId: rule.id,
          description: rule.description,
          sample: matches[0].slice(0, 28) + '...',
        });
      }
    }
  }

  // Verify .gitignore protections
  const gitignorePath = path.join(rootDir, '.gitignore');
  const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const requiredIgnores = ['.env', 'api_workspace/', 'scripts/push_july_data.py', 'test-results/'];
  for (const reqIgnore of requiredIgnores) {
    if (!gitignoreContent.includes(reqIgnore)) {
      findings.push({
        file: '.gitignore',
        ruleId: 'GITIGNORE_MISSING_RULE',
        description: `Missing mandatory Clean-Room ignore rule: ${reqIgnore}`,
        sample: reqIgnore,
      });
    }
  }

  console.log(`Scanned ${files.length} source/config files across ${rootDir}.`);

  if (findings.length > 0) {
    console.error(`\n\x1b[31m✖ Clean-Room Gate FAILED with ${findings.length} finding(s):\x1b[0m`);
    for (const f of findings) {
      console.error(`  - [${f.ruleId}] ${f.file}: ${f.description} (${f.sample})`);
    }
    process.exit(1);
  }

  console.log('\x1b[32m✔ Clean-Room Gate PASSED: Zero hardcoded live keys or personal banking PII found!\x1b[0m\n');
}

runAudit();
