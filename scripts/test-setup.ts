import { beforeEach } from 'vitest'
import { config } from '@vue/test-utils'

config.global.stubs = {
  Transition: {
    inheritAttrs: false,
    setup(_, { slots }) {
      return () => slots.default?.()
    }
  },
  TransitionGroup: {
    inheritAttrs: false,
    setup(_, { slots }) {
      return () => slots.default?.()
    }
  }
}

beforeEach(() => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  }
})
