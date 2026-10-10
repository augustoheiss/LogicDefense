/**
 * Fast Native Test Runner for Assistente Moeda
 * Runs all *.test.ts files in src/tests/ with zero external runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.resolve(__dirname, '../src/tests');

let totalSuites = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let currentSuite = '';

// Setup test harness globals
globalThis.describe = (name, fn) => {
  totalSuites++;
  currentSuite = name;
  console.log(`\n\x1b[1m\x1b[36m▶ ${name}\x1b[0m`);
  fn();
};

globalThis.it = (name, fn) => {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31mError:\x1b[0m ${err.message || err}`);
    if (err.stack) {
      console.error(`    \x1b[90m${err.stack.split('\n').slice(1, 4).join('\n    ')}\x1b[0m`);
    }
  }
};

function createMatcher(actual, isNegated = false) {
  const match = {
    toBe(expected) {
      const pass = Object.is(actual, expected);
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      const pass = a === b;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${a} ${isNegated ? 'NOT ' : ''}to equal ${b}`);
      }
    },
    toBeDefined() {
      const pass = actual !== undefined;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to be defined`);
      }
    },
    toBeUndefined() {
      const pass = actual === undefined;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to be undefined`);
      }
    },
    toBeNull() {
      const pass = actual === null;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to be null`);
      }
    },
    toBeTruthy() {
      const pass = !!actual;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to be truthy`);
      }
    },
    toBeFalsy() {
      const pass = !actual;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to be falsy`);
      }
    },
    toBeGreaterThan(expected) {
      const pass = actual > expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNegated ? 'NOT ' : ''}to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      const pass = actual < expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNegated ? 'NOT ' : ''}to be less than ${expected}`);
      }
    },
    toContain(expected) {
      let pass = false;
      if (typeof actual === 'string' || Array.isArray(actual)) {
        pass = actual.includes(expected);
      }
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${JSON.stringify(actual)} ${isNegated ? 'NOT ' : ''}to contain ${JSON.stringify(expected)}`);
      }
    },
    toHaveProperty(prop, value) {
      const hasProp = actual && Object.prototype.hasOwnProperty.call(actual, prop);
      const pass = value !== undefined ? hasProp && actual[prop] === value : hasProp;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected object ${isNegated ? 'NOT ' : ''}to have property "${prop}"`);
      }
    },
  };

  if (!isNegated) {
    match.not = createMatcher(actual, true);
  }

  return match;
}

globalThis.expect = (actual) => createMatcher(actual, false);

async function run() {
  console.log('\x1b[1m\x1b[35m=== ASSISTENTE MOEDA TEST SUITE ===\x1b[0m\n');
  const startTime = Date.now();

  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));
  console.log(`Discovered ${files.length} test files in ${testsDir}`);

  for (const file of files) {
    const fullPath = path.join(testsDir, file);
    const fileUrl = pathToFileURL(fullPath).href;
    try {
      await import(fileUrl);
    } catch (err) {
      console.error(`\x1b[31mFailed to load test suite ${file}:\x1b[0m`, err);
      failedTests++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n----------------------------------------');
  console.log(`\x1b[1mResults: ${passedTests} passed, ${failedTests} failed, ${totalTests} total (${duration}s)\x1b[0m`);

  if (failedTests > 0) {
    console.log('\x1b[31mSome tests failed!\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32mAll tests passed successfully!\x1b[0m\n');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
