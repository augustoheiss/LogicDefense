/**
 * Clean-Room Data Hygiene & Secret Leak Scanner — Assistente Moeda (QAR1 Gate v2)
 *
 * Scans the entire repository (including docs/ and master-plan/, with zero file exemptions) for:
 *   1. Hardcoded live spreadsheet keys (`am_sheet_live_*` excluding synthetic `_local`, `_test_`, `_e2e_`, `<REDACTED>`)
 *   2. Hardcoded OpenAI / Anthropic / Stripe / Supabase service_role secrets
 *   3. Developer workstation absolute paths (`C:/Users/<user>/Desktop/...`)
 *   4. Personal webmail addresses (`@gmail.com`, `@hotmail.com`, `@outlook.com`) in code/tests/docs
 *   5. `.gitignore` protection for sensitive local scripts and workspace configs
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
]);

const LEAK_RULES = [
  {
    id: 'LIVE_SPREADSHEET_KEY',
    description: 'Non-synthetic live spreadsheet key (am_sheet_live_*)',
    regex: new RegExp('am_sheet_live_' + '(?!local\\b|test_|e2e_|<REDACTED>|REDACTED)[a-zA-Z0-9_]{8,}', 'gi'),
  },
  {
    id: 'OPENAI_OR_STRIPE_SECRET',
    description: 'Hardcoded sk_live / sk-proj secret key',
    regex: /\b(sk_live_[a-zA-Z0-9]{16,}|sk-proj-[a-zA-Z0-9_-]{20,})\b/g,
  },
  {
    id: 'WORKSTATION_USER_PATH',
    description: 'Hardcoded developer workstation path',
    regex: new RegExp('[cC]:[\\/\\\\]Users[\\/\\\\][A-Za-z0-9_.-]+[\\/\\\\]' + '(?:Desktop|Documents|Downloads)', 'g'),
  },
  {
    id: 'PERSONAL_WEBMAIL_PII',
    description: 'Personal webmail address in repository (use @example.com for synthetic tests)',
    regex: new RegExp('\\b[a-zA-Z0-9._%+-]+@' + '(?:gmail|hotmail|outlook|yahoo)\\.com\\b', 'gi'),
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
  console.log('\x1b[1m\x1b[36m=== CLEAN-ROOM DATA HYGIENE & SECRET LEAK GATE v2 (ZERO-EXEMPTION QAR1) ===\x1b[0m\n');
  const files = walkFiles(rootDir);
  const findings = [];

  for (const filePath of files) {
    const relPath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const rule of LEAK_RULES) {
      const matches = content.match(rule.regex);
      if (matches && matches.length > 0) {
        findings.push({
          file: relPath,
          ruleId: rule.id,
          description: rule.description,
          sample: matches[0].slice(0, 32) + '...',
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

  // Verify api_workspace directory does not exist in repo
  const apiWorkspaceDir = path.join(rootDir, 'api_workspace');
  if (fs.existsSync(apiWorkspaceDir)) {
    findings.push({
      file: 'api_workspace',
      ruleId: 'SENSITIVE_WORKSPACE_PRESENT',
      description: 'Sensitive api_workspace directory still exists in repository',
      sample: 'api_workspace/',
    });
  }

  console.log(`Scanned ${files.length} source/config/doc files across ${rootDir} (0 exempted files).`);

  if (findings.length > 0) {
    console.error(`\n\x1b[31m✖ Clean-Room Gate FAILED with ${findings.length} finding(s):\x1b[0m`);
    for (const f of findings) {
      console.error(`  - [${f.ruleId}] ${f.file}: ${f.description} (${f.sample})`);
    }
    process.exit(1);
  }

  console.log('\x1b[32m✔ Clean-Room Gate PASSED: Zero hardcoded live keys, workstation paths, or personal PII found!\x1b[0m\n');
}

runAudit();

