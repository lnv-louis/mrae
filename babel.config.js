module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Enable polyfills for import.meta (required by @xenova/transformers)
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      'react-native-worklets/plugin',
    ],
  };
};
