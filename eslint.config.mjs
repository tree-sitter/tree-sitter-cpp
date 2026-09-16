import treesitter from 'eslint-config-treesitter';

export default [
  ...treesitter.map(config => ({...config, files: ['grammar.mjs']})),
  {
    files: ['grammar.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        rule: 'readonly',
        RustRegex: 'readonly',
      },
    },
    rules: {
      // Grammar node names use underscores, including the private this_ binding.
      camelcase: 'off',
      // Allow comma-separated rule declarations.
      'one-var': 'off',
    },
  },
];
