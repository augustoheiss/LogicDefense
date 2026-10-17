const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const coinEngineSrc = path.resolve(projectRoot, '../coin-engine/src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const tslibPath = path.resolve(workspaceRoot, 'node_modules/tslib/tslib.es6.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return {
      filePath: tslibPath,
      type: 'sourceFile',
    };
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
