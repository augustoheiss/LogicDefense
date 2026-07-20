import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

// Paths for Assistente-Moeda
const expoAppDir = path.join(rootDir, 'Assistente-Moeda-App');
const targetPublicDir = path.join(rootDir, 'public', 'laboratorio', 'assistente-moeda');

// Paths for Sekundo
const sekundoRootDir = path.join(rootDir, 'Sekundo');
const sekundoAppDir = path.join(sekundoRootDir, 'packages', 'app');
const targetSekundoPublicDir = path.join(rootDir, 'public', 'laboratorio', 'sekundo');

console.log('🚀 Starting full production build process...');

// -----------------------------------------------------------------------------
// 1. Build Assistente-Moeda
// -----------------------------------------------------------------------------
console.log('📦 Installing Assistente-Moeda sub-dependencies...');
execSync('npm install', { cwd: expoAppDir, stdio: 'inherit' });

console.log('📦 Building Assistente-Moeda Expo Web app...');
execSync('npm run build:web', { cwd: expoAppDir, stdio: 'inherit' });

console.log('🧹 Cleaning Assistente-Moeda target public directory...');
if (fs.existsSync(targetPublicDir)) {
  fs.rmSync(targetPublicDir, { recursive: true, force: true });
}
fs.mkdirSync(targetPublicDir, { recursive: true });

console.log('📋 Copying Assistente-Moeda web build to public assets...');
copyRecursiveSync(path.join(expoAppDir, 'dist'), targetPublicDir);

// -----------------------------------------------------------------------------
// 2. Build Sekundo
// -----------------------------------------------------------------------------
console.log('📦 Installing Sekundo monorepo dependencies...');
execSync('npm install', { cwd: sekundoRootDir, stdio: 'inherit' });

console.log('📦 Building Sekundo Expo Web app...');
execSync('npm run build:web', { cwd: sekundoAppDir, stdio: 'inherit' });

console.log('🧹 Cleaning Sekundo target public directory...');
if (fs.existsSync(targetSekundoPublicDir)) {
  fs.rmSync(targetSekundoPublicDir, { recursive: true, force: true });
}
fs.mkdirSync(targetSekundoPublicDir, { recursive: true });

console.log('📋 Copying Sekundo web build to public assets...');
copyRecursiveSync(path.join(sekundoAppDir, 'dist'), targetSekundoPublicDir);

// -----------------------------------------------------------------------------
// 3. Build main Vite App
// -----------------------------------------------------------------------------
console.log('⚡ Building main LogicDefense portal...');
execSync('npm run build:vite', { cwd: rootDir, stdio: 'inherit' });

console.log('✅ Full build completed successfully!');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}
