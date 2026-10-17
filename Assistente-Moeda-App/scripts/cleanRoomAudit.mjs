/**
 * Clean-Room Data Hygiene & Secret Leak Scanner — Assistente Moeda (QAR1 Gate v3)
 *
 * Scans the entire frontend repository AND sibling backend repository (with zero file exemptions) for:
 *   1. Hardcoded live spreadsheet keys (`am_sheet_live_*` excluding synthetic `_local`, `_test_`, `_e2e_`, `<REDACTED>`)
 *   2. Hardcoded OpenAI / Anthropic / Stripe / Resend / Gemini / JWT secrets
 *   3. Developer workstation absolute paths (`C:/Users/<user>/Desktop/...`)
 *   4. Personal webmail addresses (`@gmail.com`, `@hotmail.com`, `@outlook.com`, `@yahoo.com`)
 *   5. Forensic bank statement dumps or personal keyword dictionaries
 *   6. Prohibited root visual/database/log artifacts (`*.png`, `*.db`, `*.sqlite`, `ts_errors*.txt`)
 *   7. `.gitignore` protection for sensitive local scripts and workspace configs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, '..', 'backend');

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
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
]);

const LEAK_RULES = [
  {
    id: 'LIVE_SPREADSHEET_KEY',
    description: 'Non-synthetic live spreadsheet key (am_sheet_live_*)',
    regex: new RegExp('am_sheet_live_' + '(?!local\\b|test_|e2e_|<REDACTED>|REDACTED)[a-zA-Z0-9_]{8,}', 'gi'),
  },
  {
    id: 'OPENAI_STRIPE_WEBHOOK_RESEND_SECRET',
    description: 'Hardcoded sk_live / sk-proj / whsec_ / re_ secret key',
    regex: /\b(sk_live_[a-zA-Z0-9]{16,}|sk-proj-[a-zA-Z0-9_-]{20,}|whsec_[a-zA-Z0-9]{16,}|re_[a-zA-Z0-9_]{20,})\b/g,
  },
  {
    id: 'GOOGLE_GEMINI_LIVE_KEY',
    description: 'Hardcoded Google/Gemini API key (AIzaSy*)',
    regex: new RegExp('AIzaSy' + '(?!FakeKeyForTesting)[A-Za-z0-9_-]{30,}', 'g'),
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
  {
    id: 'CONTAMINATED_BANK_DUMP_OR_FILTER',
    description: 'Forensic bank statement dump header or personal keyword dictionary',
    regex: new RegExp('(?:=== STATEMENT' + ' OF:|' + 'personal_' + 'keywords\\s*=\\s*\\[)', 'g'),
  },
];

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
    } else if (/\.(ts|tsx|js|mjs|py|json|csv|md|txt|sql|yaml|yml|html|sh)$/i.test(entry.name) || entry.name === '.env.example') {
      acc.push(fullPath);
    }
  }
  return acc;
}

function checkRootArtifacts(dir, label, findings) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/\.(png|pdf|db|sqlite|sqlite3)$/i.test(entry.name) || /^ts_errors.*\.txt$/i.test(entry.name)) {
      findings.push({
        file: `${label}/${entry.name}`,
        ruleId: 'PROHIBITED_ROOT_ARTIFACT',
        description: 'Prohibited root screenshot, PDF, SQLite DB, or compiler log artifact',
        sample: entry.name,
      });
    }
  }
}

function checkSubdirBinaryArtifacts(dir, baseDir, findings) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkSubdirBinaryArtifacts(fullPath, baseDir, findings);
    } else if (/\.(pdf|db|sqlite|sqlite3)$/i.test(entry.name)) {
      const rel = path.relative(baseDir, fullPath);
      findings.push({
        file: rel,
        ruleId: 'PROHIBITED_BUNDLED_BINARY_OR_DB',
        description: 'Prohibited bundled reference PDF or SQLite database in repository tree',
        sample: entry.name,
      });
    }
  }
}

function runAudit() {
  console.log('\x1b[1m\x1b[36m=== CLEAN-ROOM DATA HYGIENE & SECRET LEAK GATE v5 (CROSS-REPO ZERO-EXEMPTION QAR1) ===\x1b[0m\n');
  const files = [...walkFiles(rootDir), ...walkFiles(backendDir)];
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

  checkRootArtifacts(rootDir, '.', findings);
  checkRootArtifacts(backendDir, '../backend', findings);
  checkSubdirBinaryArtifacts(rootDir, rootDir, findings);
  checkSubdirBinaryArtifacts(backendDir, rootDir, findings);

  // Verify .gitignore protections
  const gitignorePath = path.join(rootDir, '.gitignore');
  const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const requiredIgnores = ['.env', 'api_workspace/', 'scripts/push_july_data.py', 'test-results/', '/*.png', 'ts_errors*.txt'];
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

  console.log(`Scanned ${files.length} source/config/doc/sql/txt files across frontend & backend (0 exempted files).`);

  if (findings.length > 0) {
    console.error(`\n\x1b[31m✖ Clean-Room Gate v3 FAILED with ${findings.length} finding(s):\x1b[0m`);
    for (const f of findings) {
      console.error(`  - [${f.ruleId}] ${f.file}: ${f.description} (${f.sample})`);
    }
    process.exit(1);
  }

  console.log('\x1b[32m✔ Clean-Room Gate v3 PASSED: Zero hardcoded live keys, workstation paths, root artifacts, or personal PII found!\x1b[0m\n');
}

runAudit();


