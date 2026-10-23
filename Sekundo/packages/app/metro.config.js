const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const coinEngineSrc = path.resolve(projectRoot, '../coin-engine/src');
const coreSrc = path.resolve(projectRoot, '../core/src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const tslibCandidates = [
  path.resolve(projectRoot, 'node_modules/tslib/tslib.es6.js'),
  path.resolve(workspaceRoot, 'node_modules/tslib/tslib.es6.js'),
];
const tslibPath = tslibCandidates.find((p) => fs.existsSync(p)) || tslibCandidates[1];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib' && fs.existsSync(tslibPath)) {
    return {
      filePath: tslibPath,
      type: 'sourceFile',
    };
  }
  if (moduleName === '@sekundo/core') {
    return context.resolveRequest(
      context,
      path.resolve(coreSrc, 'index.ts'),
      platform
    );
  }
  if (moduleName === '@sekundo/coin-engine') {
    return context.resolveRequest(
      context,
      path.resolve(coinEngineSrc, 'index.ts'),
      platform
    );
  }
  if (moduleName.startsWith('@coin/')) {
    const subPath = moduleName.slice('@coin/'.length);
    return context.resolveRequest(
      context,
      path.resolve(coinEngineSrc, subPath),
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
