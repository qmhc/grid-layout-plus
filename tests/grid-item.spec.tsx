import { describe, it, expect, beforeAll } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { GridLayout } from '../src'

import type { Layout } from '../src/helpers/types'

describe('GridLayout test', () => {
  let layout: Layout

  beforeAll(() => {
    const testLayout = [
      {
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        i: '0',
        resizable: true,
        draggable: true,
        static: false,
        minY: 0,
        maxY: 2
      }
    ]
    layout = JSON.parse(JSON.stringify(testLayout))
  })

  describe('Interface test', () => {
    it('should render correct contents', () => {
      const wrapper = shallowMount(GridLayout, {
        propsData: {
          layout
        }
      })
      const grid = wrapper.find('.vgl-layout')

      expect(grid.exists()).toBe(true)
    })
  })
})
