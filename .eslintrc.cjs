module.exports = {
  extends: ['@vexip-ui/eslint-config'],
  root: true,
  rules: {
    '@typescript-eslint/no-use-before-define': 'off',
    'vue/no-v-html': 'off',
    'vue/no-textarea-mustache': 'off'
  },
  overrides: [
    {
      files: ['src/**/*.vue'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            disallowTypeAnnotations: false
          }
        ],
        'vue/no-restricted-block': [
          'error',
          {
            element: '/[^(template|script)]/',
            message: 'Do not use blocks other than <template> or <script>.'
          }
        ]
      }
    },
    {
      files: ['scripts/**'],
      rules: {
        'no-sequences': 'off',
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
}
