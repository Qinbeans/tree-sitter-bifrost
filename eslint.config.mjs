import treesitter from 'eslint-config-treesitter';

export default [
  treesitter,
  {
    languageOptions: {
      globals: {
        grammar: 'readonly',
        choice: 'readonly',
        seq: 'readonly',
        repeat: 'readonly',
        repeat1: 'readonly',
        optional: 'readonly',
        prec: 'readonly',
        token: 'readonly',
        alias: 'readonly',
        field: 'readonly',
        $: 'readonly',
      },
    },
  },
];
