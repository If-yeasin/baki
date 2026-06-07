const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);
const nativeWindRoot = path.dirname(require.resolve("nativewind/package.json"));
const cssInteropRoot = path.dirname(
  require.resolve("react-native-css-interop/package.json", {
    paths: [nativeWindRoot]
  })
);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "react-native-css-interop": cssInteropRoot
};

module.exports = withNativeWind(config, { input: "./global.css" });
