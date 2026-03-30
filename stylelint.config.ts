import type { Config } from 'stylelint'

const config: Config = {
  extends: ['@vexip-ui/stylelint-config'],
  plugins: ['stylelint-prettier'],
}

export default config
