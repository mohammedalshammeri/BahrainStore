module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@/api': './src/api',
            '@/screens': './src/screens',
            '@/store': './src/store',
            '@/types': './src/types',
            '@/constants': './src/constants',
            '@/components': './src/components',
            '@/hooks': './src/hooks',
            '@/lib': './src/lib',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
