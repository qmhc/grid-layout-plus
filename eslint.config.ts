import type { Linter } from 'eslint'
import vexipEslint from '@vexip-ui/eslint-config'

const config: Linter.Config[] = [
  ...vexipEslint({
    ignores: [
      'dist',
      'es',
      'lib',
      'node_modules',
      'public',
      'cache',
      '.husky',
      '.*rc.js',
      '.*rc.cjs',
      '.*rc.mjs',
      '.*rc.ts',
      '*.config.js',
      '*.config.cjs',
      '*.config.mjs',
      '*.config.ts',
      '*.css',
      '*.pcss',
      '*.scss',
      '*.svg',
    ],
  }),
  {
    rules: {
      'vue/no-v-html': 'off',
      'vue/no-textarea-mustache': 'off',
      'comma-dangle': ['error', 'always-multiline'],
      '@stylistic/member-delimiter-style': 'off',
      '@stylistic/indent': 'off',
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['src/**/*.vue'],
    rules: {
      'vue/no-restricted-block': [
        'error',
        {
          element: '/[^(template|script)]/',
          message: 'Do not use blocks other than <template> or <script>.',
        },
      ],
    },
  },
  {
    files: ['scripts/**'],
    rules: {
      'no-sequences': 'off',
      'no-console': 'off',
    },
  },
]

export default config
