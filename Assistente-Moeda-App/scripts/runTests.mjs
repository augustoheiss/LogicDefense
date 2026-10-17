/**
 * Fast Native Test Runner for Assistente Moeda (Async/Await + ESM TS Loader + QAR1 Gate)
 * Runs all *.test.ts files in src/tests/ with full support for:
 *   - Extensionless .ts / .tsx imports in Node v22+
 *   - @/ path alias resolution
 *   - React Native & Expo native module stubs for headless Node execution
 *   - Synchronous and asynchronous (async/await) test assertions
 */

import fs from 'node:fs';
import path from 'node:path';
import { register, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');
const testsDir = path.resolve(srcDir, 'tests');
globalThis.__dirname = testsDir;

// Register custom ESM resolver for extensionless TypeScript imports, @/ aliases, and RN stubs
const loaderCode = `
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const srcDir = ${JSON.stringify(srcDir)};

const STUB_MODULES = {
  'react-native': \`
    export const Platform = { OS: 'web', select: (obj) => obj.web ?? obj.default };
    export const Share = { share: async () => ({ action: 'sharedAction' }) };
    export const Alert = { alert: () => {} };
    export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
    export const StyleSheet = { create: (s) => s, flatten: (s) => s };
    export default { Platform, Share, Alert, Dimensions, StyleSheet };
  \`,
  'expo-file-system': \`
    export const cacheDirectory = '/tmp/';
    export const documentDirectory = '/tmp/';
    export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
    export const writeAsStringAsync = async () => {};
    export const readAsStringAsync = async () => '';
    export default { cacheDirectory, documentDirectory, EncodingType, writeAsStringAsync, readAsStringAsync };
  \`,
  'expo-file-system/legacy': \`
    export const cacheDirectory = '/tmp/';
    export const documentDirectory = '/tmp/';
    export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
    export const writeAsStringAsync = async () => {};
    export const readAsStringAsync = async () => '';
    export default { cacheDirectory, documentDirectory, EncodingType, writeAsStringAsync, readAsStringAsync };
  \`,
  'expo-sharing': \`
    export const isAvailableAsync = async () => true;
    export const shareAsync = async () => {};
    export default { isAvailableAsync, shareAsync };
  \`,
  'expo-print': \`
    export const printToFileAsync = async () => ({ uri: 'file:///tmp/report.pdf' });
    export const printAsync = async () => {};
    export default { printToFileAsync, printAsync };
  \`,
  'expo-document-picker': \`
    export const getDocumentAsync = async () => ({ canceled: true, assets: null });
    export default { getDocumentAsync };
  \`,
  'expo-secure-store': \`
    const mem = new Map();
    export const getItemAsync = async (k) => mem.get(k) ?? null;
    export const setItemAsync = async (k, v) => { mem.set(k, v); };
    export const deleteItemAsync = async (k) => { mem.delete(k); };
    export default { getItemAsync, setItemAsync, deleteItemAsync };
  \`,
  '@react-native-async-storage/async-storage': \`
    const mem = new Map();
    const AsyncStorage = {
      getItem: async (k) => mem.get(k) ?? null,
      setItem: async (k, v) => { mem.set(k, String(v)); },
      removeItem: async (k) => { mem.delete(k); },
      clear: async () => { mem.clear(); },
      getAllKeys: async () => Array.from(mem.keys()),
      multiGet: async (keys) => keys.map((k) => [k, mem.get(k) ?? null]),
      multiSet: async (pairs) => { pairs.forEach(([k, v]) => mem.set(k, String(v))); },
      multiRemove: async (keys) => { keys.forEach((k) => mem.delete(k)); },
    };
    export default AsyncStorage;
  \`,
};

function tryResolveFile(basePath) {
  const candidates = [
    basePath,
    basePath + '.ts',
    basePath + '.tsx',
    basePath + '.js',
    basePath + '.mjs',
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return pathToFileURL(c).href;
      }
    } catch {}
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (STUB_MODULES[specifier]) {
    return {
      url: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(STUB_MODULES[specifier]),
      shortCircuit: true,
    };
  }

  if (specifier.startsWith('@/')) {
    const target = path.join(srcDir, specifier.slice(2));
    const resolved = tryResolveFile(target);
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && context.parentURL.startsWith('file:')) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = path.resolve(parentDir, specifier);
    const resolved = tryResolveFile(target);
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript;charset=utf-8,${encodeURIComponent(loaderCode)}`);

// Setup in-memory browser storage shim for headless Node tests
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    localStorage: globalThis.localStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

let totalSuites = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const suiteQueue = [];
let activeSuiteTests = null;

globalThis.describe = (name, fn) => {
  totalSuites++;
  const tests = [];
  const prevSuiteTests = activeSuiteTests;
  activeSuiteTests = tests;
  try {
    fn();
  } finally {
    activeSuiteTests = prevSuiteTests;
  }
  suiteQueue.push({ name, tests });
};

globalThis.it = (name, fn) => {
  if (activeSuiteTests) {
    activeSuiteTests.push({ name, fn });
  } else {
    suiteQueue.push({ name: 'Root Suite', tests: [{ name, fn }] });
  }
};
globalThis.test = globalThis.it;

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
    toBeGreaterThanOrEqual(expected) {
      const pass = actual >= expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNegated ? 'NOT ' : ''}to be greater than or equal to ${expected}`);
      }
    },
    toBeLessThan(expected) {
      const pass = actual < expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNegated ? 'NOT ' : ''}to be less than ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected) {
      const pass = actual <= expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNegated ? 'NOT ' : ''}to be less than or equal to ${expected}`);
      }
    },
    toBeCloseTo(expected, precision = 2) {
      const pow = Math.pow(10, precision);
      const diff = Math.abs(actual - expected);
      const pass = diff < 1 / pow / 2 + 1e-9;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNegated ? 'NOT ' : ''}to be close to ${expected}`);
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
    toHaveLength(expected) {
      const len = actual ? actual.length : undefined;
      const pass = len === expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected length ${len} ${isNegated ? 'NOT ' : ''}to be ${expected}`);
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
  console.log('\x1b[1m\x1b[35m=== ASSISTENTE MOEDA QAR1 TEST SUITE (ASYNC-AWARE + TS LOADER) ===\x1b[0m\n');
  const startTime = Date.now();

  const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.ts')).sort();
  console.log(`Discovered ${files.length} test files in ${testsDir}`);

  for (const file of files) {
    const fullPath = path.join(testsDir, file);
    const fileUrl = pathToFileURL(fullPath).href;
    suiteQueue.length = 0;

    try {
      await import(fileUrl);
      for (const suite of suiteQueue) {
        console.log(`\n\x1b[1m\x1b[36m▶ ${suite.name}\x1b[0m`);
        for (const testCase of suite.tests) {
          totalTests++;
          try {
            await testCase.fn();
            passedTests++;
            console.log(`  \x1b[32m✔\x1b[0m ${testCase.name}`);
          } catch (err) {
            failedTests++;
            console.error(`  \x1b[31m✖\x1b[0m ${testCase.name}`);
            console.error(`    \x1b[31mError:\x1b[0m ${err.message || err}`);
            if (err.stack) {
              console.error(`    \x1b[90m${err.stack.split('\n').slice(1, 4).join('\n    ')}\x1b[0m`);
            }
          }
        }
      }
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

run().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
