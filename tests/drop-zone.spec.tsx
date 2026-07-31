import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'
import { snapshotDropConfig, snapshotDropResult } from '../src/core/validation'

import type { Layout, ReadonlyLayout } from '../src/helpers/types'

const baseLayout: Layout = [{ x: 0, y: 0, w: 2, h: 2, i: '0' }]

/**
 * 创建模拟的 DragEvent。
 * happy-dom 对 DragEvent 支持有限，使用 MouseEvent 模拟基本属性。
 */
function createDragEvent(type: string, opts: { clientX?: number; clientY?: number } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { configurable: true, value: opts.clientX ?? 100 },
    clientY: { configurable: true, value: opts.clientY ?? 100 },
    dataTransfer: {
      configurable: true,
      value: { dropEffect: 'none', effectAllowed: 'all' },
    },
  })
  return event as DragEvent
}

async function settle() {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('外部拖入 proposal', () => {
  it('isDroppable=false 时不触发 drop-drag-over 事件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: false,
      },
      attachTo: document.body,
    })

    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')
    await layoutEl.trigger('dragover')

    expect(wrapper.emitted('drop-drag-over')).toBeUndefined()

    wrapper.unmount()
  })

  it('isDroppable=true 时 dragover 触发 drop-drag-over 事件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropItem: { w: 2, h: 2 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')
    const event = createDragEvent('dragover', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(event)
    await nextTick()

    const emitted = wrapper.emitted('drop-drag-over')
    expect(emitted).toBeDefined()
    expect(emitted!.length).toBeGreaterThanOrEqual(1)

    const [context] = emitted![0] as any[]
    expect(typeof context.candidate.x).toBe('number')
    expect(typeof context.candidate.y).toBe('number')
    expect(context.candidate.x).toBeGreaterThanOrEqual(0)
    expect(context.candidate.y).toBeGreaterThanOrEqual(0)
    expect(context.proposalId).toBe(1)
    expect(context.previewLayout).toHaveLength(baseLayout.length)

    wrapper.unmount()
  })

  it('drop 事件触发 drop 自定义事件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropItem: { w: 1, h: 1 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')

    // 先触发 dragover 以设置 dropPlaceholder
    const dragoverEvent = createDragEvent('dragover', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dragoverEvent)
    await nextTick()

    // 然后触发 drop
    const dropEvent = createDragEvent('drop', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dropEvent)
    await nextTick()

    const emitted = wrapper.emitted('drop')
    expect(emitted).toBeDefined()
    expect(emitted!.length).toBeGreaterThanOrEqual(1)

    const [result] = emitted![0] as any[]
    expect(result.status).toBe('accepted')
    expect(typeof result.candidate.x).toBe('number')
    expect(typeof result.candidate.y).toBe('number')
    expect(typeof result.candidate.w).toBe('number')
    expect(typeof result.candidate.h).toBe('number')

    wrapper.unmount()
  })

  it('dragover 时显示占位符', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropItem: { w: 2, h: 2 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    await nextTick()
    await nextTick()

    // 初始状态无 drop 占位符
    expect(vm.state.dropPlaceholder).toBeNull()

    const layoutEl = wrapper.find('.vgl-layout')
    const event = createDragEvent('dragover', { clientX: 200, clientY: 200 })
    layoutEl.element.dispatchEvent(event)
    await nextTick()

    // dragover 后应有占位符
    expect(vm.state.dropPlaceholder).not.toBeNull()
    expect(vm.state.dropPlaceholder.w).toBe(2)
    expect(vm.state.dropPlaceholder.h).toBe(2)

    wrapper.unmount()
  })

  it('drop 后移除占位符', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropItem: { w: 1, h: 1 },
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')

    // dragover 设置占位符
    const dragoverEvent = createDragEvent('dragover', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dragoverEvent)
    await nextTick()
    expect(vm.state.dropPlaceholder).not.toBeNull()

    // drop 移除占位符
    const dropEvent = createDragEvent('drop', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dropEvent)
    await nextTick()
    expect(vm.state.dropPlaceholder).toBeNull()

    wrapper.unmount()
  })

  it('坐标 clamp 到有效范围（x 不超过 cols - w）', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropItem: { w: 3, h: 1 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')

    // 使用非常大的 clientX 来模拟超出右边界
    const event = createDragEvent('dragover', { clientX: 9999, clientY: 100 })
    layoutEl.element.dispatchEvent(event)
    await nextTick()

    expect(vm.state.dropPlaceholder).not.toBeNull()
    // x 应被 clamp 到 cols - w = 12 - 3 = 9
    expect(vm.state.dropPlaceholder.x).toBeLessThanOrEqual(12 - 3)
    expect(vm.state.dropPlaceholder.x).toBeGreaterThanOrEqual(0)

    wrapper.unmount()
  })

  it('dropItem 默认尺寸为 { w: 1, h: 1 }', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.dropItem).toEqual({ w: 1, h: 1 })

    wrapper.unmount()
  })
})

