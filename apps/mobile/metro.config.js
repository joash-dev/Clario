// @ts-check
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Windows: Metro's fallback watcher can throw ENOENT on React Native's ephemeral
// `node_modules/@react-native/.codegen-*` trees (created/removed during installs).
const codegenTemp = /[\\/]node_modules[\\/]@react-native[\\/]\.codegen-[^/\\]+[\\/]/;
const existing = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existing)
  ? [...existing, codegenTemp]
  : [existing, codegenTemp].filter(Boolean);

module.exports = config;
