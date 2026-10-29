const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build ships a wa-sqlite .wasm binary.
config.resolver.assetExts.push('wasm');

module.exports = config;