describe('DropConfig 与 proposal 边界', () => {
  it('accepted/rejected 原生事件只应用各自的默认行为', async () => {
    const callback = vi.fn(() => ({}))
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropConfig: { onDragOver: callback },
      },
      attachTo: document.body,
    })
    await settle()

    const layout = wrapper.find('.vgl-layout').element
    const accepted = createDragEvent('dragover', { clientX: 1000, clientY: 100 })
    layout.dispatchEvent(accepted)
    expect(accepted.defaultPrevented).toBe(true)
    expect(accepted.dataTransfer?.dropEffect).toBe('copy')
    expect(callback).toHaveBeenCalledTimes(1)

    const dropped = createDragEvent('drop', { clientX: 1000, clientY: 100 })
    Object.defineProperty(dropped, 'dataTransfer', {
      configurable: true,
      value: accepted.dataTransfer,
    })
    layout.dispatchEvent(dropped)
    expect(dropped.defaultPrevented).toBe(true)
    expect(dropped.dataTransfer?.dropEffect).toBe('copy')
    expect(wrapper.emitted('drop')).toHaveLength(1)

    await wrapper.setProps({
      dropConfig: { onDragOver: () => false },
    })
    await settle()
    const rejected = createDragEvent('dragover', { clientX: 1000, clientY: 100 })
    layout.dispatchEvent(rejected)
    expect(rejected.defaultPrevented).toBe(false)
    expect(rejected.dataTransfer?.dropEffect).toBe('none')
    expect(wrapper.emitted('operation-rejected')).toBeUndefined()

    wrapper.unmount()
  })

  it.each([
    {
      name: 'callback throw',
      callback: () => {
        throw new Error('drop callback failed')
      },
      reason: 'extension-error',
      code: 'extension-error',
    },
    {
      name: 'callback 非法结果',
      callback: () => ({ w: 0 }),
      reason: 'extension-invalid-result',
      code: 'extension-invalid-result',
    },
  ])('$name 清 proposal 并共享 error/rejected evaluationId', async testCase => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropConfig: { onDragOver: testCase.callback as () => any },
      },
      attachTo: document.body,
    })
    await settle()

    const event = createDragEvent('dragover', { clientX: 1000, clientY: 100 })
    wrapper.find('.vgl-layout').element.dispatchEvent(event)
    await nextTick()

    const error = wrapper.emitted('error')?.at(-1)?.[0] as
      | { code: string; evaluationId: number }
      | undefined
    const rejected = wrapper.emitted('operation-rejected')?.at(-1)?.[0] as
      | { reason: string; evaluationId: number }
      | undefined
    expect(error).toMatchObject({ code: testCase.code })
    expect(rejected).toMatchObject({ reason: testCase.reason })
    expect(rejected?.evaluationId).toBe(error?.evaluationId)
    expect(wrapper.emitted('drop-drag-over')).toBeUndefined()
    expect((wrapper.vm as any).state.dropPlaceholder).toBeNull()
    expect(event.defaultPrevented).toBe(false)
    expect(event.dataTransfer?.dropEffect).toBe('none')

    wrapper.unmount()
  })

  it('初始 grouped/flat 默认尺寸非法时同步抛 config 错误且不调用 callback', () => {
    const callback = vi.fn(() => {
      throw new Error('must not run')
    })

    const cases = [
      {
        props: {
          dropConfig: {
            dropItem: { w: Number.NaN, h: 1 },
            onDragOver: callback,
          },
        },
        path: 'config.dropConfig.dropItem.w',
      },
      {
        props: {
          dropItem: { w: 1, h: 0 },
        },
        path: 'config.dropItem.h',
      },
    ] as const

    for (const testCase of cases) {
      expect(() =>
        mount(GridLayout, {
          props: {
            layout: baseLayout,
            width: 1200,
            isDroppable: true,
            ...testCase.props,
          },
        }),
      ).toThrow(
        expect.objectContaining({
          name: 'GridLayoutValidationError',
          code: 'invalid-config',
          path: testCase.path,
        }),
      )
    }
    expect(callback).not.toHaveBeenCalled()
  })

  it('动态 DropConfig 非法时保留 last-valid snapshot 并报告 config error', async () => {
    const validCallback = vi.fn(() => ({ w: 2, h: 1 }))
    const invalidCallback = vi.fn(() => ({ w: 5, h: 1 }))
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropConfig: {
          dropItem: { w: 1, h: 1 },
          onDragOver: validCallback,
        },
      },
    })
    await settle()

    await wrapper.setProps({
      dropConfig: {
        dropItem: { w: 0, h: 1 },
        onDragOver: invalidCallback,
      },
    })
    await settle()

    expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'invalid-config',
      source: 'config',
      path: 'config.dropConfig.dropItem.w',
    })

    wrapper
      .find('.vgl-layout')
      .element.dispatchEvent(createDragEvent('dragover', { clientX: 1000 }))
    await nextTick()

    expect(validCallback).toHaveBeenCalledOnce()
    expect(invalidCallback).not.toHaveBeenCalled()
    expect(wrapper.emitted('drop-drag-over')?.at(-1)?.[0]).toMatchObject({
      candidate: { w: 2, h: 1 },
    })
    wrapper.unmount()
  })

  it('合法 callback 尺寸先判横向边界', async () => {
    const invalidOverride = mount(GridLayout, {
      props: {
        layout: [{ ...baseLayout[0], h: 1 }],
        width: 1200,
        maxRows: 1,
        isDroppable: true,
        dropConfig: {
          onDragOver: () => ({ w: 13, h: 2 }),
        },
      },
    })
    await settle()
    invalidOverride
      .find('.vgl-layout')
      .element.dispatchEvent(createDragEvent('dragover', { clientX: 1000 }))
    expect(invalidOverride.emitted('operation-rejected')?.at(-1)?.[0]).toMatchObject({
      reason: 'out-of-bounds',
    })
    invalidOverride.unmount()
  })

  it.each([
    ['w', Number.NaN],
    ['w', 0],
    ['w', -1],
    ['w', 1.5],
    ['w', Number.MAX_SAFE_INTEGER + 1],
    ['h', 0],
  ] as const)('DropConfig dropItem.%s=%s 不是正 safe integer 时拒绝 snapshot', (field, value) => {
    const dropItem = { w: 1, h: 1, [field]: value }
    expect(() => snapshotDropConfig({ dropItem })).toThrow(
      expect.objectContaining({
        name: 'GridLayoutValidationError',
        code: 'invalid-config',
        path: `config.dropConfig.dropItem.${field}`,
      }),
    )
  })

  it('shape/result snapshot 不执行 accessor，并拒绝 reflection trap', () => {
    const callback = vi.fn()
    let getterReads = 0
    const configAccessor = {
      get onDragOver() {
        getterReads += 1
        return callback
      },
    }
    const itemAccessor = {
      isDroppable: true,
      dropItem: Object.defineProperty({}, 'w', {
        enumerable: true,
        get() {
          getterReads += 1
          return 1
        },
      }),
    }
    Object.defineProperty(itemAccessor.dropItem, 'h', {
      enumerable: true,
      value: 1,
    })
    const reflectionFailure = new Error('reflection failed')
    const configCases: Array<readonly [unknown, string]> = [
      [configAccessor, 'config.dropConfig.onDragOver'],
      [itemAccessor, 'config.dropConfig.dropItem.w'],
      [{ extra: true }, 'config.dropConfig.extra'],
      [{ [Symbol('unsafe')]: true }, 'config.dropConfig.<symbol>'],
      [
        new Proxy(
          {},
          {
            getPrototypeOf() {
              throw reflectionFailure
            },
          },
        ),
        'config.dropConfig',
      ],
    ]

    for (const [value, path] of configCases) {
      expect(() => snapshotDropConfig(value)).toThrow(
        expect.objectContaining({
          name: 'GridLayoutValidationError',
          code: 'invalid-config',
          path,
        }),
      )
    }

    const resultCases: Array<readonly [unknown, string]> = [
      [
        Object.defineProperty({}, 'w', {
          enumerable: true,
          get() {
            getterReads += 1
            return 1
          },
        }),
        'dropResult.w',
      ],
      [Object.assign(Object.create({ inherited: true }), { w: 1 }), 'dropResult'],
      [{ [Symbol('unsafe')]: true }, 'dropResult.<symbol>'],
      [
        new Proxy(
          {},
          {
            ownKeys() {
              throw reflectionFailure
            },
          },
        ),
        'dropResult',
      ],
    ]
    for (const [value, path] of resultCases) {
      expect(() => snapshotDropResult(value)).toThrow(
        expect.objectContaining({
          name: 'GridLayoutExtensionError',
          code: 'extension-invalid-result',
          source: 'drop-config',
          path,
        }),
      )
    }
    expect(getterReads).toBe(0)
    expect(callback).not.toHaveBeenCalled()
  })

  it.each([
    {
      ids: [0, 1, '0'] as const,
      expectedSyntheticId: 2,
    },
    {
      ids: ['0', 1] as const,
      expectedSyntheticId: 0,
    },
  ])(
    'synthetic id 对 numeric/string id 使用 Object.is 语义：$expectedSyntheticId',
    async ({ ids, expectedSyntheticId }) => {
      const layout: Layout = ids.map((id, index) => ({
        i: id,
        x: index,
        y: 0,
        w: 1,
        h: 1,
      }))
      const observed: Array<Array<string | number>> = []
      const compactor = {
        compact(input: ReadonlyLayout) {
          observed.push(input.map(item => item.i))
          return input.map(item => ({ ...item }))
        },
      }
      const wrapper = mount(GridLayout, {
        props: {
          layout,
          width: 1200,
          isDroppable: true,
          compactor,
        },
      })
      await settle()
      wrapper
        .find('.vgl-layout')
        .element.dispatchEvent(createDragEvent('dragover', { clientX: 1100, clientY: 100 }))
      await nextTick()

      const evaluation = observed.find(call => call.length === layout.length + 1)
      const context = wrapper.emitted('drop-drag-over')?.at(-1)?.[0] as
        | { candidate: Record<string, unknown>; previewLayout: ReadonlyLayout }
        | undefined
      expect(evaluation?.at(-1)).toBe(expectedSyntheticId)
      expect(context?.candidate).not.toHaveProperty('i')
      expect(context?.previewLayout.map(item => item.i)).toEqual(ids)

      wrapper.unmount()
    },
  )

  it('callback/context/result 递归隔离且 payload 不做 runtime freeze', async () => {
    const layout = [
      {
        ...baseLayout[0],
        metadata: { nested: { value: 'layout-original' } },
      },
    ] as unknown as Layout
    let callbackInput: any
    const callback = vi.fn((input: any) => {
      callbackInput = input
      input.candidate.x = 999
      input.layout[0].metadata.nested.value = 'callback-mutated'
      return {}
    })
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        width: 1200,
        isDroppable: true,
        dropConfig: { onDragOver: callback },
      },
    })
    await settle()

    const root = wrapper.find('.vgl-layout').element
    root.dispatchEvent(createDragEvent('dragover', { clientX: 1000, clientY: 100 }))
    await nextTick()

    const context = wrapper.emitted('drop-drag-over')?.at(-1)?.[0] as any
    expect(callbackInput.candidate.x).toBe(999)
    expect(context.candidate.x).not.toBe(999)
    expect(context.layout[0].metadata.nested.value).toBe('layout-original')
    expect(context.previewLayout[0].metadata.nested.value).toBe('layout-original')
    expect(context.layout).not.toBe(callbackInput.layout)
    expect(context.layout[0]).not.toBe(callbackInput.layout[0])
    expect(Object.isFrozen(callbackInput)).toBe(false)
    expect(Object.isFrozen(context)).toBe(false)
    expect(Object.isFrozen(context.previewLayout)).toBe(false)
    expect(Object.isFrozen(context.previewLayout[0])).toBe(false)
    expect(Object.isFrozen(context.candidate)).toBe(false)

    context.candidate.x = 998
    context.previewLayout[0].metadata.nested.value = 'context-mutated'
    context.layout[0].metadata.nested.value = 'context-mutated'

    const dropEvent = createDragEvent('drop', { clientX: 1000, clientY: 100 })
    root.dispatchEvent(dropEvent)
    await nextTick()

    const result = wrapper.emitted('drop')?.at(-1)?.[0] as any
    expect(result.candidate.x).not.toBe(998)
    expect(result.previewLayout[0].metadata.nested.value).toBe('layout-original')
    expect(result.candidate).not.toBe(context.candidate)
    expect(result.previewLayout).not.toBe(context.previewLayout)
    expect(result.previewLayout[0]).not.toBe(context.previewLayout[0])
    expect(Object.isFrozen(result)).toBe(false)
    expect(Object.isFrozen(result.candidate)).toBe(false)
    expect(Object.isFrozen(result.previewLayout)).toBe(false)

    result.candidate.x = 997
    result.previewLayout[0].metadata.nested.value = 'result-mutated'
    await settle()
    root.dispatchEvent(createDragEvent('dragover', { clientX: 1000, clientY: 100 }))
    await nextTick()

    const nextContext = wrapper.emitted('drop-drag-over')?.at(-1)?.[0] as any
    expect(nextContext.candidate.x).not.toBe(997)
    expect(nextContext.previewLayout[0].metadata.nested.value).toBe('layout-original')
    expect(nextContext.candidate).not.toBe(result.candidate)
    expect(nextContext.previewLayout[0]).not.toBe(result.previewLayout[0])

    wrapper.unmount()
  })

  it('internal interaction 与 Drop proposal 始终只有一个 owner', async () => {
    const callback = vi.fn(() => ({}))
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        width: 1200,
        isDroppable: true,
        dropConfig: { onDragOver: callback },
      },
    })
    await settle()
    const vm = wrapper.vm as any
    const layout = wrapper.find('.vgl-layout').element

    vm.dragEvent('dragstart', '0', 0, 0, 2, 2)
    layout.dispatchEvent(createDragEvent('dragover', { clientX: 1000, clientY: 100 }))
    expect(callback).not.toHaveBeenCalled()
    expect(vm.state.dropPlaceholder).toBeNull()

    vm.dragEvent('dragend', '0', 0, 0, 2, 2)
    layout.dispatchEvent(createDragEvent('dragover', { clientX: 1000, clientY: 100 }))
    expect(callback).toHaveBeenCalledTimes(1)
    expect(vm.state.dropPlaceholder).not.toBeNull()

    vm.dragEvent('dragstart', '0', 0, 0, 2, 2)
    expect(vm.state.dropPlaceholder).toBeNull()
    expect(wrapper.emitted('drop-drag-leave')).toBeUndefined()

    wrapper.unmount()
  })
})
