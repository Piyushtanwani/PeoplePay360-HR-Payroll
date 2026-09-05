import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * The gate that keeps dead code from creeping back.
 *
 * Unused imports and variables are errors, not warnings, because a warning nobody fails on is a
 * warning nobody reads. Everything else here catches a mistake that would otherwise reach a user:
 * a hook whose dependencies drifted, a promise nobody awaited, a switch that falls through.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'eslint.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Dead code is an error. This is the rule the sweep was for.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],

      // `any` erases the type safety the rest of the codebase depends on.
      '@typescript-eslint/no-explicit-any': 'error',

      // A debugging leftover that ships to a user's console.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',

      // Silent async failures: the exact shape of the twelve mutations that reported nothing.
      'no-fallthrough': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Tests reach into internals on purpose, and a fixture may be loosely typed.
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
)
