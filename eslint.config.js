import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/venv/**',
      '**/.venv/**',
      'backend/**',
      'Assistente-Moeda-App/**',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'tests/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
