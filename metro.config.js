const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith('.') || path.isAbsolute(moduleName)) {
      throw error;
    }
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, {
        paths: [path.dirname(context.originModulePath), __dirname],
      }),
    };
  }
};

module.exports = config;
