import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const expoAppDir = path.join(rootDir, 'Assistente-Moeda-App');
const targetPublicDir = path.join(rootDir, 'public', 'laboratorio', 'assistente-moeda');

console.log('🚀 Starting full production build process...');

// 1. Build the Expo Web app
console.log('📦 Building Expo Web app...');
execSync('npm run build:web', { cwd: expoAppDir, stdio: 'inherit' });

// 2. Ensure target public directory is clean
console.log('🧹 Cleaning target public directory...');
if (fs.existsSync(targetPublicDir)) {
  fs.rmSync(targetPublicDir, { recursive: true, force: true });
}
fs.mkdirSync(targetPublicDir, { recursive: true });

// 3. Copy Expo build files to public/laboratorio/assistente-moeda
console.log('📋 Copying Expo web build to main public assets...');
copyRecursiveSync(path.join(expoAppDir, 'dist'), targetPublicDir);

// 4. Build the main Vite app
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
