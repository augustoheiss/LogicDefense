const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Explicitly alias recharts to its fully resolved CommonJS build
// to prevent Metro from picking the broken ES6 folder relative resolutions.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'recharts': path.resolve(__dirname, 'node_modules/recharts/lib/index.js'),
};

module.exports = config;
