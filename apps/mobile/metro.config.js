/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);
const resolveMobileModule = (name) => path.resolve(projectRoot, 'node_modules', name);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Mobile currently has a local install tree alongside the workspace pnpm tree.
// Pin Metro to one consistent module source for packages that break when mixed.
config.resolver.extraNodeModules = {
  'react': resolveMobileModule('react'),
  'react-native': resolveMobileModule('react-native'),
  'nativewind': resolveMobileModule('nativewind'),
  'react-native-css-interop': resolveMobileModule('react-native-css-interop'),
  'react-native-reanimated': resolveMobileModule('react-native-reanimated'),
  'react-native-worklets': resolveMobileModule('react-native-worklets'),
  'semver': path.resolve(workspaceRoot, 'node_modules/semver'),
};
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, { input: './global.css' });
