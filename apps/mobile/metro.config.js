// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pnpm monorepo 対策: 共有パッケージ(@pass-and-play/core の zustand 等)が web 側の
// react(別バージョン)に解決されると React が二重バンドルされ Invalid hook call になる。
// react とそのサブパス(react/jsx-runtime 等)は常に mobile 自身のコピーへ固定する。
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [__dirname] }),
    };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
