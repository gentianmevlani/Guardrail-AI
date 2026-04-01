/**
 * CLI package ESLint — local tsconfig; rules relaxed so `tsc` remains the strict gate.
 */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/ban-types': 'off',
    'no-useless-escape': 'off',
    eqeqeq: 'off',
    'no-control-regex': 'off',
    'no-empty': 'off',
    'no-case-declarations': 'off',
    'no-useless-catch': 'off',
    'no-async-promise-executor': 'off',
    'no-prototype-builtins': 'off',
    'no-constant-condition': 'off',
    'no-fallthrough': 'off',
    'getter-return': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-duplicate-enum-values': 'off',
    'prefer-const': 'off',
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'src/_extracted/**',
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.spec.ts',
  ],
};
